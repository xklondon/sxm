import {
  detectLanIPv4,
  parseCorsOrigins,
  resolveEffectivePublicOrigin,
} from './origin.js';

function env(key: string, fallback = ''): string {
  return process.env[key]?.trim() ?? fallback;
}

function envBool(key: string, fallback = false): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return fallback;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

const DEFAULT_PUBLIC_ORIGIN = 'http://localhost:5173';
const vitePort = envInt('VITE_PORT', 5173);
const hostMode = envBool('SXM_HOST_MODE');

const configuredPublicOrigin = env(
  'PUBLIC_ORIGIN',
  env('VITE_TABLE_HOST', DEFAULT_PUBLIC_ORIGIN),
);

const effectiveResult = resolveEffectivePublicOrigin({
  nodeEnv: env('NODE_ENV', 'development'),
  devPublicOrigin: env('DEV_PUBLIC_ORIGIN'),
  publicOrigin: configuredPublicOrigin,
  vitePort,
  detectedLanIp: env('SXM_DETECTED_LAN_IP') || undefined,
  hostMode,
});

if (
  hostMode &&
  effectiveResult.hostModeOverride &&
  configuredPublicOrigin.replace(/\/$/, '') !== effectiveResult.effective
) {
  // eslint-disable-next-line no-console
  console.log(
    `[SXM HOST] ignoring .env PUBLIC_ORIGIN=${configuredPublicOrigin} because host mode detected ${effectiveResult.effective}`,
  );
}

export const config = {
  nodeEnv: env('NODE_ENV', 'development'),
  /** Listen port. Production platforms set PORT; dev uses API_PORT (internal). */
  port: envInt('PORT', envInt('API_PORT', 3017)),
  host: env('API_HOST', env('NODE_ENV') === 'production' ? '0.0.0.0' : '127.0.0.1'),
  /** Value from .env (may differ from effective origin in dev). */
  publicOrigin: configuredPublicOrigin.replace(/\/$/, ''),
  effectivePublicOrigin: effectiveResult.effective,
  devPublicOriginAuto: effectiveResult.autoApplied,
  vitePort,
  sessionSecret: env('SESSION_SECRET', 'dev-insecure-change-me'),
  sessionCookieName: env('SESSION_COOKIE_NAME', 'sxmcards_session'),
  sessionMaxAgeMs: envInt('SESSION_MAX_AGE_MS', 7 * 24 * 60 * 60 * 1000),
  magicLinkTtlMs: envInt('MAGIC_LINK_TTL_MS', 15 * 60 * 1000),
  magicLinkResendCooldownMs: envInt('MAGIC_LINK_RESEND_COOLDOWN_MS', 60 * 1000),
  isProduction: env('NODE_ENV') === 'production',
  /** Termux/`npm run host`: follow detected IP, ignore stale .env PUBLIC_ORIGIN/CORS_ORIGIN. */
  hostMode,
  /** Serve the built SPA from the API server (production, or Termux host mode). */
  serveStatic: envBool('SXM_SERVE_STATIC') || hostMode || env('NODE_ENV') === 'production',
  emailInvitesEnabled: envBool('VITE_EMAIL_INVITES') || envBool('EMAIL_INVITES'),
  smtp: {
    host: env('SMTP_HOST'),
    port: envInt('SMTP_PORT', 587),
    user: env('SMTP_USER'),
    pass: env('SMTP_PASS'),
    from: env('EMAIL_FROM', 'noreply@sxmcards.local'),
  },
  rootUserEmail: normalizeEmailEnv(env('ROOT_USER_EMAIL')),
  inviteOnlyMode: envBool('INVITE_ONLY_MODE', true),
  inviteTtlMs: envInt('INVITE_TTL_MS', 7 * 24 * 60 * 60 * 1000),
};

function normalizeEmailEnv(value: string): string {
  return value.trim().toLowerCase();
}

export function getEffectivePublicOrigin(): string {
  return config.effectivePublicOrigin;
}

export function getCorsOrigins(): string[] {
  // Host mode: never trust a stale .env CORS_ORIGIN — the phone IP changes.
  // Allow the detected-IP origin plus loopback (for the host's own banner fetch).
  if (config.hostMode) {
    const origins = new Set<string>();
    origins.add(getEffectivePublicOrigin());
    origins.add(`http://localhost:${vitePort}`);
    origins.add(`http://127.0.0.1:${vitePort}`);
    const lanIp = env('SXM_DETECTED_LAN_IP') || detectLanIPv4();
    if (lanIp) {
      origins.add(`http://${lanIp}:${vitePort}`);
    }
    return [...origins];
  }

  const raw = env('CORS_ORIGIN', configuredPublicOrigin);
  const fromEnv = parseCorsOrigins(raw);
  if (config.isProduction) {
    return fromEnv.length > 0 ? fromEnv : [getEffectivePublicOrigin()];
  }

  const origins = new Set(fromEnv);
  origins.add(getEffectivePublicOrigin());
  origins.add(`http://localhost:${vitePort}`);
  origins.add(`http://127.0.0.1:${vitePort}`);
  const lanIp = env('SXM_DETECTED_LAN_IP') || detectLanIPv4();
  if (lanIp) {
    origins.add(`http://${lanIp}:${vitePort}`);
  }
  return [...origins];
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    config.smtp.host && config.smtp.from && config.smtp.user && config.smtp.pass,
  );
}

export function assertProductionOrigin(): void {
  if (!config.isProduction) return;
  if (env('DEV_PUBLIC_ORIGIN').toLowerCase() === 'auto') {
    throw new Error('DEV_PUBLIC_ORIGIN=auto is not allowed in production');
  }
  const o = getEffectivePublicOrigin().toLowerCase();
  if (o.includes('localhost') || o.includes('127.0.0.1') || o.includes('192.168.')) {
    throw new Error('PUBLIC_ORIGIN must not be localhost/LAN in production');
  }
}
