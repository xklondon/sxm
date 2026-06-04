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
  process.env.EMAIL_FROM = 'notify@example.com';
}

describe('sendMagicLinkEmail', () => {
  it('does not throw ReferenceError in development when email is configured', async () => {
    process.env.NODE_ENV = 'development';
    smtpEnv();
    vi.resetModules();
    const { sendMagicLinkEmail } = await import('../src/email/mailer.js');
    await expect(
      sendMagicLinkEmail('invited@example.com', 'https://play.example.com/api/auth/verify?token=t'),
    ).resolves.toBeUndefined();
  });

  it('uses the same sendMailWithLogging path as table invites in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM = 'SXM <notify@verified.example.com>';
    vi.resetModules();
    vi.doUnmock('../src/email/mailer.js');

    const sendMailWithLogging = vi.fn(async () => ({
      messageId: 'msg-magic',
      accepted: ['invited@example.com'],
      rejected: [],
    }));

    vi.doMock('../src/email/smtp.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/email/smtp.js')>();
      return { ...actual, sendMailWithLogging };
    });

    const { sendMagicLinkEmail } = await import('../src/email/mailer.js');
    await sendMagicLinkEmail('invited@example.com', 'https://play.example.com/api/auth/verify?token=t');
    expect(sendMailWithLogging).toHaveBeenCalledWith(
      'magic-link',
      expect.objectContaining({
        to: 'invited@example.com',
        subject: 'Sign in to SXMCARDS',
      }),
    );
  });
});

describe('clientEmailErrorMessage', () => {
  it('sanitizes ReferenceError and "is not defined" leaks', async () => {
    vi.resetModules();
    const { clientEmailErrorMessage } = await import('../src/email/smtp.js');
    expect(clientEmailErrorMessage(new ReferenceError('config is not defined'))).not.toMatch(
      /config is not defined/i,
    );
    expect(clientEmailErrorMessage(new Error('config is not defined'))).not.toMatch(
      /config is not defined/i,
    );
    expect(clientEmailErrorMessage(new Error('Cannot find module config'))).not.toMatch(
      /config not found/i,
    );
  });
});
