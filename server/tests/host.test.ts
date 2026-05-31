import { describe, expect, it } from 'vitest';
import { pickLanIPv4 } from '../src/origin.js';
import {
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
