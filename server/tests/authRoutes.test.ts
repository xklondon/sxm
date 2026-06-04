import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

async function createProdApp() {
  process.env.NODE_ENV = 'production';
  process.env.PUBLIC_ORIGIN = 'https://sxm-production.up.railway.app';
  process.env.CORS_ORIGIN = 'https://sxm-production.up.railway.app';
  process.env.SESSION_SECRET = 'test-secret';
  process.env.INVITE_ONLY_MODE = 'true';
  process.env.ROOT_USER_EMAIL = 'root@example.com';
  process.env.RESEND_API_KEY = 're_test';
  process.env.RESEND_FROM = 'SXM <notify@verified.example.com>';
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  return createApp();
}

describe('auth API routes in production build', () => {
  it('GET /api/auth/me returns 401 without session (not 404 HTML)', async () => {
    const { app } = await createProdApp();
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toMatch(/authentication/i);
  });

  it('POST /api/auth/request-magic-link exists (not 404)', async () => {
    const { app } = await createProdApp();
    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'stranger@example.com' });
    expect(res.status).not.toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('unknown /api/* returns JSON 404 not SPA HTML', async () => {
    const { app } = await createProdApp();
    const res = await request(app).get('/api/no-such-route');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toMatch(/not found/i);
    expect(String(res.text).toLowerCase()).not.toContain('<!doctype');
  });

  it('GET /api/debug/routes lists auth endpoints', async () => {
    const { app } = await createProdApp();
    const res = await request(app).get('/api/debug/routes');
    expect(res.status).toBe(200);
    expect(res.body.auth).toContain('GET /api/auth/me');
    expect(res.body.auth).toContain('POST /api/auth/request-magic-link');
  });

  it('GET /api/auth/me recreates user after memory store reset (401 not 404)', async () => {
    const { app, store } = await createProdApp();
    const { createSessionToken: createToken } = await import('../src/auth/tokens.js');
    const token = createToken({
      userId: 'stale-user-id',
      email: 'root@example.com',
      persistent: true,
    });
    const cookie = `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${token}`;
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('root@example.com');
    expect(store.getUserById('stale-user-id')).toBeNull();
    expect(store.getUserByEmail('root@example.com')).toBeTruthy();
  });
});
