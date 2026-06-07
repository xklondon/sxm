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
      return { ...local, target: null };
    }
    if (slot.playerId) {
      return { ...local, target: { kind: 'box', boxId: slot.playerId } };
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

  // User selection must survive transient resolve failures during sync/optimistic refresh.
  if (local.hasUserSelected) {
    return local;
  }

  if (!resolved) {
    return { ...local, target: null };
  }
  return local;
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
