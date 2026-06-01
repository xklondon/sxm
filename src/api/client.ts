import { apiPath } from './config';

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
export const SESSION_CHECK_TIMEOUT_MS = 8_000;

async function apiFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(apiPath(path), {
      ...init,
      credentials: 'include',
      signal: init.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface AuthUser {
  userId: string;
  email: string;
  displayName?: string;
  role?: 'root' | 'admin' | 'host' | 'player' | 'guest';
  status?: 'invited' | 'active' | 'disabled';
  canLogin?: boolean;
  canOwnTables?: boolean;
  canPlay?: boolean;
  canInvite?: boolean;
  isRoot?: boolean;
}

export function isPeopleAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === 'root' || user?.role === 'admin';
}

export interface PersonRecord {
  id: string;
  email: string;
  displayName: string;
  status: 'invited' | 'active' | 'disabled';
  role: AuthUser['role'];
  canLogin: boolean;
  canOwnTables: boolean;
  canPlay: boolean;
  canInvite: boolean;
  createdAt: string;
  invitedAt: string | null;
  invitedBy: string | null;
  lastLoginAt: string | null;
}

export function isSessionCheckConnectivityError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return true;
  }
  const message = err.message.toLowerCase();
  return (
    message.includes('timed out') ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('load failed')
  );
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await apiFetch('/api/auth/me', {}, SESSION_CHECK_TIMEOUT_MS);
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Auth check failed (${res.status})`);
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function requestMagicLink(email: string): Promise<{ devLink?: string }> {
  const res = await apiFetch('/api/auth/request-magic-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Could not send magic link');
  }
  return data;
}

export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}

export async function createOnlineTable(displayName: string, name?: string) {
  const res = await apiFetch('/api/tables', {
    method: 'POST',
    body: JSON.stringify({ displayName, name }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Create table failed');
  }
  return data as { tableId: string; version: number; state: import('../types').GameState };
}

export async function joinOnlineTable(params: {
  tableId: string;
  inviteId: string;
  token: string;
  displayName: string;
}) {
  const res = await apiFetch('/api/tables/join', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Join failed');
  }
  return data as { tableId: string; version: number; state: import('../types').GameState };
}

export async function sendTableAction(
  tableId: string,
  type: string,
  payload: Record<string, unknown>,
  expectedVersion?: number,
) {
  const res = await apiFetch(`/api/tables/${tableId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ type, payload, expectedVersion }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Action failed');
  }
  return data as { state: import('../types').GameState; version: number };
}

export async function fetchTable(tableId: string) {
  const res = await apiFetch(`/api/tables/${tableId}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Could not load table');
  }
  return data as { tableId: string; version: number; state: import('../types').GameState };
}

export async function invitePersonToTable(
  tableId: string,
  email: string,
  displayName: string,
  role?: 'guest' | 'player',
): Promise<{ inviteId: string; joinUrl: string; personId: string }> {
  const res = await apiFetch(`/api/tables/${tableId}/invite-person`, {
    method: 'POST',
    body: JSON.stringify({ email, displayName, name: displayName, role }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Invite failed');
  }
  return data;
}

export async function fetchPeople(): Promise<PersonRecord[]> {
  const res = await apiFetch('/api/people');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Could not load people');
  }
  return data.people as PersonRecord[];
}

export async function addPerson(params: {
  email: string;
  displayName?: string;
  role?: PersonRecord['role'];
}): Promise<PersonRecord> {
  const res = await apiFetch('/api/people', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Could not add person');
  }
  return data.person as PersonRecord;
}

export async function updatePerson(
  personId: string,
  patch: Partial<
    Pick<
      PersonRecord,
      'displayName' | 'role' | 'status' | 'canOwnTables' | 'canPlay' | 'canInvite' | 'canLogin'
    >
  >,
): Promise<PersonRecord> {
  const res = await apiFetch(`/api/people/${personId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Update failed');
  }
  return data.person as PersonRecord;
}

export async function createServerInvite(
  tableId: string,
  email: string,
  name: string,
): Promise<{ inviteId: string; joinUrl: string }> {
  const res = await apiFetch(`/api/tables/${tableId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ email, name }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Invite failed');
  }
  return data;
}

export async function fetchInvitePreview(token: string): Promise<{
  invitedEmail: string;
  invitedName: string;
  tableId: string;
  tableName: string;
}> {
  const res = await apiFetch(`/api/tables/invites/preview?token=${encodeURIComponent(token)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Invalid invite');
  }
  return data.preview;
}

export async function sendPersonInvite(personId: string): Promise<{ devLink?: string }> {
  const res = await apiFetch(`/api/people/${personId}/send-invite`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Send invite failed');
  }
  return data;
}

export interface HostStatus {
  status: string;
  address: string;
  joinAddress: string;
  players: number;
  port: number;
  qrDataUrl: string | null;
}

export async function fetchHostStatus(): Promise<HostStatus> {
  const res = await apiFetch('/api/host/status');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Host status unavailable');
  }
  return data as HostStatus;
}
