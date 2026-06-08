import type { GameState } from '../types';
import type { AuthUser } from '../api/client';
import { resolveViewerPersonId, type ViewerIdentityHints, isSeatedPersonAtTable } from '../engine/session';
import {
  getStoredViewerPersonIdForTable,
  loadProfile,
  setStoredViewerPersonIdForTable,
} from '../storage/profileStorage';

export interface OnlineTableBootstrap {
  tableId: string;
  state: GameState;
  memberPersonId?: string | null;
}

export function buildViewerIdentityHints(
  _state: GameState,
  onlineTableId?: string | null,
  auth?: Pick<AuthUser, 'email' | 'displayName'> | null,
): ViewerIdentityHints {
  const profile = loadProfile();
  return {
    storedViewerPersonId: onlineTableId
      ? getStoredViewerPersonIdForTable(onlineTableId)
      : null,
    profileName: profile.name,
    profileEmail: profile.email,
    authEmail: auth?.email,
    authDisplayName: auth?.displayName ?? undefined,
  };
}

export function resolveViewerPersonIdForTable(
  state: GameState,
  onlineTableId?: string | null,
  auth?: Pick<AuthUser, 'email' | 'displayName'> | null,
): string | null {
  return resolveViewerPersonId(state, buildViewerIdentityHints(state, onlineTableId, auth));
}

/** Persist authoritative server member person id for online action visibility. */
export function applyOnlineTableBootstrap(bootstrap: OnlineTableBootstrap): void {
  const tableId = bootstrap.tableId.trim();
  if (!tableId) {
    return;
  }
  const memberPersonId = bootstrap.memberPersonId?.trim();
  if (memberPersonId && isSeatedPersonAtTable(bootstrap.state, memberPersonId)) {
    setStoredViewerPersonIdForTable(tableId, memberPersonId);
    return;
  }
  const fromHighlight = bootstrap.state.tableMeta.joinHighlight?.personId?.trim();
  if (fromHighlight && isSeatedPersonAtTable(bootstrap.state, fromHighlight)) {
    setStoredViewerPersonIdForTable(tableId, fromHighlight);
    return;
  }
  const fromNotice = bootstrap.state.tableMeta.tableNotice?.personId?.trim();
  if (fromNotice && isSeatedPersonAtTable(bootstrap.state, fromNotice)) {
    setStoredViewerPersonIdForTable(tableId, fromNotice);
  }
}

/** Persist viewer person id when join or invite-email mapping identifies the seated player. */
export function syncStoredViewerPersonId(
  tableId: string,
  state: GameState,
  auth?: Pick<AuthUser, 'email' | 'displayName'> | null,
  memberPersonId?: string | null,
): void {
  if (!tableId.trim()) {
    return;
  }
  if (memberPersonId?.trim() && isSeatedPersonAtTable(state, memberPersonId)) {
    setStoredViewerPersonIdForTable(tableId, memberPersonId);
    return;
  }
  const hints = buildViewerIdentityHints(state, tableId, auth);
  const existing = hints.storedViewerPersonId;
  if (existing && isSeatedPersonAtTable(state, existing)) {
    return;
  }
  const resolved = resolveViewerPersonId(state, hints);
  if (resolved) {
    setStoredViewerPersonIdForTable(tableId, resolved);
  }
}

export function personIdFromJoinedState(
  state: GameState,
  displayName: string,
): string | null {
  const fromHighlight = state.tableMeta.joinHighlight?.personId;
  if (fromHighlight) {
    return fromHighlight;
  }
  const fromNotice = state.tableMeta.tableNotice?.personId;
  if (fromNotice) {
    return fromNotice;
  }
  const trimmed = displayName.trim().toLowerCase();
  if (trimmed) {
    for (const id of state.tableMeta.playerOrder ?? []) {
      const p = state.players[id];
      const label = (p?.controllerName?.trim() || p?.displayName || '').toLowerCase();
      if (label === trimmed) {
        return id;
      }
    }
  }
  return null;
}
