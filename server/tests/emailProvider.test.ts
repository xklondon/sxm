import { afterEach, describe, expect, it, vi } from 'vitest';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

function smtpEnv() {
  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_USER = 'u';
  process.env.SMTP_PASS = 'p';
  process.env.EMAIL_FROM = 'a@b.c';
}

describe('email provider config', () => {
  it('auto defaults to smtp when SMTP is configured', async () => {
    delete process.env.EMAIL_PROVIDER;
    smtpEnv();
    vi.resetModules();
    const mod = await import('../src/config.js');
    expect(mod.getEmailProvider()).toBe('smtp');
    expect(mod.isEmailConfigured()).toBe(true);
  });

  it('uses Resend when EMAIL_PROVIDER=resend and no SMTP', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_x';
    process.env.RESEND_FROM = 'SXM <notify@verified.example.com>';
    delete process.env.SMTP_HOST;
    vi.resetModules();
    const mod = await import('../src/config.js');
    expect(mod.getEmailProvider()).toBe('resend');
    expect(mod.isResendConfigured()).toBe(true);
    expect(mod.isEmailConfigured()).toBe(true);
    expect(mod.getEmailFrom()).toBe('SXM <notify@verified.example.com>');
  });

  it('prefers SMTP over Resend sandbox when both are configured', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_x';
    process.env.RESEND_FROM = 'SXM <onboarding@resend.dev>';
    smtpEnv();
    vi.resetModules();
    const mod = await import('../src/config.js');
    expect(mod.getEmailProvider()).toBe('smtp');
    expect(mod.isResendSandboxFromAddress(process.env.RESEND_FROM!)).toBe(true);
  });

  it('detects Resend sandbox FROM addresses', async () => {
    vi.resetModules();
    const mod = await import('../src/config.js');
    expect(mod.isResendSandboxFromAddress('onboarding@resend.dev')).toBe(true);
    expect(mod.isResendSandboxFromAddress('SXM <onboarding@resend.dev>')).toBe(true);
    expect(mod.isResendSandboxFromAddress('notify@mydomain.com')).toBe(false);
  });

  it('clientEmailErrorMessage explains Resend sandbox restriction', async () => {
    const { clientEmailErrorMessage } = await import('../src/email/smtp.js');
    const msg = clientEmailErrorMessage(
      new Error('You can only send testing emails to your own email address (x@y.com)'),
    );
    expect(msg).toMatch(/Resend sandbox/i);
    expect(msg).toMatch(/resend\.com\/domains/i);
  });
});

describe('GET /api/debug/email-provider', () => {
  it('returns provider diagnostics JSON', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_ORIGIN = 'https://sxm-production.up.railway.app';
    process.env.CORS_ORIGIN = 'https://sxm-production.up.railway.app';
    process.env.SESSION_SECRET = 'test-secret';
    smtpEnv();
    vi.resetModules();
    const { createApp } = await import('../src/app.js');
    const { app } = createApp();
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/debug/email-provider');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      emailProvider: 'smtp',
      emailConfigured: true,
      fromAddress: 'a@b.c',
      resendSandboxMode: false,
    });
    expect(res.body.smtpPass).toBeUndefined();
  });
});
