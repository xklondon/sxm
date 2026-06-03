import { describe, expect, it } from 'vitest';
import {
  clientConfigHasStaleLanIp,
  formatClientConfig,
  resolveApiBaseUrl,
  resolveOnlineModeEnabled,
  type ClientConfigSnapshot,
} from './config';

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

  it('host mode (production build, blank VITE_API_URL) uses the page origin', () => {
    const result = resolveApiBaseUrl({
      isDev: false,
      pageOrigin: 'http://192.168.1.42:5173',
      configuredApiUrl: '',
    });
    expect(result.proxied).toBe(false);
    expect(result.baseUrl).toBe('http://192.168.1.42:5173');
  });

  it('forces proxied page origin in dev when VITE_USE_PROXY=false but API origin differs', () => {
    const result = resolveApiBaseUrl({
      isDev: true,
      pageOrigin: 'http://localhost:5173',
      configuredApiUrl: 'http://127.0.0.1:3017',
      useProxyFlag: 'false',
    });
    expect(result.proxied).toBe(true);
    expect(result.baseUrl).toBe('http://localhost:5173');
  });

  it('host mode falls back to page origin even on loopback', () => {
    const result = resolveApiBaseUrl({
      isDev: false,
      pageOrigin: 'http://127.0.0.1:5173',
      configuredApiUrl: undefined,
    });
    expect(result.baseUrl).toBe('http://127.0.0.1:5173');
  });
});

describe('client config snapshot helpers', () => {
  const hostSnapshot: ClientConfigSnapshot = {
    href: 'http://192.168.1.42:5173/',
    origin: 'http://192.168.1.42:5173',
    apiBase: 'http://192.168.1.42:5173',
    socketBase: 'http://192.168.1.42:5173',
    mode: 'production',
    dev: false,
    prod: true,
    viteApiUrl: '',
    viteTableHost: '',
    onlineMode: true,
  };

  it('host config has no stale baked LAN IP (origin-derived is fine)', () => {
    // apiBase equals the page origin, and VITE_* are blank → not a stale build.
    expect(clientConfigHasStaleLanIp({ ...hostSnapshot, apiBase: hostSnapshot.origin, viteApiUrl: '', viteTableHost: '' })).toBe(false);
  });

  it('flags a stale baked VITE_API_URL with a LAN IP', () => {
    expect(
      clientConfigHasStaleLanIp({ ...hostSnapshot, viteApiUrl: 'http://10.191.204.176:5173' }),
    ).toBe(true);
  });

  it('host/production build is online-capable even without a VITE_ONLINE_MODE flag', () => {
    expect(resolveOnlineModeEnabled({ mode: 'production' })).toBe(true);
    expect(resolveOnlineModeEnabled({ prod: true })).toBe(true);
    // The reported odd host build: MODE=production but DEV true / PROD false.
    expect(resolveOnlineModeEnabled({ mode: 'production', prod: false })).toBe(true);
  });

  it('respects an explicit VITE_ONLINE_MODE flag in any build', () => {
    expect(resolveOnlineModeEnabled({ viteOnlineMode: 'true', mode: 'development' })).toBe(true);
    expect(resolveOnlineModeEnabled({ viteOnlineMode: 'false', mode: 'production' })).toBe(false);
  });

  it('defaults dev (non-production) without a flag to offline', () => {
    expect(resolveOnlineModeEnabled({ mode: 'development' })).toBe(false);
    expect(resolveOnlineModeEnabled({})).toBe(false);
  });

  it('formats the config with all required fields', () => {
    const text = formatClientConfig(hostSnapshot);
    expect(text).toContain('location.origin = http://192.168.1.42:5173');
    expect(text).toContain('apiBase         = http://192.168.1.42:5173');
    expect(text).toContain('socketBase      = http://192.168.1.42:5173');
    expect(text).toContain('import.meta.env.PROD = true');
    expect(text).toContain('VITE_API_URL    = (blank)');
    expect(text).toContain('onlineMode      = true');
  });
});
