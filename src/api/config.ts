export function resolveApiBaseUrl(params: {
  isDev: boolean;
  pageOrigin: string;
  configuredApiUrl?: string;
  useProxyFlag?: string;
}): { baseUrl: string; proxied: boolean } {
  const configured = params.configuredApiUrl?.trim();
  const useProxyFlag = params.useProxyFlag?.trim().toLowerCase();

  if (useProxyFlag === 'true') {
    return { baseUrl: params.pageOrigin, proxied: true };
  }
  if (useProxyFlag === 'false') {
    const baseUrl = configured?.replace(/\/$/, '') || params.pageOrigin;
    if (params.isDev) {
      try {
        if (new URL(baseUrl).origin !== new URL(params.pageOrigin).origin) {
          return { baseUrl: params.pageOrigin, proxied: true };
        }
      } catch {
        return { baseUrl: params.pageOrigin, proxied: true };
      }
    }
    return { baseUrl, proxied: false };
  }

  if (!params.isDev) {
    return {
      baseUrl: configured?.replace(/\/$/, '') || params.pageOrigin,
      proxied: false,
    };
  }

  if (!configured) {
    return { baseUrl: params.pageOrigin, proxied: true };
  }

  try {
    const configuredOrigin = new URL(configured).origin;
    if (configuredOrigin !== params.pageOrigin) {
      return { baseUrl: params.pageOrigin, proxied: true };
    }
  } catch {
    return { baseUrl: params.pageOrigin, proxied: true };
  }

  return { baseUrl: configured.replace(/\/$/, ''), proxied: false };
}

export function usesProxiedApi(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return resolveApiBaseUrl({
    isDev: import.meta.env.DEV,
    pageOrigin: window.location.origin,
    configuredApiUrl: import.meta.env.VITE_API_URL as string | undefined,
    useProxyFlag: import.meta.env.VITE_USE_PROXY as string | undefined,
  }).proxied;
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return resolveApiBaseUrl({
      isDev: import.meta.env.DEV,
      pageOrigin: window.location.origin,
      configuredApiUrl: import.meta.env.VITE_API_URL as string | undefined,
      useProxyFlag: import.meta.env.VITE_USE_PROXY as string | undefined,
    }).baseUrl;
  }
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  return configured?.replace(/\/$/, '') ?? '';
}

/**
 * Socket.IO base. Same single-origin rule as the REST API: same page origin in
 * host/production, the proxied page origin in dev. Never a baked LAN IP.
 */
export function getSocketBaseUrl(): string {
  return getApiBaseUrl();
}

export interface ClientConfigSnapshot {
  href: string;
  origin: string;
  apiBase: string;
  socketBase: string;
  mode: string;
  dev: boolean;
  prod: boolean;
  viteApiUrl: string;
  viteTableHost: string;
  onlineMode: boolean;
}

/** Live client URL/config snapshot for the boot debug page + diagnostics. */
export function getClientConfigSnapshot(): ClientConfigSnapshot {
  const hasWindow = typeof window !== 'undefined';
  return {
    href: hasWindow ? window.location.href : '',
    origin: hasWindow ? window.location.origin : '',
    apiBase: getApiBaseUrl(),
    socketBase: getSocketBaseUrl(),
    mode: import.meta.env.MODE,
    dev: Boolean(import.meta.env.DEV),
    prod: Boolean(import.meta.env.PROD),
    viteApiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? '',
    viteTableHost: (import.meta.env.VITE_TABLE_HOST as string | undefined) ?? '',
    onlineMode: isOnlineModeEnabled(),
  };
}

/** Human-readable client config (used by the /debug/client-config page). */
export function formatClientConfig(c: ClientConfigSnapshot): string {
  return [
    `location.href   = ${c.href}`,
    `location.origin = ${c.origin}`,
    `apiBase         = ${c.apiBase}`,
    `socketBase      = ${c.socketBase}`,
    `import.meta.env.MODE = ${c.mode}`,
    `import.meta.env.DEV  = ${c.dev}`,
    `import.meta.env.PROD = ${c.prod}`,
    `VITE_API_URL    = ${c.viteApiUrl || '(blank)'}`,
    `VITE_TABLE_HOST = ${c.viteTableHost || '(blank)'}`,
    `onlineMode      = ${c.onlineMode}`,
  ].join('\n');
}

const LAN_IP_RE = /\b(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)\d/;

function stripSlash(s: string): string {
  return s.replace(/\/$/, '');
}

/**
 * True if a baked absolute origin leaked into the client (the host bug). An
 * origin-derived apiBase that EQUALS the page origin is healthy even on a LAN IP
 * — staleness means a non-blank VITE_* LAN IP, or apiBase pointing off-origin.
 */
export function clientConfigHasStaleLanIp(c: ClientConfigSnapshot): boolean {
  const bakedViteLanIp =
    (Boolean(c.viteApiUrl) && LAN_IP_RE.test(c.viteApiUrl)) ||
    (Boolean(c.viteTableHost) && LAN_IP_RE.test(c.viteTableHost));
  const apiOffOrigin =
    Boolean(c.apiBase) && Boolean(c.origin) && stripSlash(c.apiBase) !== stripSlash(c.origin);
  return bakedViteLanIp || apiOffOrigin;
}

/** Relative `/api/...` path in proxied dev mode; absolute URL otherwise. */
export function apiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && usesProxiedApi()) {
    return normalized;
  }
  return `${getApiBaseUrl()}${normalized}`;
}

/**
 * Online-mode resolver. A served host/production build is single-origin and
 * always online-capable, so it defaults to online unless VITE_ONLINE_MODE is
 * explicitly 'false'. Keys off MODE (reliable) — not DEV/PROD, which can be odd
 * in some host builds. Dev keeps its explicit VITE_ONLINE_MODE flag.
 */
export function resolveOnlineModeEnabled(env: {
  viteOnlineMode?: string;
  mode?: string;
  prod?: boolean;
}): boolean {
  const flag = env.viteOnlineMode?.trim().toLowerCase();
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  return env.mode === 'production' || Boolean(env.prod);
}

export function isOnlineModeEnabled(): boolean {
  return resolveOnlineModeEnabled({
    viteOnlineMode: import.meta.env.VITE_ONLINE_MODE as string | undefined,
    mode: import.meta.env.MODE,
    prod: Boolean(import.meta.env.PROD),
  });
}
