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
    return {
      baseUrl: configured?.replace(/\/$/, '') || params.pageOrigin,
      proxied: false,
    };
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

/** Relative `/api/...` path in proxied dev mode; absolute URL otherwise. */
export function apiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && usesProxiedApi()) {
    return normalized;
  }
  return `${getApiBaseUrl()}${normalized}`;
}

export function isOnlineModeEnabled(): boolean {
  return import.meta.env.VITE_ONLINE_MODE === 'true';
}
