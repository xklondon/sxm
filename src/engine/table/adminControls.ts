import type { GameState } from '../../types';
import type { TableAdminSettings } from '../../types/admin';
import { DEFAULT_TABLE_ADMIN_SETTINGS } from '../../types/admin';
import { isTableOwner } from '../session/tokens';

export function getTableAdminSettings(state: GameState): TableAdminSettings {
  return state.tableAdminSettings ?? DEFAULT_TABLE_ADMIN_SETTINGS;
}

export function updateTableAdminSettings(
  state: GameState,
  patch: Partial<TableAdminSettings>,
): GameState {
  return {
    ...state,
    tableAdminSettings: {
      ...getTableAdminSettings(state),
      ...patch,
    },
  };
}

export function canUserAssignChips(state: GameState, personName: string): boolean {
  const admin = getTableAdminSettings(state);
  if (admin.ownerOnlyCanAssignChips) {
    return isTableOwner(state, personName);
  }
  return true;
}

export function canUserChangeProtocol(state: GameState, personName: string): boolean {
  if (state.tableMeta.protocolLocked) {
    return false;
  }
  const admin = getTableAdminSettings(state);
  if (admin.ownerOnlyCanChangeProtocol) {
    return isTableOwner(state, personName);
  }
  return true;
}

export function canUserChangeDesign(state: GameState, personName: string): boolean {
  const admin = getTableAdminSettings(state);
  if (admin.ownerOnlyCanChangeDesign) {
    return isTableOwner(state, personName);
  }
  return true;
}

export function canUserInvite(state: GameState, personName: string): boolean {
  if (isTableOwner(state, personName)) {
    return true;
  }
  return getTableAdminSettings(state).allowInvitedPlayersToInvite;
}

export function canUserStartTable(state: GameState, personName: string): boolean {
  if (isTableOwner(state, personName)) {
    return true;
  }
  return getTableAdminSettings(state).allowInvitedPlayersToStartTables;
}

export function canUserResetTable(state: GameState, personName: string): boolean {
  return isTableOwner(state, personName);
}

/** Canonical reset/new-game permission — prefers ownerPersonId over display-name match. */
export function canViewerResetTable(
  state: GameState,
  viewerPersonId: string | null | undefined,
  fallbackControllerName?: string,
): boolean {
  const ownerPersonId = state.tableMeta.ownerPersonId;
  if (ownerPersonId && viewerPersonId) {
    return viewerPersonId === ownerPersonId;
  }
  if (fallbackControllerName?.trim()) {
    return isTableOwner(state, fallbackControllerName);
  }
  return false;
}
