import type { GameState } from '../types';
import type { ChipValue } from './ChipStack';
import type { PlaceBetTarget } from '../engine/blackjack/chipPlacement';
import { getStakeChipsForBox } from '../engine/blackjack/stakes';

/** Stable UI anchor for arc box slots — never use boxId as a React key. */
export interface LocalChipSlotTarget {
  slotNumber: number;
}

export function slotArcReactKey(slotNumber: number): string {
  return `slot-${slotNumber}`;
}

export function resolveOccupantBoxIdForSlot(
  state: GameState,
  slotNumber: number,
): string | null {
  return state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber)?.playerId ?? null;
}

export function uiBettingFocusFromSlotTarget(
  state: GameState,
  target: LocalChipSlotTarget | null,
): {
  selectedBettingBoxId: string | null;
  selectedBettingSlotNumber: number | null;
} {
  if (!target) {
    return { selectedBettingBoxId: null, selectedBettingSlotNumber: null };
  }
  return {
    selectedBettingBoxId: resolveOccupantBoxIdForSlot(state, target.slotNumber),
    selectedBettingSlotNumber: target.slotNumber,
  };
}

/** Derive engine placeBet payload target at send time — local state stores slotNumber only. */
export function resolvePlaceBetPayloadTarget(
  state: GameState,
  slotNumber: number,
  online: boolean,
  inFlightForSlot = false,
): PlaceBetTarget {
  const row = state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber);
  if (!row) {
    throw new Error(`Invalid slot ${slotNumber}`);
  }
  if (online && inFlightForSlot) {
    return { kind: 'slot', slotNumber };
  }
  if (row.playerId) {
    return { kind: 'box', boxId: row.playerId };
  }
  return { kind: 'slot', slotNumber };
}

export function slotNumberFromPlaceBetTarget(
  state: GameState,
  target: PlaceBetTarget,
): number | null {
  if (target.kind === 'slot') {
    return target.slotNumber;
  }
  const slot = state.tableMeta.boxSlots.find((s) => s.playerId === target.boxId);
  if (slot) {
    return slot.slotNumber;
  }
  return state.session.boxSlotNumbers?.[target.boxId] ?? null;
}

export function mergeStakeChipsForSlotDisplay(
  state: GameState,
  _slotNumber: number,
  boxId: string | null,
  pendingChips: readonly ChipValue[],
): ChipValue[] {
  if (boxId) {
    return getStakeChipsForBox(state, boxId);
  }
  return [...pendingChips];
}

export function isSlotOnTable(state: GameState, slotNumber: number): boolean {
  return state.tableMeta.boxSlots.some((s) => s.slotNumber === slotNumber);
}
