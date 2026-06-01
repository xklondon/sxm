import { describe, expect, it } from 'vitest';
import { pickLanIPv4, resolveEffectivePublicOrigin } from '../src/origin.js';
import {
  buildHostRuntimeInfo,
  DEFAULT_HOST_PORT,
  getHostPort,
  getJoinAddress,
  renderQrTerminal,
  renderQrDataUrl,
} from '../src/host.js';

describe('pickLanIPv4', () => {
  it('skips internal addresses and prefers private LAN ranges', () => {
    const ip = pickLanIPv4({
      lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      eth0: [
        { family: 'IPv6', internal: false, address: 'fe80::1' },
        { family: 'IPv4', internal: false, address: '8.8.8.8' },
      ],
      wlan0: [{ family: 'IPv4', internal: false, address: '192.168.43.12' }],
    });
    expect(ip).toBe('192.168.43.12');
  });

  it('falls back to first non-internal IPv4 when no private range present', () => {
    const ip = pickLanIPv4({
      lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      eth0: [{ family: 'IPv4', internal: false, address: '100.64.0.5' }],
    });
    expect(ip).toBe('100.64.0.5');
  });

  it('accepts numeric IPv4 family (Node variants) and 10.x hotspot ranges', () => {
    const ip = pickLanIPv4({
      wlan0: [{ family: 4, internal: false, address: '10.0.0.7' }],
    });
    expect(ip).toBe('10.0.0.7');
  });

  it('returns null when only internal/IPv6 addresses exist', () => {
    expect(
      pickLanIPv4({
        lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
        eth0: [{ family: 'IPv6', internal: false, address: 'fe80::1' }],
      }),
    ).toBeNull();
  });

  it('returns null for empty interfaces', () => {
    expect(pickLanIPv4({})).toBeNull();
  });
});

describe('getHostPort', () => {
  it('defaults to 5173', () => {
    expect(getHostPort({})).toBe(DEFAULT_HOST_PORT);
  });

  it('reads HOST_PORT then VITE_PORT', () => {
    expect(getHostPort({ HOST_PORT: '8080' })).toBe(8080);
    expect(getHostPort({ VITE_PORT: '4000' })).toBe(4000);
  });

  it('ignores invalid values', () => {
    expect(getHostPort({ VITE_PORT: 'abc' })).toBe(DEFAULT_HOST_PORT);
  });
});

describe('getJoinAddress', () => {
  it('builds http://<ip>:<port> from explicit ip + port', () => {
    expect(getJoinAddress({ ip: '192.168.0.42', port: 5173 })).toBe('http://192.168.0.42:5173');
  });

  it('falls back to localhost when no ip available', () => {
    expect(getJoinAddress({ ip: null, port: 5173 })).toBe('http://localhost:5173');
  });

  it('prepares mDNS join address (future sxmcards.local)', () => {
    expect(getJoinAddress({ mdns: true, port: 5173 })).toBe('http://sxmcards.local:5173');
  });

  it('does not hardcode any LAN IP', () => {
    const addr = getJoinAddress({ ip: '10.0.0.9', port: 5173 });
    expect(addr).toContain('10.0.0.9');
    expect(addr).not.toContain('192.168.0.56');
  });
});

describe('host mode public origin override', () => {
  const stale = 'http://10.191.204.176:5173';

  it('ignores a stale .env PUBLIC_ORIGIN and uses the detected IP', () => {
    const result = resolveEffectivePublicOrigin({
      nodeEnv: 'development',
      devPublicOrigin: '',
      publicOrigin: stale,
      vitePort: 5173,
      detectedLanIp: '192.168.1.42',
      hostMode: true,
    });
    expect(result.effective).toBe('http://192.168.1.42:5173');
    expect(result.hostModeOverride).toBe(true);
  });

  it('overrides even when .env looks production-valid', () => {
    const result = resolveEffectivePublicOrigin({
      nodeEnv: 'production',
      devPublicOrigin: '',
      publicOrigin: 'https://old.example.com',
      vitePort: 5173,
      detectedLanIp: '10.0.0.9',
      hostMode: true,
    });
    expect(result.effective).toBe('http://10.0.0.9:5173');
    expect(result.hostModeOverride).toBe(true);
  });

  it('does not override when host mode is off (normal dev behavior)', () => {
    const result = resolveEffectivePublicOrigin({
      nodeEnv: 'development',
      devPublicOrigin: '',
      publicOrigin: stale,
      vitePort: 5173,
      detectedLanIp: '192.168.1.42',
      hostMode: false,
    });
    expect(result.effective).toBe(stale);
    expect(result.hostModeOverride).toBe(false);
  });
});

describe('buildHostRuntimeInfo (.sxm-host-runtime.json shape)', () => {
  it('builds joinAddress from the detected IP + port', () => {
    const info = buildHostRuntimeInfo({ ip: '192.168.1.42', port: 5173 });
    expect(info.joinAddress).toBe('http://192.168.1.42:5173');
    expect(info.ip).toBe('192.168.1.42');
    expect(info.port).toBe(5173);
    expect(typeof info.startedAt).toBe('string');
    expect(Number.isNaN(Date.parse(info.startedAt))).toBe(false);
  });

  it('uses localhost join address when offline (ip null)', () => {
    const info = buildHostRuntimeInfo({ ip: null, port: 5173, startedAt: '2026-01-01T00:00:00.000Z' });
    expect(info.joinAddress).toBe('http://localhost:5173');
    expect(info.ip).toBeNull();
    expect(info.startedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('QR generation helpers', () => {
  it('renders a non-empty terminal QR', async () => {
    const qr = await renderQrTerminal('http://192.168.0.42:5173');
    expect(typeof qr).toBe('string');
    expect(qr.length).toBeGreaterThan(0);
  });

  it('renders a PNG data-URL QR for the in-app screen', async () => {
    const dataUrl = await renderQrDataUrl('http://192.168.0.42:5173');
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });
});
