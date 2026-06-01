import QRCode from 'qrcode';
import { detectLanIPv4 } from './origin.js';

/** Default host port — players connect to http://<ip>:<port>. */
export const DEFAULT_HOST_PORT = 5173;

/** First non-internal LAN IPv4, or null when offline / unavailable. */
export function getLocalHostAddress(): string | null {
  return detectLanIPv4();
}

export function getHostPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.HOST_PORT?.trim() || env.VITE_PORT?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_HOST_PORT;
}

export interface JoinAddressOptions {
  ip?: string | null;
  port?: number;
  /** Future: advertise http://sxmcards.local via mDNS. */
  mdns?: boolean;
  mdnsHost?: string;
}

/**
 * Address players use to join. Today returns http://<lan-ip>:<port>.
 * mDNS support is prepared: pass `mdns: true` for http://sxmcards.local:<port>.
 */
export function getJoinAddress(options: JoinAddressOptions = {}): string {
  const port = options.port ?? getHostPort();
  if (options.mdns) {
    const host = options.mdnsHost?.trim() || 'sxmcards.local';
    return `http://${host}:${port}`;
  }
  const resolvedIp = options.ip === undefined ? getLocalHostAddress() : options.ip;
  return `http://${resolvedIp ?? 'localhost'}:${port}`;
}

export interface HostRuntimeInfo {
  joinAddress: string;
  ip: string | null;
  port: number;
  startedAt: string;
}

/**
 * Shape written to `.sxm-host-runtime.json` each run (safe to overwrite,
 * gitignored). Lets tooling/widgets read the current join address without .env.
 */
export function buildHostRuntimeInfo(params: {
  ip: string | null;
  port: number;
  startedAt?: string;
}): HostRuntimeInfo {
  const joinAddress = getJoinAddress({ ip: params.ip, port: params.port });
  return {
    joinAddress,
    ip: params.ip ?? null,
    port: params.port,
    startedAt: params.startedAt ?? new Date().toISOString(),
  };
}

/** Terminal-renderable QR code for a join address (lightweight `qrcode`). */
export function renderQrTerminal(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'terminal', small: true });
}

/** Data-URL QR for the in-app Host Server screen. */
export function renderQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: 220 });
}
