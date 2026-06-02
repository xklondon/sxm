import { afterEach, describe, expect, it, vi } from 'vitest';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

describe('production deploy config (Railway)', () => {
  it('binds to process.env.PORT and serves static when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '8080';
    process.env.PUBLIC_ORIGIN = 'https://sxmcards-production.up.railway.app';
    process.env.CORS_ORIGIN = 'https://sxmcards-production.up.railway.app';
    process.env.SESSION_SECRET = 'test-secret-for-config-only';
    vi.resetModules();
    const { config } = await import('../src/config.js');
    expect(config.port).toBe(8080);
    expect(config.host).toBe('0.0.0.0');
    expect(config.isProduction).toBe(true);
    expect(config.serveStatic).toBe(true);
    expect(config.effectivePublicOrigin).toBe('https://sxmcards-production.up.railway.app');
  });

  it('uses PUBLIC_ORIGIN for production CORS when CORS_ORIGIN is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_ORIGIN = 'https://app.example.com';
    process.env.CORS_ORIGIN = 'https://app.example.com';
    vi.resetModules();
    const { getCorsOrigins } = await import('../src/config.js');
    expect(getCorsOrigins()).toEqual(['https://app.example.com']);
  });
});
