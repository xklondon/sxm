import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './config';

describe('resolveApiBaseUrl', () => {
  it('uses page origin when LAN VITE_API_URL differs from localhost (proxied dev)', () => {
    const result = resolveApiBaseUrl({
      isDev: true,
      pageOrigin: 'http://localhost:5173',
      configuredApiUrl: 'http://192.168.0.56:5173',
    });
    expect(result.proxied).toBe(true);
    expect(result.baseUrl).toBe('http://localhost:5173');
  });

  it('uses configured URL when it matches page origin', () => {
    const result = resolveApiBaseUrl({
      isDev: true,
      pageOrigin: 'http://192.168.0.56:5173',
      configuredApiUrl: 'http://192.168.0.56:5173',
    });
    expect(result.proxied).toBe(false);
    expect(result.baseUrl).toBe('http://192.168.0.56:5173');
  });

  it('uses page origin when VITE_API_URL is empty in dev', () => {
    const result = resolveApiBaseUrl({
      isDev: true,
      pageOrigin: 'http://localhost:5173',
    });
    expect(result.proxied).toBe(true);
    expect(result.baseUrl).toBe('http://localhost:5173');
  });

  it('production uses configured API URL', () => {
    const result = resolveApiBaseUrl({
      isDev: false,
      pageOrigin: 'https://play.example.com',
      configuredApiUrl: 'https://play.example.com',
    });
    expect(result.proxied).toBe(false);
    expect(result.baseUrl).toBe('https://play.example.com');
  });
});
