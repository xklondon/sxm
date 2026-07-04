import {
  detectLanIPv4,
  isCorsOriginAllowed,
  normalizeOrigin,
  parseCorsOrigins,
  resolveEffectivePublicOrigin,
} from './origin.js';

export { isCorsOriginAllowed };

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

const configuredPublicOrigin = normalizeOrigin(
  env('PUBLIC_ORIGIN', env('VITE_TABLE_HOST', DEFAULT_PUBLIC_ORIGIN)) || DEFAULT_PUBLIC_ORIGIN,
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
  publicOrigin: configuredPublicOrigin,
  effectivePublicOrigin: normalizeOrigin(effectiveResult.effective),
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
  resend: {
    apiKey: env('RESEND_API_KEY'),
    from: env('RESEND_FROM'),
  },
  rootUserEmail: normalizeEmailEnv(env('ROOT_USER_EMAIL')),
  inviteOnlyMode: envBool('INVITE_ONLY_MODE', true),
  inviteTtlMs: envInt('INVITE_TTL_MS', 7 * 24 * 60 * 60 * 1000),
  iouHandoff: {
    source: env('IOU_HANDOFF_SOURCE', 'sxm'),
    secret: env('IOU_HANDOFF_SECRET'),
    createUrl: env(
      'IOU_HANDOFF_CREATE_URL',
      'http://localhost:6969/api/integrations/handoff/create',
    ),
    enabled: isIouHandoffConfigured(),
  },
};

/** Canonical IOU Wallet B2B handoff env keys (server-only). */
export const IOU_HANDOFF_CANONICAL_ENV_KEYS = [
  'IOU_HANDOFF_SOURCE',
  'IOU_HANDOFF_SECRET',
  'IOU_HANDOFF_CREATE_URL',
] as const;

/** Legacy names — ignored; log rename hint if present without canonical keys. */
export const IOU_HANDOFF_LEGACY_ENV_KEYS = [
  'SXM_HANDOFF_SECRET',
  'SXM_HANDOFF_SOURCE',
  'SXM_HANDOFF_CREATE_URL',
] as const;

export interface IouHandoffConfigDiagnostics {
  enabled: boolean;
  hasSecret: boolean;
  hasCreateUrl: boolean;
  missingCanonical: string[];
  legacyEnvPresent: string[];
}

function isIouHandoffConfigured(): boolean {
  return Boolean(env('IOU_HANDOFF_SECRET') && env('IOU_HANDOFF_CREATE_URL'));
}

export function getIouHandoffConfigDiagnostics(): IouHandoffConfigDiagnostics {
  const hasSecret = Boolean(env('IOU_HANDOFF_SECRET'));
  const hasCreateUrl = Boolean(env('IOU_HANDOFF_CREATE_URL'));
  const missingCanonical: string[] = [];
  if (!hasSecret) {
    missingCanonical.push('IOU_HANDOFF_SECRET');
  }
  if (!hasCreateUrl) {
    missingCanonical.push('IOU_HANDOFF_CREATE_URL');
  }
  const legacyEnvPresent = IOU_HANDOFF_LEGACY_ENV_KEYS.filter((key) => Boolean(env(key)));
  return {
    enabled: hasSecret && hasCreateUrl,
    hasSecret,
    hasCreateUrl,
    missingCanonical,
    legacyEnvPresent,
  };
}

/** User-facing error when handoff routes are hit but env is incomplete. */
export function getIouHandoffNotConfiguredMessage(): string {
  const diag = getIouHandoffConfigDiagnostics();
  if (diag.legacyEnvPresent.length > 0 && !diag.hasSecret) {
    return (
      'IOU handoff is not configured on this server. ' +
      `Rename legacy env ${diag.legacyEnvPresent.join(', ')} to IOU_HANDOFF_* (see .env.example).`
    );
  }
  if (!diag.hasSecret) {
    return 'IOU handoff is not configured on this server. Set IOU_HANDOFF_SECRET.';
  }
  if (!diag.hasCreateUrl) {
    return 'IOU handoff is not configured on this server. Set IOU_HANDOFF_CREATE_URL.';
  }
  return 'IOU handoff is not configured on this server.';
}

export function logIouHandoffConfigStatus(): void {
  const diag = getIouHandoffConfigDiagnostics();
  if (diag.enabled) {
    // eslint-disable-next-line no-console
    console.log('[SXM][iou-handoff] configured (IOU_HANDOFF_SECRET + IOU_HANDOFF_CREATE_URL set)');
    return;
  }
  if (diag.legacyEnvPresent.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SXM][iou-handoff] legacy env ignored: ${diag.legacyEnvPresent.join(', ')} — use IOU_HANDOFF_* only`,
    );
  }
  if (diag.missingCanonical.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SXM][iou-handoff] not configured — missing: ${diag.missingCanonical.join(', ')}`,
    );
  }
}

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
  const origins = new Set(fromEnv);
  origins.add(getEffectivePublicOrigin());
  origins.add('http://localhost:5173');
  origins.add('http://localhost:3000');
  origins.add(`http://localhost:${vitePort}`);
  origins.add(`http://127.0.0.1:${vitePort}`);
  if (config.isProduction) {
    return [...origins];
  }

  const devOrigins = new Set(fromEnv);
  devOrigins.add(getEffectivePublicOrigin());
  devOrigins.add('http://localhost:5173');
  devOrigins.add('http://localhost:3000');
  devOrigins.add(`http://localhost:${vitePort}`);
  devOrigins.add(`http://127.0.0.1:${vitePort}`);
  const lanIp = env('SXM_DETECTED_LAN_IP') || detectLanIPv4();
  if (lanIp) {
    devOrigins.add(`http://${lanIp}:${vitePort}`);
  }
  return [...devOrigins];
}

export type EmailProvider = 'smtp' | 'resend';

/** Parse bare or `"Name" <addr>` From header values. */
export function parseFromEmailAddress(from: string): string {
  const trimmed = from.trim();
  const bracket = trimmed.match(/<([^>]+)>/);
  if (bracket?.[1]) {
    return bracket[1].trim().toLowerCase();
  }
  const bare = trimmed.match(/([^\s<>]+@[^\s<>]+)/);
  return (bare?.[1] ?? trimmed).trim().toLowerCase();
}

export function getFromDomain(from: string): string {
  const addr = parseFromEmailAddress(from);
  return addr.split('@')[1] ?? '';
}

/** Resend test/sandbox senders cannot deliver to external recipients. */
export function isResendSandboxFromAddress(from: string): boolean {
  const addr = parseFromEmailAddress(from);
  return addr.endsWith('@resend.dev') || addr.includes('onboarding@resend');
}

/** Resend API + verified (non-sandbox) FROM — safe for production external mail. */
export function isResendProductionReady(): boolean {
  return isResendConfigured() && !isResendSandboxFromAddress(config.resend.from);
}

export function isGmailSmtpHost(): boolean {
  const host = config.smtp.host.trim().toLowerCase();
  return host.includes('gmail.com') || host.includes('google.com');
}

function smtpTcpReachabilityEnv(): boolean | null {
  const raw = env('SMTP_TCP_REACHABLE').toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return null;
}

/** SMTP usable for sending — in production, Gmail requires a passing TCP probe. */
export function isSmtpReachable(): boolean {
  const forced = smtpTcpReachabilityEnv();
  if (forced !== null) {
    return forced;
  }
  if (isGmailSmtpHost()) {
    return false;
  }
  return true;
}

export function getEmailProvider(): EmailProvider {
  const raw = env('EMAIL_PROVIDER', 'auto').toLowerCase();
  const smtpOk = isSmtpConfigured();
  const smtpUsable = smtpOk && isSmtpReachable();
  const resendProd = isResendProductionReady();
  const resendOk = isResendConfigured();

  if (raw === 'smtp') {
    if (!smtpUsable && resendProd) {
      // eslint-disable-next-line no-console
      console.warn('[SXM][email] SMTP unreachable — falling back to Resend API');
      return 'resend';
    }
    return 'smtp';
  }
  if (raw === 'resend') {
    return 'resend';
  }

  // auto
  if (config.isProduction) {
    if (resendProd) {
      return 'resend';
    }
    if (smtpUsable) {
      return 'smtp';
    }
    if (resendOk) {
      return 'resend';
    }
    // Do not select broken Gmail SMTP on Railway when only sandbox Resend exists.
    return 'resend';
  }

  if (resendProd) {
    return 'resend';
  }
  if (smtpUsable) {
    return 'smtp';
  }
  if (resendOk) {
    return 'resend';
  }
  return 'smtp';
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    config.smtp.host && config.smtp.from && config.smtp.user && config.smtp.pass,
  );
}

export function isResendConfigured(): boolean {
  return Boolean(config.resend.apiKey && config.resend.from);
}

export function isEmailConfigured(): boolean {
  return getEmailProvider() === 'resend' ? isResendConfigured() : isSmtpConfigured();
}

export function getEmailFrom(): string {
  return getEmailProvider() === 'resend' ? config.resend.from : config.smtp.from;
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
