import { afterEach, describe, expect, it, vi } from 'vitest';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

describe('email provider config', () => {
  it('defaults EMAIL_PROVIDER to smtp', async () => {
    delete process.env.EMAIL_PROVIDER;
    process.env.SMTP_HOST = 'smtp.test';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    process.env.EMAIL_FROM = 'a@b.c';
    vi.resetModules();
    const mod = await import('../src/config.js');
    expect(mod.getEmailProvider()).toBe('smtp');
    expect(mod.isEmailConfigured()).toBe(true);
  });

  it('uses Resend when EMAIL_PROVIDER=resend', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_x';
    process.env.RESEND_FROM = 'SXM <a@b.c>';
    vi.resetModules();
    const mod = await import('../src/config.js');
    expect(mod.getEmailProvider()).toBe('resend');
    expect(mod.isResendConfigured()).toBe(true);
    expect(mod.isEmailConfigured()).toBe(true);
    expect(mod.getEmailFrom()).toBe('SXM <a@b.c>');
  });
});
