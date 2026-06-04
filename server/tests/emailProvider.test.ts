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
  it('dev auto uses SMTP when only SMTP is configured', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.EMAIL_PROVIDER;
    smtpEnv();
    vi.resetModules();
    const mod = await import('../src/config.js');
    expect(mod.getEmailProvider()).toBe('smtp');
    expect(mod.isEmailConfigured()).toBe(true);
  });

  it('production auto prefers verified Resend over Gmail SMTP', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.EMAIL_PROVIDER;
    process.env.RESEND_API_KEY = 're_x';
    process.env.RESEND_FROM = 'SXM <notify@verified.example.com>';
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@gmail.com';
    process.env.SMTP_PASS = 'pass';
    process.env.EMAIL_FROM = 'user@gmail.com';
    vi.resetModules();
    const mod = await import('../src/config.js');
    expect(mod.isResendProductionReady()).toBe(true);
    expect(mod.getEmailProvider()).toBe('resend');
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

  it('dev auto uses SMTP when Resend is sandbox-only', async () => {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_PROVIDER = 'auto';
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

  it('clientEmailErrorMessage explains Gmail SMTP timeout on Railway', async () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    vi.resetModules();
    const { clientEmailErrorMessage } = await import('../src/email/smtp.js');
    const msg = clientEmailErrorMessage(new Error('SMTP operation timed out (sendMail)'));
    expect(msg).toMatch(/Gmail SMTP is unreachable/i);
    expect(msg).toMatch(/Resend/i);
  });
});

describe('GET /api/debug/email-provider', () => {
  it('returns provider diagnostics JSON', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_ORIGIN = 'https://sxm-production.up.railway.app';
    process.env.CORS_ORIGIN = 'https://sxm-production.up.railway.app';
    process.env.SESSION_SECRET = 'test-secret';
    process.env.RESEND_API_KEY = 're_x';
    process.env.RESEND_FROM = 'SXM <notify@verified.example.com>';
    smtpEnv();
    vi.resetModules();
    const { createApp } = await import('../src/app.js');
    const { app } = createApp();
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/debug/email-provider');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      emailProvider: 'resend',
      emailConfigured: true,
      resendProductionReady: true,
      resendSandboxMode: false,
    });
    expect(res.body.smtpPass).toBeUndefined();
  });
});
