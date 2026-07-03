import type { GameState } from '../../types';
import { getRunningBoxSlotsForPerson, getCoBoxSlotsForPerson } from './tableBoxDisplay';
import { getCallerPersonIdForBox } from './playerAssignment';
import { listPersonBankrollOwnerIds } from './bankroll';

/**
 * Clear temporary round commanders (callerPersonId) while preserving open stakes
 * for round-complete review. Native assignments are untouched.
 */
export function clearTemporaryBoxCommandState(state: GameState): GameState {
  const boxStakes: GameState['tableMeta']['boxStakes'] = {};
  for (const [boxId, entry] of Object.entries(state.tableMeta.boxStakes)) {
    if (!entry) {
      continue;
    }
    const { callerPersonId: _caller, ...rest } = entry;
    boxStakes[boxId] = rest;
  }
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes,
      boxSlots: state.tableMeta.boxSlots.map((slot) => ({
        ...slot,
        callerPersonId: null,
      })),
    },
  };
}

/**
 * Clear per-round box command / stake ownership while preserving permanent table
 * seating (nativeAssignedPersonId, assignedBoxByPersonId, playerOrder, chips).
 * Call once when returning to open betting after a completed round.
 */
export function resetBlackjackRoundOwnership(state: GameState): GameState {
  return clearTemporaryBoxCommandState({
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes: {},
      bettingLocked: false,
    },
  });
}

/** Canonical post-round reset — open betting with no round-only commander/stake residue. */
export function resetBlackjackRoundForBetting(state: GameState): GameState {
  return resetBlackjackRoundOwnership(state);
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
