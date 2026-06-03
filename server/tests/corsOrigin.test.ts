import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  isCorsOriginAllowed,
  normalizeOrigin,
  parseCorsOrigins,
} from '../src/origin.js';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

describe('normalizeOrigin', () => {
  it('adds https to bare Railway hostnames', () => {
    expect(normalizeOrigin('sxm-production.up.railway.app')).toBe(
      'https://sxm-production.up.railway.app',
    );
  });

  it('preserves explicit https and strips trailing slash', () => {
    expect(normalizeOrigin('https://sxm-production.up.railway.app/')).toBe(
      'https://sxm-production.up.railway.app',
    );
  });

  it('uses http for localhost', () => {
    expect(normalizeOrigin('localhost:5173')).toBe('http://localhost:5173');
    expect(normalizeOrigin('http://localhost:3000/')).toBe('http://localhost:3000');
  });
});

describe('isCorsOriginAllowed', () => {
  const allowed = [
    'https://sxm-production.up.railway.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  it('allows Railway browser origin when env used bare hostname', () => {
    const envAllowed = parseCorsOrigins('sxm-production.up.railway.app');
    expect(
      isCorsOriginAllowed('https://sxm-production.up.railway.app', envAllowed),
    ).toBe(true);
  });

  it('allows listed https and localhost origins', () => {
    expect(isCorsOriginAllowed('https://sxm-production.up.railway.app', allowed)).toBe(
      true,
    );
    expect(isCorsOriginAllowed('http://localhost:5173', allowed)).toBe(true);
    expect(isCorsOriginAllowed('http://localhost:3000', allowed)).toBe(true);
  });

  it('allows missing Origin (same-origin navigation)', () => {
    expect(isCorsOriginAllowed(undefined, allowed)).toBe(true);
  });

  it('rejects unknown origins', () => {
    expect(isCorsOriginAllowed('https://evil.example.com', allowed)).toBe(false);
  });
});

describe('production CORS config (Railway)', () => {
  it('normalizes bare PUBLIC_ORIGIN and allows Railway frontend origin', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_ORIGIN = 'sxm-production.up.railway.app';
    process.env.CORS_ORIGIN = 'sxm-production.up.railway.app';
    process.env.SESSION_SECRET = 'test-secret';
    vi.resetModules();
    const { getCorsOrigins, getEffectivePublicOrigin, isCorsOriginAllowed } =
      await import('../src/config.js');
    expect(getEffectivePublicOrigin()).toBe('https://sxm-production.up.railway.app');
    const origins = getCorsOrigins();
    expect(origins).toContain('https://sxm-production.up.railway.app');
    expect(origins).toContain('http://localhost:5173');
    expect(origins).toContain('http://localhost:3000');
    expect(isCorsOriginAllowed('https://sxm-production.up.railway.app', origins)).toBe(
      true,
    );
  });
});

describe('Express CORS middleware', () => {
  it('does not throw for allowed Railway origin preflight', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_ORIGIN = 'sxm-production.up.railway.app';
    process.env.CORS_ORIGIN = 'sxm-production.up.railway.app';
    process.env.SESSION_SECRET = 'test-secret';
    process.env.INVITE_ONLY_MODE = 'true';
    process.env.ROOT_USER_EMAIL = 'root@example.com';
    vi.resetModules();
    const { createApp } = await import('../src/app.js');
    const { app } = createApp();
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'https://sxm-production.up.railway.app')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBeLessThan(500);
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://sxm-production.up.railway.app',
    );
  });
});
