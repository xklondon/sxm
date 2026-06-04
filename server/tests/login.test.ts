import { describe, expect, it, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createSessionToken } from '../src/auth/tokens.js';
import { seedPerson } from './testHelpers.js';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

async function createTestApp() {
  process.env.NODE_ENV = 'development';
  process.env.INVITE_ONLY_MODE = 'true';
  process.env.ROOT_USER_EMAIL = 'root@example.com';
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  return createApp();
}

describe('public auth endpoints', () => {
  it('GET /api/health is public', async () => {
    const { app } = await createTestApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /health is public', async () => {
    const { app } = await createTestApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/auth/request-magic-link is public', async () => {
    const { app } = await createTestApp();
    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'root@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /api/auth/me returns 401 without session', async () => {
    const { app } = await createTestApp();
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/verify creates session cookie', async () => {
    const { app, auth } = await createTestApp();
    const { devLink } = await auth.requestMagicLink('root@example.com');
    const token = new URL(devLink!, 'http://localhost:5173').searchParams.get('token')!;
    const res = await request(app)
      .get(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .redirects(0);
    expect(res.status).toBe(302);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
  });

  it('root email can request magic link without person record', async () => {
    const { app, store } = await createTestApp();
    expect(store.getPersonByEmail('root@example.com')).toBeNull();
    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'root@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.devLink).toBeTruthy();
  });

  it('unknown email rejected in invite-only mode', async () => {
    const { app } = await createTestApp();
    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'stranger@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not registered or authorised/i);
  });

  it('invited person can request magic link', async () => {
    const { app, store } = await createTestApp();
    seedPerson(store, { email: 'invited@example.com', role: 'player', status: 'invited' });
    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'invited@example.com' });
    expect(res.status).toBe(200);
  });

  it('GET /api/auth/me succeeds with valid session', async () => {
    const { app, store } = await createTestApp();
    const user = store.createUser('root@example.com', 'Root');
    const cookie = `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${createSessionToken({ userId: user.id, email: user.email, persistent: true })}`;
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('root@example.com');
    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toContain('Max-Age=');
  });
});
