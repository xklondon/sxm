import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  detectLanIPv4,
  linkUsesOrigin,
  originHostMismatchWarning,
  parseCorsOrigins,
  resolveEffectivePublicOrigin,
} from '../src/origin.js';

describe('resolveEffectivePublicOrigin', () => {
  it('uses detected LAN IP when DEV_PUBLIC_ORIGIN=auto in development', () => {
    const result = resolveEffectivePublicOrigin({
      nodeEnv: 'development',
      devPublicOrigin: 'auto',
      publicOrigin: 'http://localhost:5173',
      vitePort: 5173,
      detectedLanIp: '192.168.0.36',
    });
    expect(result.autoApplied).toBe(true);
    expect(result.effective).toBe('http://192.168.0.36:5173');
  });

  it('uses configured PUBLIC_ORIGIN when auto is off', () => {
    const result = resolveEffectivePublicOrigin({
      nodeEnv: 'development',
      devPublicOrigin: '',
      publicOrigin: 'http://localhost:5173',
      vitePort: 5173,
      detectedLanIp: '192.168.0.36',
    });
    expect(result.autoApplied).toBe(false);
    expect(result.effective).toBe('http://localhost:5173');
  });

  it('ignores DEV_PUBLIC_ORIGIN=auto in production resolve', () => {
    const result = resolveEffectivePublicOrigin({
      nodeEnv: 'production',
      devPublicOrigin: 'auto',
      publicOrigin: 'https://play.example.com',
      vitePort: 5173,
    });
    expect(result.autoApplied).toBe(false);
    expect(result.effective).toBe('https://play.example.com');
  });
});

describe('originHostMismatchWarning', () => {
  it('warns when stale LAN IP in PUBLIC_ORIGIN without auto', () => {
    const msg = originHostMismatchWarning({
      publicOrigin: 'http://192.168.0.56:5173',
      detectedLanIp: '192.168.0.36',
      vitePort: 5173,
      autoApplied: false,
    });
    expect(msg).toMatch(/WARNING/i);
    expect(msg).toMatch(/192\.168\.0\.56/);
    expect(msg).toMatch(/192\.168\.0\.36/);
  });

  it('notes mismatch when auto overrides stale PUBLIC_ORIGIN', () => {
    const msg = originHostMismatchWarning({
      publicOrigin: 'http://192.168.0.56:5173',
      detectedLanIp: '192.168.0.36',
      vitePort: 5173,
      autoApplied: true,
    });
    expect(msg).toMatch(/NOTE/i);
    expect(msg).not.toMatch(/WARNING/i);
  });
});

describe('parseCorsOrigins', () => {
  it('parses comma-separated origins', () => {
    expect(parseCorsOrigins('http://localhost:5173,http://192.168.0.36:5173')).toEqual([
      'http://localhost:5173',
      'http://192.168.0.36:5173',
    ]);
  });
});

describe('linkUsesOrigin', () => {
  it('matches effective origin host', () => {
    expect(
      linkUsesOrigin(
        'http://192.168.0.36:5173/api/auth/verify?token=abc',
        'http://192.168.0.36:5173',
      ),
    ).toBe(true);
  });
});

describe('detectLanIPv4', () => {
  it('returns an IP string or null', () => {
    expect(detectLanIPv4() === null || /^\d+\.\d+\.\d+\.\d+$/.test(detectLanIPv4()!)).toBe(true);
  });
});

describe('production origin guard', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('rejects DEV_PUBLIC_ORIGIN=auto in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_ORIGIN = 'https://play.example.com';
    process.env.DEV_PUBLIC_ORIGIN = 'auto';
    vi.resetModules();
    const { assertProductionOrigin } = await import('../src/config.js');
    expect(() => assertProductionOrigin()).toThrow(/auto/i);
  });
});
