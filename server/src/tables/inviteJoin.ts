import type { GameState } from '../../../src/types/index.js';
import {
  ensureBoxPositionForPerson,
  getAssignedSlotForPerson,
} from '../../../src/engine/session/playerAssignment.js';
import { addSeatAtTable } from '../../../src/engine/session/table.js';

export function assignFirstFreeBox(
  state: GameState,
  personId: string,
): { state: GameState; boxAssigned: boolean; spectator: boolean } {
  const preferredSlot = getAssignedSlotForPerson(state, personId);
  if (preferredSlot) {
    const slot = state.tableMeta.boxSlots.find((s) => s.slotNumber === preferredSlot);
    if (slot && !slot.playerId) {
      return {
        state: ensureBoxPositionForPerson(state, preferredSlot, personId),
        boxAssigned: true,
        spectator: false,
      };
    }
  }

  const free = state.tableMeta.boxSlots.find((s) => !s.playerId);
  if (!free) {
    return { state, boxAssigned: false, spectator: true };
  }

  return {
    state: ensureBoxPositionForPerson(state, free.slotNumber, personId),
    boxAssigned: true,
    spectator: false,
  };
}

export function addPersonSeatIfMissing(
  state: GameState,
  personId: string,
  displayName: string,
): GameState {
  if (state.players[personId]) {
    return state;
  }
  return addSeatAtTable(state, {
    displayName,
    controllerName: displayName,
    role: 'person',
    startingChips: 0,
  });
}
