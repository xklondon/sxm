import type { GameState } from '../types';
import type { PlaceBetTarget } from '../engine/blackjack/chipPlacement';
import { getAssignedSlotForPerson } from '../engine/session/playerAssignment';
import {
  isSlotOnTable,
  resolveOccupantBoxIdForSlot,
  resolvePlaceBetPayloadTarget,
  type LocalChipSlotTarget,
  uiBettingFocusFromSlotTarget,
} from './blackjackBoxPlacementContract';
import { isVerboseDevLogging } from '../utils/devFlags';

/** Canonical local-only chip tray target — slotNumber is the only stable anchor. */
export interface LocalSelectedChipTarget {
  target: LocalChipSlotTarget | null;
  /** True after any explicit box/slot tap; blocks assigned default overwrite. */
  hasUserSelected: boolean;
}

export function createEmptyLocalChipTarget(): LocalSelectedChipTarget {
  return { target: null, hasUserSelected: false };
}

export function uiFromLocalChipTarget(
  target: LocalChipSlotTarget | null,
  state: GameState,
): {
  selectedBettingBoxId: string | null;
  selectedBettingSlotNumber: number | null;
} {
  return uiBettingFocusFromSlotTarget(state, target);
}

export function selectLocalChipTarget(
  _local: LocalSelectedChipTarget,
  slotNumber: number,
): LocalSelectedChipTarget {
  return { target: { slotNumber }, hasUserSelected: true };
}

/** Initial assigned slot — only before any user selection. */
export function applyDefaultAssignedChipTarget(
  local: LocalSelectedChipTarget,
  state: GameState,
  viewerPersonId: string | null,
): LocalSelectedChipTarget {
  if (local.hasUserSelected || local.target) {
    return local;
  }
  const slotNumber = viewerPersonId ? getAssignedSlotForPerson(state, viewerPersonId) : null;
  if (slotNumber == null || !isSlotOnTable(state, slotNumber)) {
    return local;
  }
  return { ...local, target: { slotNumber } };
}

/** True only when the selected slot row is genuinely gone. */
export function isUserChipTargetRemoved(state: GameState, slotNumber: number): boolean {
  return !isSlotOnTable(state, slotNumber);
}

/** Preserve slotNumber anchor across server reconcile — never flip to boxId in local state. */
export function reconcileLocalChipTarget(
  local: LocalSelectedChipTarget,
  state: GameState,
  _online: boolean,
): LocalSelectedChipTarget {
  if (!local.target) {
    return local;
  }
  if (isUserChipTargetRemoved(state, local.target.slotNumber)) {
    return local.hasUserSelected ? local : { ...local, target: null };
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

export type ChipBetDiagnosticStage =
  | 'tap-target'
  | 'coerce'
  | 'payload'
  | 'optimistic'
  | 'reconcile'
  | 'error';

export interface ChipBetDiagnostic {
  stage: ChipBetDiagnosticStage;
  selectedTarget: LocalChipSlotTarget | null;
  payload?: Record<string, unknown>;
  optimisticBoxId?: string | null;
  slotNumber?: number | null;
  message?: string;
}

/** Dev/test diagnostic for rapid chip tap investigations. */
export function logChipBetDiagnostic(detail: ChipBetDiagnostic): void {
  if (!isVerboseDevLogging()) {
    return;
  }
  console.debug('[SXMCards][chip-bet]', detail);
}

export function localChipTargetSlotNumber(
  state: GameState,
  target: LocalChipSlotTarget | PlaceBetTarget,
): number | null {
  if ('slotNumber' in target && !('kind' in target)) {
    return target.slotNumber;
  }
  const placeTarget = target as PlaceBetTarget;
  if (placeTarget.kind === 'slot') {
    return placeTarget.slotNumber;
  }
  const slot = state.tableMeta.boxSlots.find((s) => s.playerId === placeTarget.boxId);
  if (slot) {
    return slot.slotNumber;
  }
  return state.session.boxSlotNumbers?.[placeTarget.boxId] ?? null;
}

function isTargetOnVisibleBox(state: GameState, slotNumber: number, visibleBoxCount: number): boolean {
  return slotNumber >= 1 && slotNumber <= visibleBoxCount && isSlotOnTable(state, slotNumber);
}

export type ChipTargetResolutionReason =
  | 'no-local-target'
  | 'tray-resolution-null'
  | 'hidden-box-filter';

export type ChipTargetBettingSource = 'ref' | 'state' | 'merged' | 'drop';

export type GetCurrentChipTargetForBettingResult =
  | { ok: true; slotNumber: number; source: ChipTargetBettingSource }
  | { ok: false; reason: ChipTargetResolutionReason; source: ChipTargetBettingSource | null };

/** Prefer synchronous ref over possibly stale React state during rapid tray taps. */
export function mergeLocalChipTargetRefAndState(
  ref: LocalSelectedChipTarget,
  state: LocalSelectedChipTarget,
): LocalSelectedChipTarget {
  if (ref.hasUserSelected && ref.target) {
    return ref;
  }
  if (state.hasUserSelected && state.target) {
    return state;
  }
  if (ref.target) {
    return {
      target: ref.target,
      hasUserSelected: ref.hasUserSelected || state.hasUserSelected,
    };
  }
  return state;
}

/** Dev/test logging when chip tray target resolves to null. */
export function logChipTargetResolution(
  reason: ChipTargetResolutionReason,
  details: {
    selectedBettingBoxId: string | null;
    selectedBettingSlotNumber: number | null;
    hasUserSelected: boolean;
    visibleBoxCount?: number;
    resolvedSlotNumber?: number | null;
  },
): void {
  if (!isVerboseDevLogging()) {
    return;
  }
  console.debug('[SXMCards][chip-target]', reason, details);
}

export interface GetCurrentChipTargetForBettingInput {
  ref: LocalSelectedChipTarget;
  state: LocalSelectedChipTarget;
  gameState: GameState;
  online: boolean;
  viewerPersonId: string | null;
  visibleBoxCount?: number;
  explicitDropSlotNumber?: number | null;
}

/**
 * Canonical chip tray / drop target for betting — reads ref first, then state fallback.
 * Never uses selectedSeatId. Local state is slotNumber-only; boxId derived at payload time.
 */
export function getCurrentChipTargetForBetting(
  input: GetCurrentChipTargetForBettingInput,
): GetCurrentChipTargetForBettingResult {
  if (input.explicitDropSlotNumber != null) {
    return { ok: true, slotNumber: input.explicitDropSlotNumber, source: 'drop' };
  }

  const merged = mergeLocalChipTargetRefAndState(input.ref, input.state);
  const source: ChipTargetBettingSource =
    input.ref.hasUserSelected && input.ref.target
      ? 'ref'
      : input.state.hasUserSelected && input.state.target
        ? 'state'
        : 'merged';

  const slotNumber = resolveCurrentChipTargetSlot({
    local: merged,
    state: input.gameState,
    online: input.online,
    viewerPersonId: input.viewerPersonId,
    visibleBoxCount: input.visibleBoxCount,
  });

  if (slotNumber == null) {
    const ui = uiFromLocalChipTarget(merged.target, input.gameState);
    const reason: ChipTargetResolutionReason =
      merged.target || merged.hasUserSelected ? 'tray-resolution-null' : 'no-local-target';
    logChipTargetResolution(reason, {
      ...ui,
      hasUserSelected: merged.hasUserSelected,
      visibleBoxCount: input.visibleBoxCount,
    });
    return { ok: false, reason, source };
  }

  return { ok: true, slotNumber, source };
}

export function resolveCurrentChipTargetSlot(input: ResolveCurrentChipTargetInput): number | null {
  const { local, state, viewerPersonId, visibleBoxCount } = input;
  const slotNumber = resolveTraySlotFromLocalSelection(local, state, viewerPersonId);
  if (slotNumber == null) {
    const ui = uiFromLocalChipTarget(local.target, state);
    logChipTargetResolution(
      local.target || local.hasUserSelected ? 'tray-resolution-null' : 'no-local-target',
      {
        ...ui,
        hasUserSelected: local.hasUserSelected,
        visibleBoxCount,
      },
    );
    return null;
  }

  if (
    visibleBoxCount != null &&
    !local.hasUserSelected &&
    !isTargetOnVisibleBox(state, slotNumber, visibleBoxCount)
  ) {
    const ui = uiFromLocalChipTarget(local.target, state);
    logChipTargetResolution('hidden-box-filter', {
      ...ui,
      hasUserSelected: local.hasUserSelected,
      visibleBoxCount,
      resolvedSlotNumber: slotNumber,
    });
    return null;
  }
  return slotNumber;
}

/** After a successful bet, lock the same slot for repeat tray taps. */
export function affirmChipTargetAfterPlacement(
  local: LocalSelectedChipTarget,
  state: GameState,
  placedSlotNumber: number,
  _online: boolean,
): LocalSelectedChipTarget {
  if (!isSlotOnTable(state, placedSlotNumber)) {
    return local;
  }
  return selectLocalChipTarget(local, placedSlotNumber);
}

/**
 * Chip tray target resolution:
 * 1. explicit local selected slot
 * 2. initial assigned slot ONLY if user has never selected
 * 3. otherwise null
 */
export function resolveTraySlotFromLocalSelection(
  local: LocalSelectedChipTarget,
  state: GameState,
  viewerPersonId: string | null,
): number | null {
  if (local.target) {
    if (isSlotOnTable(state, local.target.slotNumber)) {
      return local.target.slotNumber;
    }
    return null;
  }

  if (local.hasUserSelected) {
    return null;
  }

  const withDefault = applyDefaultAssignedChipTarget(local, state, viewerPersonId);
  return withDefault.target?.slotNumber ?? null;
}

/** @deprecated Use resolvePlaceBetPayloadTarget from blackjackBoxPlacementContract. */
export function resolveOnlinePlaceBetPayloadTarget(
  state: GameState,
  target: PlaceBetTarget,
  online: boolean,
  inFlightForSlot = false,
): PlaceBetTarget {
  const slotNumber = localChipTargetSlotNumber(state, target);
  if (slotNumber == null) {
    return target;
  }
  return resolvePlaceBetPayloadTarget(state, slotNumber, online, inFlightForSlot);
}

/** @deprecated Slot-only local targets — kept for migration tests. */
export function anchorOnlineChipTarget(
  _state: GameState,
  target: PlaceBetTarget,
  _online: boolean,
): PlaceBetTarget {
  return target;
}

/** @deprecated Slot-only local targets — derive occupant at payload time instead. */
export function degradeChipTargetToSlot(
  state: GameState,
  target: PlaceBetTarget,
): PlaceBetTarget | null {
  const slotNumber = localChipTargetSlotNumber(state, target);
  if (slotNumber == null) {
    return null;
  }
  const boxId = resolveOccupantBoxIdForSlot(state, slotNumber);
  if (boxId) {
    return { kind: 'box', boxId };
  }
  return { kind: 'slot', slotNumber };
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
  return ta.slotNumber === tb.slotNumber;
}

/** Resolve PlaceBetTarget for drop handlers that still emit box/slot union. */
export function resolvePlaceBetTargetForSlotNumber(
  state: GameState,
  slotNumber: number,
  online: boolean,
  inFlightForSlot = false,
): PlaceBetTarget {
  return resolvePlaceBetPayloadTarget(state, slotNumber, online, inFlightForSlot);
}

/** @deprecated Use resolveCurrentChipTargetSlot — derives PlaceBetTarget at payload time. */
export function resolveCurrentChipTarget(input: ResolveCurrentChipTargetInput): PlaceBetTarget | null {
  const slotNumber = resolveCurrentChipTargetSlot(input);
  if (slotNumber == null) {
    return null;
  }
  return resolvePlaceBetPayloadTarget(input.state, slotNumber, input.online, false);
}

/** @deprecated Use resolveTraySlotFromLocalSelection — derives PlaceBetTarget at payload time. */
export function resolveTrayTargetFromLocalSelection(
  local: LocalSelectedChipTarget,
  state: GameState,
  online: boolean,
  viewerPersonId: string | null,
): PlaceBetTarget | null {
  const slotNumber = resolveTraySlotFromLocalSelection(local, state, viewerPersonId);
  if (slotNumber == null) {
    return null;
  }
  return resolvePlaceBetPayloadTarget(state, slotNumber, online, false);
}
