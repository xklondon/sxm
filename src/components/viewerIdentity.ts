import type { GameState } from '../types';
import type { AuthUser } from '../api/client';
import { resolveViewerPersonId, type ViewerIdentityHints } from '../engine/session';
import {
  getStoredViewerPersonIdForTable,
  loadProfile,
  setStoredViewerPersonIdForTable,
} from '../storage/profileStorage';
import { isSeatedPersonAtTable } from '../engine/session';

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

/** Persist viewer person id when join or invite-email mapping identifies the seated player. */
export function syncStoredViewerPersonId(
  tableId: string,
  state: GameState,
  auth?: Pick<AuthUser, 'email' | 'displayName'> | null,
): void {
  if (!tableId.trim()) {
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
