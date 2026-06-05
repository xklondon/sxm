import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { seedPerson } from './testHelpers.js';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
  vi.doUnmock('../src/email/mailer.js');
  vi.doUnmock('../src/email/smtp.js');
});

function smtpEnv() {
  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_USER = 'u';
  process.env.SMTP_PASS = 'p';
  process.env.EMAIL_FROM = 'notify@example.com';
}

async function rootAdminCookie(store: { createUser: (email: string, name: string) => { id: string } }) {
  const { createSessionToken } = await import('../src/auth/tokens.js');
  const root = await store.createUser('root@example.com', 'Root');
  const { PeopleService } = await import('../src/people/service.js');
  const people = new PeopleService(store);
  await people.ensurePersonOnLogin('root@example.com', root.id);
  const token = createSessionToken({ userId: root.id, email: 'root@example.com' });
  return {
    root,
    cookie: `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${token}`,
  };
}

function peopleTestEnv() {
  process.env.SESSION_SECRET = 'test-secret';
  process.env.ROOT_USER_EMAIL = 'root@example.com';
  process.env.INVITE_ONLY_MODE = 'true';
}

describe('POST /api/people add + invite email', () => {
  it('creates person and returns devLink when magic link succeeds in development', async () => {
    peopleTestEnv();
    process.env.NODE_ENV = 'development';
    smtpEnv();
    vi.resetModules();
    vi.doUnmock('../src/email/mailer.js');

    const { createApp } = await import('../src/app.js');
    const { app, store } = createApp();
    const { cookie } = await rootAdminCookie(store);

    const res = await request(app)
      .post('/api/people')
      .set('Cookie', cookie)
      .send({ email: 'newplayer@example.com', displayName: 'New Player', role: 'player' });

    expect(res.status).toBe(201);
    expect(res.body.person.email).toBe('newplayer@example.com');
    expect(res.body.devLink).toBeTruthy();
    expect(await store.getPersonByEmail('newplayer@example.com')).toBeTruthy();
  });

  it('returns structured 502 when invite email fails but person is created', async () => {
    peopleTestEnv();
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_ORIGIN = 'https://play.example.com';
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
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
    const { app, store } = createApp();
    const { cookie } = await rootAdminCookie(store);

    const res = await request(app)
      .post('/api/people')
      .set('Cookie', cookie)
      .send({ email: 'failmail@example.com', role: 'player' });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('invite_email_failed');
    expect(res.body.person.email).toBe('failmail@example.com');
    expect(res.body.error).not.toMatch(/config is not defined/i);
    expect(await store.getPersonByEmail('failmail@example.com')).toBeTruthy();
  });

  it('send-invite endpoint returns sanitized error on email failure', async () => {
    peopleTestEnv();
    process.env.NODE_ENV = 'development';
    vi.resetModules();

    vi.doMock('../src/email/mailer.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/email/mailer.js')>();
      return {
        ...actual,
        async sendMagicLinkEmail() {
          throw new Error('Resend API error (403)');
        },
      };
    });

    const { createApp } = await import('../src/app.js');
    const { app, store } = createApp();
    const { cookie } = await rootAdminCookie(store);
    const person = await seedPerson(store, {
      email: 'resent@example.com',
      role: 'player',
      status: 'invited',
    });

    const res = await request(app)
      .post(`/api/people/${person.id}/send-invite`)
      .set('Cookie', cookie);

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('invite_email_failed');
    expect(res.body.error).not.toMatch(/config is not defined/i);
  });
});
