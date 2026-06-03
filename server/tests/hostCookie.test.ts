import { describe, expect, it, afterEach, vi } from 'vitest';
import request from 'supertest';
import {
  buildSessionCookieHeader,
  parseRememberQuery,
  shouldSecureSessionCookie,
} from '../src/auth/cookies.js';
import { createSessionToken } from '../src/auth/tokens.js';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

async function createHostApp() {
  process.env.NODE_ENV = 'development';
  process.env.SXM_HOST_MODE = 'true';
  process.env.SXM_DETECTED_LAN_IP = '10.0.0.7';
  process.env.PUBLIC_ORIGIN = 'http://10.0.0.7:5173';
  process.env.CORS_ORIGIN = 'http://10.0.0.7:5173';
  process.env.PORT = '5173';
  process.env.VITE_PORT = '5173';
  process.env.INVITE_ONLY_MODE = 'true';
  process.env.ROOT_USER_EMAIL = 'root@example.com';
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  return createApp();
}

describe('host-mode session cookies', () => {
  it('never sets Secure on HTTP host mode', async () => {
    const { app, auth } = await createHostApp();
    const { devLink } = await auth.requestMagicLink('root@example.com', true);
    const token = new URL(devLink!, 'http://10.0.0.7:5173').searchParams.get('token')!;
    const res = await request(app)
      .get(`/api/auth/verify?token=${encodeURIComponent(token)}&remember=1`)
      .set('Host', '10.0.0.7:5173')
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://10.0.0.7:5173/?newTable=1');
    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toContain('Max-Age=');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toMatch(/;\s*Secure/i);
    expect(setCookie).not.toMatch(/Domain=/i);
  });

  it('remember=1 sets Max-Age; remember=0 omits Max-Age in production only', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { buildSessionCookieHeader: devBuild } = await import('../src/auth/cookies.js');
    expect(devBuild('tok', { persistent: true })).toContain('Max-Age=');
    expect(devBuild('tok', { persistent: false })).toContain('Max-Age=');

    process.env.NODE_ENV = 'production';
    process.env.SXM_HOST_MODE = 'false';
    vi.resetModules();
    const { buildSessionCookieHeader: prodBuild } = await import('../src/auth/cookies.js');
    expect(prodBuild('tok', { persistent: true })).toContain('Max-Age=');
    expect(prodBuild('tok', { persistent: false })).not.toContain('Max-Age=');
    expect(parseRememberQuery('1')).toBe(true);
    expect(parseRememberQuery('0')).toBe(false);
  });

  it('GET /api/auth/me refreshes a persistent session cookie', async () => {
    const { app, store } = await createHostApp();
    const user = store.createUser('root@example.com', 'Root');
    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      persistent: true,
    });
    const cookie = `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${token}`;
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .set('Host', '10.0.0.7:5173');
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toContain('Max-Age=');
    expect(setCookie).not.toMatch(/;\s*Secure/i);
  });

  it('verify redirects to the request Host (127.0.0.1) when used on loopback', async () => {
    const { app, auth } = await createHostApp();
    const { devLink } = await auth.requestMagicLink('root@example.com', true);
    const token = new URL(devLink!, 'http://10.0.0.7:5173').searchParams.get('token')!;
    const res = await request(app)
      .get(`/api/auth/verify?token=${encodeURIComponent(token)}&remember=1`)
      .set('Host', '127.0.0.1:5173')
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://127.0.0.1:5173/?newTable=1');
  });

  it('verify redirects using X-Forwarded-Host from dev proxy', async () => {
    const { app, auth } = await createHostApp();
    const { devLink } = await auth.requestMagicLink('root@example.com', true);
    const token = new URL(devLink!, 'http://10.0.0.7:5173').searchParams.get('token')!;
    const res = await request(app)
      .get(`/api/auth/verify?token=${encodeURIComponent(token)}&remember=1`)
      .set('Host', '127.0.0.1:3017')
      .set('X-Forwarded-Host', '10.0.0.7:5173')
      .set('X-Forwarded-Proto', 'http')
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://10.0.0.7:5173/?newTable=1');
  });

  it('production host mode still omits Secure on HTTP', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SXM_HOST_MODE = 'true';
    process.env.SMTP_HOST = 'smtp.test';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    process.env.EMAIL_FROM = 'noreply@test.com';
    vi.resetModules();
    const { config } = await import('../src/config.js');
    expect(config.hostMode).toBe(true);
    expect(config.isProduction).toBe(true);
    expect(shouldSecureSessionCookie()).toBe(false);
    expect(buildSessionCookieHeader('tok', { persistent: true })).not.toMatch(/;\s*Secure/i);
  });
});
