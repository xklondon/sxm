import type { GameState } from '../../types';
import { getRunningBoxSlotsForPerson, getCoBoxSlotsForPerson } from './tableBoxDisplay';
import { getCallerPersonIdForBox } from './playerAssignment';
import { listPersonBankrollOwnerIds } from './bankroll';

/**
 * Clear per-round box command / stake ownership while preserving permanent table
 * seating (nativeAssignedPersonId, assignedBoxByPersonId, playerOrder, chips).
 * Call once when returning to open betting after a completed round.
 */
export function resetBlackjackRoundOwnership(state: GameState): GameState {
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes: {},
      bettingLocked: false,
      boxSlots: state.tableMeta.boxSlots.map((slot) => ({
        ...slot,
        callerPersonId: null,
      })),
    },
  };
}

/** Test helper — no temporary commander or round stake residue after reset. */
export function hasNoRoundBoxOwnershipResidue(state: GameState): boolean {
  for (const slot of state.tableMeta.boxSlots) {
    if (slot.callerPersonId) {
      return false;
    }
    if (slot.playerId && state.tableMeta.boxStakes[slot.playerId]) {
      return false;
    }
  }
  for (const boxId of Object.keys(state.tableMeta.boxStakes)) {
    const stake = state.tableMeta.boxStakes[boxId];
    if (stake && stake.amount > 0) {
      return false;
    }
  }
  for (const slot of state.tableMeta.boxSlots) {
    if (!slot.playerId) {
      continue;
    }
    if (getCallerPersonIdForBox(state, slot.playerId)) {
      return false;
    }
  }
  for (const personId of listPersonBankrollOwnerIds(state)) {
    if (getRunningBoxSlotsForPerson(state, personId).length > 0) {
      return false;
    }
    if (getCoBoxSlotsForPerson(state, personId).length > 0) {
      return false;
    }
  }
  const round = state.blackjack;
  if (round?.activeHandKey) {
    return false;
  }
  return true;
}
