import type { GameState } from '../../types';
import { getStakeForBox } from '../blackjack/stakes';
import { getCallerPersonIdForBox, getAssignedSlotForPerson } from './playerAssignment';

/** Person ids who placed chips on this box this betting round (includes caller). */
export function getStakerPersonIdsForBox(state: GameState, boxPlayerId: string): string[] {
  const stake = state.tableMeta.boxStakes[boxPlayerId];
  if (!stake || stake.amount <= 0) {
    return [];
  }
  const ids = new Set<string>(stake.stakerPersonIds ?? []);
  const caller = stake.callerPersonId ?? getCallerPersonIdForBox(state, boxPlayerId);
  if (caller) {
    ids.add(caller);
  }
  return [...ids];
}

/**
 * Free / non-native boxes where this person is caller because they first staked.
 * Native assigned box stays under Assigned only.
 */
export function getRunningBoxSlotsForPerson(state: GameState, personId: string): number[] {
  const nativeSlot = getAssignedSlotForPerson(state, personId);
  const running: number[] = [];

  for (const slot of state.tableMeta.boxSlots) {
    if (!slot.playerId) {
      continue;
    }
    if (getStakeForBox(state, slot.playerId) <= 0) {
      continue;
    }
    if (getCallerPersonIdForBox(state, slot.playerId) !== personId) {
      continue;
    }
    if (nativeSlot != null && slot.slotNumber === nativeSlot) {
      continue;
    }
    running.push(slot.slotNumber);
  }

  return running.sort((a, b) => a - b);
}

/** Boxes where this person has money but is not caller/controller. */
export function getCoBoxSlotsForPerson(state: GameState, personId: string): number[] {
  const co: number[] = [];

  for (const slot of state.tableMeta.boxSlots) {
    if (!slot.playerId) {
      continue;
    }
    if (getStakeForBox(state, slot.playerId) <= 0) {
      continue;
    }
    const caller = getCallerPersonIdForBox(state, slot.playerId);
    if (!getStakerPersonIdsForBox(state, slot.playerId).includes(personId)) {
      continue;
    }
    if (caller === personId) {
      continue;
    }
    co.push(slot.slotNumber);
  }

  return co.sort((a, b) => a - b);
}
