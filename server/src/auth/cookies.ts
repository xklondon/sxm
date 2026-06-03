import type { Request } from 'express';
import { config, getCorsOrigins, getEffectivePublicOrigin } from '../config.js';

export interface SessionCookieOptions {
  /** When true, emit Max-Age (persistent). When false, browser session cookie. */
  persistent?: boolean;
  req?: Request;
}

export function shouldSecureSessionCookie(req?: Request): boolean {
  if (config.hostMode) {
    return false;
  }
  if (!config.isProduction) {
    return false;
  }
  if (req?.secure) {
    return true;
  }
  const forwarded = req?.headers['x-forwarded-proto'];
  if (typeof forwarded === 'string' && forwarded.split(',')[0]!.trim() === 'https') {
    return true;
  }
  return false;
}

export function buildSessionCookieHeader(token: string, options: SessionCookieOptions = {}): string {
  const persistent = options.persistent !== false;
  // Local dev: always emit Max-Age so reloads on localhost keep the session cookie.
  const useMaxAge = persistent || !config.isProduction;
  const maxAgePart = useMaxAge ? `; Max-Age=${Math.floor(config.sessionMaxAgeMs / 1000)}` : '';
  const secure = shouldSecureSessionCookie(options.req) ? '; Secure' : '';
  return `${config.sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax${maxAgePart}${secure}`;
}

export function buildClearSessionCookieHeader(): string {
  return `${config.sessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

/** Keep redirects on the origin the user actually used (127.0.0.1 vs LAN IP, Railway host, etc.). */
export function resolveRequestOrigin(req: Request): string {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host =
    (typeof forwardedHost === 'string' ? forwardedHost.split(',')[0]!.trim() : null) ||
    req.get('host');
  if (!host) {
    return getEffectivePublicOrigin().replace(/\/$/, '');
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto =
    typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0]!.trim()
      : req.protocol;
  const origin = `${proto}://${host}`.replace(/\/$/, '');
  const allowed = new Set(getCorsOrigins().map((o) => o.replace(/\/$/, '')));
  if (!allowed.has(origin)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SXM][auth] request origin ${origin} not in CORS allowlist — redirecting to request host so Set-Cookie matches landing page`,
    );
  }
  return origin;
}

/** Safe auth verify diagnostics — never log tokens, emails, or cookie values. */
export function logAuthVerifyDiagnostics(
  req: Request,
  details: {
    redirectUrl: string;
    cookieName: string;
    secure: boolean;
    maxAgePresent: boolean;
    persistent: boolean;
  },
): void {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = req.get('host');
  // eslint-disable-next-line no-console
  console.log(
    `[SXM][auth] verify host=${host ?? '(none)'} x-forwarded-host=${typeof forwardedHost === 'string' ? forwardedHost.split(',')[0]!.trim() : '(none)'} resolvedOrigin=${resolveRequestOrigin(req)} redirect=${details.redirectUrl} cookieName=${details.cookieName} secure=${details.secure} maxAge=${details.maxAgePresent} persistent=${details.persistent}`,
  );
}

export function parseRememberQuery(value: unknown): boolean {
  if (value === '0' || value === 0 || value === false) {
    return false;
  }
  return true;
}
