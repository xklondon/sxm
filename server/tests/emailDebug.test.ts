import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const envBackup = { ...process.env };

/** Env keys that affect email provider selection — must not leak from local .env. */
const EMAIL_ENV_KEYS = [
  'EMAIL_PROVIDER',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'SMTP_TCP_REACHABLE',
] as const;

function clearEmailEnv(): void {
  for (const key of EMAIL_ENV_KEYS) {
    delete process.env[key];
  }
}

function restoreBaseEnv(): void {
  process.env = { ...envBackup };
  vi.resetModules();
}

beforeEach(() => {
  restoreBaseEnv();
});

afterEach(() => {
  restoreBaseEnv();
  vi.unstubAllGlobals();
});

type EmailFixture =
  /** Production: Gmail SMTP vars present but unreachable; no Resend — not configured for send. */
  | 'production-smtp-unreachable-no-resend'
  /** No SMTP or Resend — email not configured. */
  | 'unconfigured'
  /** Resend API key + verified FROM — configured for send. */
  | 'resend-configured';

async function createApp(opts?: { email?: EmailFixture; debugEmailTest?: boolean }) {
  clearEmailEnv();
  delete process.env.DEBUG_EMAIL_TEST;
  process.env.NODE_ENV = 'production';
  process.env.PUBLIC_ORIGIN = 'https://sxm-production.up.railway.app';
  process.env.CORS_ORIGIN = 'https://sxm-production.up.railway.app';
  process.env.SESSION_SECRET = 'test-secret';
  process.env.INVITE_ONLY_MODE = 'true';
  process.env.ROOT_USER_EMAIL = 'root@example.com';

  const email = opts?.email ?? 'production-smtp-unreachable-no-resend';

  if (email === 'production-smtp-unreachable-no-resend') {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'user@gmail.com';
    process.env.SMTP_PASS = 'app-password';
    process.env.EMAIL_FROM = 'SXM Casino <user@gmail.com>';
  } else if (email === 'resend-configured') {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM = 'SXM Casino <notify@verified.example.com>';
  }

  if (opts?.debugEmailTest) {
    process.env.DEBUG_EMAIL_TEST = 'true';
  }

  vi.resetModules();
  const { createApp: buildApp } = await import('../src/app.js');
  // /api/debug is root-only in production — mint a root session with the
  // same freshly-loaded config/secret the app instance uses.
  const { createSessionToken } = await import('../src/auth/tokens.js');
  const rootAuth = `Bearer ${createSessionToken({ userId: 'root-user', email: 'root@example.com' })}`;
  return { ...buildApp(), rootAuth };
}

describe('GET /api/debug/email-config', () => {
  it('returns sanitized snapshot when SMTP present but Resend not configured (production auto)', async () => {
    const { app, rootAuth } = await createApp({ email: 'production-smtp-unreachable-no-resend' });
    const res = await request(app).get('/api/debug/email-config').set('Authorization', rootAuth);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toMatchObject({
      env: 'production',
      emailProvider: 'resend',
      publicOrigin: 'https://sxm-production.up.railway.app',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUserPresent: true,
      smtpPassPresent: true,
      smtpConfigured: true,
      smtpReachable: false,
      smtpGmailHost: true,
      emailConfigured: false,
      resendConfigured: false,
    });
    expect(res.body.smtpPass).toBeUndefined();
    expect(res.body.resendApiKeyPresent).toBe(false);
    expect(String(res.text).toLowerCase()).not.toContain('<!doctype');
  });

  it('returns configured snapshot when Resend is explicitly configured', async () => {
    const { app, rootAuth } = await createApp({ email: 'resend-configured' });
    const res = await request(app).get('/api/debug/email-config').set('Authorization', rootAuth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      env: 'production',
      emailProvider: 'resend',
      emailConfigured: true,
      resendConfigured: true,
      resendApiKeyPresent: true,
      smtpConfigured: false,
    });
    expect(res.body.smtpPass).toBeUndefined();
    expect(String(res.text)).not.toMatch(/re_test_key/);
  });
});

describe('SMTP timeout helpers', () => {
  it('smtpFailureResponse exposes stage and ETIMEDOUT code', async () => {
    const { SmtpOperationTimeoutError, smtpFailureResponse } = await import('../src/email/smtp.js');
    const err = new SmtpOperationTimeoutError('verify', 'smtp.gmail.com', 587);
    expect(smtpFailureResponse(err, 'sendMail')).toEqual({
      ok: false,
      stage: 'verify',
      code: 'ETIMEDOUT',
      message: 'SMTP operation timed out (verify)',
    });
  });
});

describe('POST /api/debug/send-test-email', () => {
  it('returns 404 when DEBUG_EMAIL_TEST is not enabled', async () => {
    const { app, rootAuth } = await createApp({ email: 'resend-configured' });
    const res = await request(app)
      .post('/api/debug/send-test-email')
      .set('Authorization', rootAuth)
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-root session in production', async () => {
    const { app } = await createApp({ email: 'resend-configured', debugEmailTest: true });
    const { createSessionToken } = await import('../src/auth/tokens.js');
    const memberAuth = `Bearer ${createSessionToken({ userId: 'u1', email: 'player@example.com' })}`;
    const res = await request(app)
      .post('/api/debug/send-test-email')
      .set('Authorization', memberAuth)
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(404);
  });

  it('returns 401 without a session', async () => {
    const { app } = await createApp({ email: 'resend-configured', debugEmailTest: true });
    const res = await request(app)
      .post('/api/debug/send-test-email')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(401);
  });

  it('returns 503 when email is not configured', async () => {
    const { app, rootAuth } = await createApp({ email: 'unconfigured', debugEmailTest: true });
    const res = await request(app)
      .post('/api/debug/send-test-email')
      .set('Authorization', rootAuth)
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(503);
    expect(res.body.emailConfigured).toBe(false);
    expect(res.body.resendConfigured).toBe(false);
    expect(res.body.smtpConfigured).toBe(false);
  });

  it('sends test email via Resend API when EMAIL_PROVIDER=resend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ id: 'msg-resend-1' }, { status: 200 })),
    );
    const { app, rootAuth } = await createApp({ email: 'resend-configured', debugEmailTest: true });
    const res = await request(app)
      .post('/api/debug/send-test-email')
      .set('Authorization', rootAuth)
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.messageId).toBe('msg-resend-1');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
        }),
      }),
    );
  });
});

describe('SPA fallback does not swallow /api/debug', () => {
  it('GET /debug/client-config may be HTML but /api/debug/email-config is JSON', async () => {
    const { app, rootAuth } = await createApp({ email: 'production-smtp-unreachable-no-resend' });
    const client = await request(app).get('/debug/client-config');
    const api = await request(app).get('/api/debug/email-config').set('Authorization', rootAuth);
    expect(api.headers['content-type']).toMatch(/json/);
    if (client.status === 200) {
      expect(client.headers['content-type']).toMatch(/html/);
    }
  });
});
