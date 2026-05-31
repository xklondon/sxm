import os from 'node:os';

interface NetAddr {
  family: string | number;
  internal: boolean;
  address: string;
}

/**
 * Pure LAN IPv4 picker — testable without touching the host network.
 * Prefers private ranges (Wi-Fi / hotspot), else first non-internal IPv4.
 */
export function pickLanIPv4(
  nets: NodeJS.Dict<NetAddr[]> | Record<string, NetAddr[] | undefined>,
): string | null {
  const candidates: string[] = [];

  for (const addrs of Object.values(nets)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      const isV4 = addr.family === 'IPv4' || addr.family === 4;
      if (!isV4 || addr.internal) continue;
      candidates.push(addr.address);
    }
  }

  const preferred = candidates.find(
    (ip) => ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip),
  );
  return preferred ?? candidates[0] ?? null;
}

export function detectLanIPv4(): string | null {
  return pickLanIPv4(os.networkInterfaces());
}

export function parseOriginHost(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

export function parseOriginPort(origin: string, fallback = 5173): number {
  try {
    const url = new URL(origin);
    if (url.port) return Number(url.port);
    return url.protocol === 'https:' ? 443 : fallback;
  } catch {
    return fallback;
  }
}

export function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function resolveEffectivePublicOrigin(params: {
  nodeEnv: string;
  devPublicOrigin: string;
  publicOrigin: string;
  vitePort: number;
  detectedLanIp?: string;
}): { effective: string; autoApplied: boolean } {
  const configured = params.publicOrigin.trim().replace(/\/$/, '') || `http://localhost:${params.vitePort}`;
  const isProduction = params.nodeEnv === 'production';
  const devAuto = params.devPublicOrigin.trim().toLowerCase() === 'auto';

  if (isProduction && devAuto) {
    return { effective: configured, autoApplied: false };
  }

  if (!isProduction && devAuto) {
    const ip = params.detectedLanIp?.trim() || detectLanIPv4();
    if (ip) {
      return { effective: `http://${ip}:${params.vitePort}`, autoApplied: true };
    }
  }

  return { effective: configured, autoApplied: false };
}

export function originHostMismatchWarning(params: {
  publicOrigin: string;
  detectedLanIp: string | null;
  vitePort: number;
  autoApplied: boolean;
}): string | null {
  const configuredHost = parseOriginHost(params.publicOrigin);
  const networkHost = params.detectedLanIp;
  if (!configuredHost || !networkHost) {
    return null;
  }
  if (configuredHost === 'localhost' || configuredHost === '127.0.0.1') {
    return null;
  }
  if (!configuredHost.startsWith('192.168.') && !configuredHost.startsWith('10.')) {
    return null;
  }
  const networkOrigin = `http://${networkHost}:${params.vitePort}`;
  if (configuredHost === networkHost) {
    return null;
  }
  if (params.autoApplied) {
    return `[SXM] NOTE: PUBLIC_ORIGIN in .env is ${params.publicOrigin} but detected LAN is ${networkOrigin}. Magic/invite links use effective origin (see above).`;
  }
  return `[SXM] WARNING: PUBLIC_ORIGIN points to ${configuredHost} but Vite Network is ${networkHost}
[SXM] Magic/invite links will use PUBLIC_ORIGIN and may fail.
[SXM] Set DEV_PUBLIC_ORIGIN=auto in .env to follow the detected LAN IP automatically.`;
}

export function linkUsesOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin.replace(/\/$/, '');
  } catch {
    return false;
  }
}

export function isLocalhostOrigin(origin: string): boolean {
  const host = parseOriginHost(origin);
  return host === 'localhost' || host === '127.0.0.1';
}
