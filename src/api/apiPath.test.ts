import { describe, expect, it } from 'vitest';
import { apiPath, normalizeApiPath } from './config';

describe('normalizeApiPath', () => {
  it('always returns a leading slash', () => {
    expect(normalizeApiPath('/api/auth/me')).toBe('/api/auth/me');
    expect(normalizeApiPath('api/auth/me')).toBe('/api/auth/me');
    expect(normalizeApiPath('api/auth/request-magic-link')).toBe(
      '/api/auth/request-magic-link',
    );
  });

  it('never returns a bare relative path without leading slash', () => {
    const paths = [
      normalizeApiPath('api/auth/me'),
      normalizeApiPath('/api/auth/me'),
      normalizeApiPath('api/foo'),
    ];
    for (const p of paths) {
      expect(p.startsWith('/')).toBe(true);
      expect(p).not.toMatch(/^api\//);
    }
  });
});

describe('apiPath', () => {
  it('preserves leading slash for standard auth paths', () => {
    expect(apiPath('/api/auth/me')).toMatch(/\/api\/auth\/me$/);
    expect(apiPath('api/auth/me')).toMatch(/\/api\/auth\/me$/);
  });
});
