import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
  vi.doUnmock('../src/email/mailer.js');
});

describe('magic-link email (auth + people)', () => {
  it('POST /api/auth/request-magic-link succeeds in dev without leaking config errors', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ROOT_USER_EMAIL = 'root@example.com';
    process.env.INVITE_ONLY_MODE = 'true';
    vi.resetModules();
    vi.doUnmock('../src/email/mailer.js');

    const { createApp } = await import('../src/app.js');
    const { app } = createApp();
    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'root@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.devLink).toBeTruthy();
    if (res.body.error) {
      expect(String(res.body.error)).not.toMatch(/config is not defined/i);
      expect(String(res.body.error)).not.toMatch(/config not found/i);
    }
  });

  it('sanitizes config ReferenceError on magic-link failure in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ROOT_USER_EMAIL = 'root@example.com';
    process.env.INVITE_ONLY_MODE = 'true';
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM = 'SXM <notify@verified.example.com>';
    vi.resetModules();

    vi.doMock('../src/email/mailer.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/email/mailer.js')>();
      return {
        ...actual,
        async sendMagicLinkEmail() {
          throw new ReferenceError('config is not defined');
        },
      };
    });

    const { createApp } = await import('../src/app.js');
    const { PeopleService } = await import('../src/people/service.js');
    const { app, store, auth } = createApp();
    const root = await store.createUser('root@example.com', 'Root');
    const people = new PeopleService(store);
    await people.ensurePersonOnLogin('root@example.com', root.id);

    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'root@example.com' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).not.toMatch(/config is not defined/i);
    expect(res.body.error).not.toMatch(/config not found/i);
    expect(res.body.error).toMatch(/server error|sign-in email/i);
    void auth;
  });
});
