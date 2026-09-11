import { isTestRuntime } from '../utils/devFlags';

export function buildInviteAuthResumePath(token: string): string {
  return `/join-table?token=${encodeURIComponent(token)}`;
}

export function isSafeInviteResumePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/join-table') || trimmed.includes('://')) {
    return false;
  }
  try {
    const url = new URL(trimmed, 'https://sxm.invalid');
    return url.pathname === '/join-table' && Boolean(url.searchParams.get('token'));
  } catch {
    return false;
  }
}

/** Accept relative `/join-table?token=` or a same-path absolute production URL. */
export function normalizeInviteReturnTo(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.startsWith('/')) {
    return isSafeInviteResumePath(trimmed) ? trimmed : null;
  }
  try {
    const url = new URL(trimmed);
    const path = `${url.pathname}${url.search}`;
    return isSafeInviteResumePath(path) ? path : null;
  } catch {
    return null;
  }
}

export function inviteTokenFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get('token');
}

export function resolvePostAuthInviteResume(input: {
  search: string;
  pendingJoin: string | null;
}): string | null {
  const params = new URLSearchParams(
    input.search.startsWith('?') ? input.search.slice(1) : input.search,
  );
  const fromReturnTo = normalizeInviteReturnTo(params.get('returnTo'));
  if (fromReturnTo) {
    return fromReturnTo;
  }
  const loginToken = params.get('token');
  if (loginToken) {
    return buildInviteAuthResumePath(loginToken);
  }
  if (input.pendingJoin) {
    const pendingToken = inviteTokenFromSearch(input.pendingJoin);
    if (pendingToken) {
      return input.pendingJoin.startsWith('?')
        ? `/join-table${input.pendingJoin}`
        : input.pendingJoin.startsWith('/join-table')
          ? input.pendingJoin
          : `/join-table?${input.pendingJoin}`;
    }
  }
  return null;
}

export function resolveLoginMagicReturnTo(input: {
  pathname: string;
  search: string;
}): string | null {
  const params = new URLSearchParams(
    input.search.startsWith('?') ? input.search.slice(1) : input.search,
  );
  const explicit = normalizeInviteReturnTo(params.get('returnTo'));
  if (explicit) {
    return explicit;
  }
  const isJoinPath = input.pathname === '/join-table' || input.pathname.endsWith('/join-table');
  if (isJoinPath) {
    const token = params.get('token');
    if (token) {
      return buildInviteAuthResumePath(token);
    }
  }
  return null;
}

export function logInviteAuthClient(
  stage: string,
  fields: Record<string, string | boolean | null | undefined>,
): void {
  if (isTestRuntime()) {
    return;
  }
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value === null ? '' : String(value)}`);
  console.info(`[SXM][invite-auth] stage=${stage}${parts.length ? ` ${parts.join(' ')}` : ''}`);
}
