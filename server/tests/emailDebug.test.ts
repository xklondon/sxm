import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

async function createApp(opts?: { smtp?: boolean }) {
  process.env.NODE_ENV = 'production';
  process.env.PUBLIC_ORIGIN = 'https://sxm-production.up.railway.app';
  process.env.CORS_ORIGIN = 'https://sxm-production.up.railway.app';
  process.env.SESSION_SECRET = 'test-secret';
  process.env.INVITE_ONLY_MODE = 'true';
  process.env.ROOT_USER_EMAIL = 'root@example.com';
  if (opts?.smtp !== false) {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'user@gmail.com';
    process.env.SMTP_PASS = 'app-password';
    process.env.EMAIL_FROM = 'SXM Casino <user@gmail.com>';
  } else {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM;
  }
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  return createApp();
}

describe('GET /api/debug/email-config', () => {
  it('returns sanitized SMTP snapshot as JSON (not SPA HTML)', async () => {
    const { app } = await createApp();
    const res = await request(app).get('/api/debug/email-config');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toMatchObject({
      env: 'production',
      publicOrigin: 'https://sxm-production.up.railway.app',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUserPresent: true,
      smtpPassPresent: true,
      smtpConfigured: true,
    });
    expect(res.body.smtpPass).toBeUndefined();
    expect(String(res.text).toLowerCase()).not.toContain('<!doctype');
  });
});

describe('POST /api/debug/send-test-email', () => {
  it('returns 404 when DEBUG_EMAIL_TEST is not enabled', async () => {
    delete process.env.DEBUG_EMAIL_TEST;
    const { app } = await createApp();
    const res = await request(app)
      .post('/api/debug/send-test-email')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(404);
  });

  it('returns 503 when SMTP is not configured', async () => {
    process.env.DEBUG_EMAIL_TEST = 'true';
    const { app } = await createApp({ smtp: false });
    const res = await request(app)
      .post('/api/debug/send-test-email')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(503);
    expect(res.body.smtpConfigured).toBe(false);
  });
});

describe('SPA fallback does not swallow /api/debug', () => {
  it('GET /debug/client-config may be HTML but /api/debug/email-config is JSON', async () => {
    const { app } = await createApp();
    const client = await request(app).get('/debug/client-config');
    const api = await request(app).get('/api/debug/email-config');
    expect(api.headers['content-type']).toMatch(/json/);
    if (client.status === 200) {
      expect(client.headers['content-type']).toMatch(/html/);
    }
  });
});
