import type { GameState } from '../types';
import type { PlaceBetTarget } from '../engine/blackjack/chipPlacement';
import { getChipPlacementTargetFromBoxId } from '../engine/blackjack/chipPlacement';
import {
  resolveLocalChipTrayTarget,
  resolveViewerAssignedBoxPlayerId,
  shouldClearExplicitChipTarget,
} from './chipTargetSelection';

/** Canonical local-only chip tray target — never synced to engine/backend. */
export interface LocalSelectedChipTarget {
  target: PlaceBetTarget | null;
  /** True after any explicit box/slot tap; blocks assigned default overwrite. */
  hasUserSelected: boolean;
}

export function createEmptyLocalChipTarget(): LocalSelectedChipTarget {
  return { target: null, hasUserSelected: false };
}

export function uiFromLocalChipTarget(target: PlaceBetTarget | null): {
  selectedBettingBoxId: string | null;
  selectedBettingSlotNumber: number | null;
} {
  if (!target) {
    return { selectedBettingBoxId: null, selectedBettingSlotNumber: null };
  }
  if (target.kind === 'box') {
    return { selectedBettingBoxId: target.boxId, selectedBettingSlotNumber: null };
  }
  return { selectedBettingBoxId: null, selectedBettingSlotNumber: target.slotNumber };
}

export function selectLocalChipTarget(
  _local: LocalSelectedChipTarget,
  target: PlaceBetTarget,
): LocalSelectedChipTarget {
  return { target, hasUserSelected: true };
}

/** Initial assigned box — only before any user selection. */
export function applyDefaultAssignedChipTarget(
  local: LocalSelectedChipTarget,
  state: GameState,
  viewerPersonId: string | null,
): LocalSelectedChipTarget {
  if (local.hasUserSelected || local.target) {
    return local;
  }
  const boxId = resolveViewerAssignedBoxPlayerId(state, viewerPersonId);
  if (!boxId) {
    return local;
  }
  return { ...local, target: { kind: 'box', boxId } };
}

function resolveTargetOnTable(
  state: GameState,
  target: PlaceBetTarget,
  online: boolean,
): PlaceBetTarget | null {
  if (target.kind === 'slot') {
    const slot = state.tableMeta.boxSlots.find((s) => s.slotNumber === target.slotNumber);
    if (!slot) {
      return null;
    }
    if (slot.playerId) {
      return { kind: 'box', boxId: slot.playerId };
    }
    return target;
  }

  try {
    return getChipPlacementTargetFromBoxId(state, target.boxId, online);
  } catch {
    return resolveLocalChipTrayTarget(state, {
      userPicked: true,
      explicit: target,
      online,
    });
  }
}

/** Rebind a user-selected box to the current occupant at its mapped slot (online id rotation). */
function rebindUserBoxTarget(state: GameState, boxId: string): PlaceBetTarget | null {
  const slotNum = state.session.boxSlotNumbers?.[boxId];
  if (slotNum == null) {
    return null;
  }
  const row = state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNum);
  if (!row) {
    return null;
  }
  if (row.playerId) {
    return { kind: 'box', boxId: row.playerId };
  }
  return { kind: 'slot', slotNumber: slotNum };
}

/** True only when the selected row is genuinely gone — not during transient online sync. */
export function isUserChipTargetRemoved(
  state: GameState,
  target: PlaceBetTarget,
  online: boolean,
): boolean {
  if (target.kind === 'slot') {
    return !state.tableMeta.boxSlots.some((s) => s.slotNumber === target.slotNumber);
  }

  if (state.tableMeta.boxSlots.some((s) => s.playerId === target.boxId)) {
    return false;
  }

  const slotNum = state.session.boxSlotNumbers?.[target.boxId];
  if (slotNum != null && state.tableMeta.boxSlots.some((s) => s.slotNumber === slotNum)) {
    return false;
  }

  if (!online && state.players[target.boxId]) {
    return false;
  }

  return true;
}

/** Upgrade materialized slots; clear only when the target row is truly gone. */
export function reconcileLocalChipTarget(
  local: LocalSelectedChipTarget,
  state: GameState,
  online: boolean,
): LocalSelectedChipTarget {
  if (!local.target) {
    return local;
  }

  const currentTarget = local.target;

  if (currentTarget.kind === 'slot') {
    const slot = state.tableMeta.boxSlots.find((s) => s.slotNumber === currentTarget.slotNumber);
    if (!slot) {
      return local.hasUserSelected ? local : { ...local, target: null };
    }
    if (slot.playerId) {
      return { ...local, target: { kind: 'box', boxId: slot.playerId } };
    }
    return local;
  }

  if (local.hasUserSelected) {
    const rebound = rebindUserBoxTarget(state, currentTarget.boxId);
    if (rebound) {
      if (rebound.kind === 'box' && rebound.boxId !== currentTarget.boxId) {
        return { ...local, target: rebound };
      }
      if (rebound.kind === 'slot') {
        return { ...local, target: rebound };
      }
    }
    if (isUserChipTargetRemoved(state, currentTarget, online)) {
      return local;
    }
    return local;
  }

  if (shouldClearExplicitChipTarget(state, currentTarget, online)) {
    return { ...local, target: null };
  }

  const resolved = resolveTargetOnTable(state, currentTarget, online);
  if (
    resolved?.kind === 'box' &&
    currentTarget.kind === 'box' &&
    resolved.boxId !== currentTarget.boxId
  ) {
    return { ...local, target: resolved };
  }

  if (!resolved) {
    return local;
  }
  return local;
}

export interface ResolveCurrentChipTargetInput {
  local: LocalSelectedChipTarget;
  state: GameState;
  online: boolean;
  viewerPersonId: string | null;
  visibleBoxCount?: number;
}

function isTargetOnVisibleBox(
  state: GameState,
  target: PlaceBetTarget,
  visibleBoxCount: number,
): boolean {
  if (target.kind === 'slot') {
    return target.slotNumber >= 1 && target.slotNumber <= visibleBoxCount;
  }
  const slot = state.tableMeta.boxSlots.find((s) => s.playerId === target.boxId);
  if (slot) {
    return slot.slotNumber <= visibleBoxCount;
  }
  const slotNum = state.session.boxSlotNumbers?.[target.boxId];
  return slotNum != null && slotNum >= 1 && slotNum <= visibleBoxCount;
}

/**
 * Canonical chip tray/drop target — local selection only, never selectedSeatId.
 * Falls back to assigned box only before any user pick; survives transient sync gaps.
 */
export function resolveCurrentChipTarget(input: ResolveCurrentChipTargetInput): PlaceBetTarget | null {
  const { local, state, online, viewerPersonId, visibleBoxCount } = input;
  const target = resolveTrayTargetFromLocalSelection(local, state, online, viewerPersonId);
  if (!target) {
    return null;
  }
  if (visibleBoxCount != null && !isTargetOnVisibleBox(state, target, visibleBoxCount)) {
    return null;
  }
  return target;
}

/** After a successful bet, lock the same target and mark it user-selected for repeat tray taps. */
export function affirmChipTargetAfterPlacement(
  local: LocalSelectedChipTarget,
  state: GameState,
  placedTarget: PlaceBetTarget,
  online: boolean,
): LocalSelectedChipTarget {
  const picked = selectLocalChipTarget(local, placedTarget);
  const reconciled = reconcileLocalChipTarget(picked, state, online);
  const seed = reconciled.target ?? placedTarget;
  const resolved = resolveTargetOnTable(state, seed, online) ?? seed;
  return selectLocalChipTarget(reconciled, resolved);
}

/**
 * Chip tray target resolution:
 * 1. explicit local selected target
 * 2. initial assigned/default ONLY if user has never selected
 * 3. otherwise null
 */
export function resolveTrayTargetFromLocalSelection(
  local: LocalSelectedChipTarget,
  state: GameState,
  online: boolean,
  viewerPersonId: string | null,
): PlaceBetTarget | null {
  if (local.target) {
    if (local.hasUserSelected) {
      const resolved = resolveLocalChipTrayTarget(state, {
        userPicked: true,
        explicit: local.target,
        online,
      });
      if (resolved) {
        return resolved;
      }
      const fallback = resolveTargetOnTable(state, local.target, online);
      return fallback ?? local.target;
    }

    const resolved = resolveTargetOnTable(state, local.target, online);
    if (resolved) {
      return resolved;
    }
  }

  if (local.hasUserSelected) {
    return null;
  }

  const withDefault = applyDefaultAssignedChipTarget(local, state, viewerPersonId);
  if (!withDefault.target) {
    return null;
  }
  return resolveTargetOnTable(state, withDefault.target, online);
}

export function localChipTargetsEqual(
  a: LocalSelectedChipTarget,
  b: LocalSelectedChipTarget,
): boolean {
  if (a.hasUserSelected !== b.hasUserSelected) {
    return false;
  }
  const ta = a.target;
  const tb = b.target;
  if (ta === tb) {
    return true;
  }
  if (!ta || !tb) {
    return ta === tb;
  }
  if (ta.kind !== tb.kind) {
    return false;
  }
  if (ta.kind === 'box' && tb.kind === 'box') {
    return ta.boxId === tb.boxId;
  }
  if (ta.kind === 'slot' && tb.kind === 'slot') {
    return ta.slotNumber === tb.slotNumber;
  }
  return false;
}
