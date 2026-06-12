import type { GameState } from '../types';
import { formatBlackjackCountByBoxLabel } from '../engine/session/tableBlackjackStats';

/** Occupied box slot numbers for blackjack counter display. */
export function occupiedBoxSlotNumbers(state: GameState): number[] {
  return state.tableMeta.boxSlots
    .filter((slot) => slot.playerId !== null)
    .map((slot) => slot.slotNumber)
    .sort((a, b) => a - b);
}

export function buildBlackjackCountByBoxDisplay(state: GameState): string {
  return formatBlackjackCountByBoxLabel(
    state.tableMeta.blackjackCountBySlot,
    occupiedBoxSlotNumbers(state),
  );
}
