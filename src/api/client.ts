import { apiPath } from './config';
import { AuthFetchError, authErrorCodeFromBody } from '../auth/authErrors';

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
  return user?.isRoot === true || user?.role === 'root' || user?.role === 'admin';
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
  if (res.status === 401 || res.status === 404) {
    return null;
  }
  if (res.status === 403) {
    let body: { error?: string; code?: string } = {};
    try {
      body = (await res.json()) as { error?: string; code?: string };
    } catch {
      /* ignore */
    }
    throw new AuthFetchError(
      403,
      body.error ?? 'Access required — ask an admin for an invite.',
      authErrorCodeFromBody(body),
    );
  }
  if (!res.ok) {
    throw new AuthFetchError(res.status, `Auth check failed (${res.status})`);
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function requestMagicLink(
  email: string,
  rememberMe = true,
): Promise<{ devLink?: string }> {
  const res = await apiFetch('/api/auth/request-magic-link', {
    method: 'POST',
    body: JSON.stringify({ email, rememberMe }),
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

export interface OnlineTablePayload {
  tableId: string;
  version: number;
  state: import('../types').GameState;
  memberPersonId: string;
}

export async function createOnlineTable(displayName: string, name?: string) {
  const res = await apiFetch('/api/tables', {
    method: 'POST',
    body: JSON.stringify({ displayName, name }),
  });
  const data = (await res.json()) as { error?: string; code?: string };
  if (res.status === 401 || res.status === 403) {
    throw new AuthFetchError(
      res.status,
      data.error ?? 'Create table failed',
      authErrorCodeFromBody(data),
    );
  }
  if (!res.ok) {
    throw new Error(data.error ?? 'Create table failed');
  }
  return data as OnlineTablePayload;
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
  return data as OnlineTablePayload;
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
    if (res.status === 403 && (data as { code?: string }).code === 'TABLE_NOT_MEMBER') {
      throw new TableMembershipError(tableId, data.error ?? 'Not a member of this table');
    }
    throw new Error(data.error ?? 'Action failed');
  }
  return data as { state: import('../types').GameState; version: number };
}

export class TableNotFoundError extends Error {
  readonly tableId: string;
  readonly status = 404;

  constructor(tableId: string, message = 'Table not found') {
    super(message);
    this.name = 'TableNotFoundError';
    this.tableId = tableId;
  }
}

export class TableMembershipError extends Error {
  readonly tableId: string;
  readonly status = 403;
  readonly code = 'TABLE_NOT_MEMBER';

  constructor(tableId: string, message = 'Not a member of this table') {
    super(message);
    this.name = 'TableMembershipError';
    this.tableId = tableId;
    this.code = 'TABLE_NOT_MEMBER';
  }
}

export async function fetchMyTables(): Promise<import('../types/activeTables').ActiveTableSummary[]> {
  const res = await apiFetch('/api/tables/mine');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Could not load active tables');
  }
  return data.tables as import('../types/activeTables').ActiveTableSummary[];
}

export async function fetchActiveTables(): Promise<import('../types/activeTables').ActiveTableSummary[]> {
  const res = await apiFetch('/api/tables/active');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Could not load active tables');
  }
  return data.tables as import('../types/activeTables').ActiveTableSummary[];
}

export async function requestTableAccess(tableId: string, displayName: string): Promise<{ requestId: string }> {
  const res = await apiFetch(`/api/tables/${tableId}/request-access`, {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Could not request access');
  }
  return data as { requestId: string };
}

export async function fetchTable(tableId: string) {
  const res = await apiFetch(`/api/tables/${tableId}`);
  const data = (await res.json()) as { error?: string; code?: string };
  if (res.status === 403 && data.code === 'TABLE_NOT_MEMBER') {
    throw new TableMembershipError(tableId, data.error ?? 'Not a member of this table');
  }
  if (res.status === 404) {
    throw new TableNotFoundError(tableId, data.error ?? 'Table not found');
  }
  if (!res.ok) {
    throw new Error(data.error ?? 'Could not load table');
  }
  return data as OnlineTablePayload;
}

export async function invitePersonToTable(
  tableId: string,
  email: string,
  displayName: string,
  role?: 'guest' | 'player',
  inviteMessage?: string,
): Promise<{ inviteId: string; joinUrl: string; personId: string; emailSent: boolean }> {
  const res = await apiFetch(`/api/tables/${tableId}/invite-person`, {
    method: 'POST',
    body: JSON.stringify({ email, displayName, name: displayName, role, inviteMessage }),
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
}): Promise<{ person: PersonRecord; devLink?: string }> {
  const res = await apiFetch('/api/people', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (res.status === 502 && data.person) {
    const err = new Error(
      data.error ?? 'Person was added, but the invite email could not be sent.',
    ) as Error & { person: PersonRecord; inviteEmailFailed: true };
    err.person = data.person as PersonRecord;
    err.inviteEmailFailed = true;
    throw err;
  }
  if (!res.ok) {
    throw new Error(data.error ?? 'Could not add person');
  }
  return { person: data.person as PersonRecord, devLink: data.devLink as string | undefined };
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
): Promise<{ inviteId: string; joinUrl: string; emailSent?: boolean }> {
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
