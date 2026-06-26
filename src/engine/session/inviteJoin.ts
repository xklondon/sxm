import type { GameState } from '../../types';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { log } from '../../utils/logger';
import { allocateChipsToBankrollOwner } from './allocation';
import { getStartingChipsEachSeat } from './tokens';
import {
  ensureBoxPositionForPerson,
  getAssignedSlotForPerson,
  getEffectivePlayerOrder,
  syncPlayerOrderAndAssignments,
} from './playerAssignment';
import { addSeatAtTable } from './table';
import { isZilchTable } from './zilchTableKind';
import { reconcileZilchRoster } from '../dice/zilch/zilchRoster';

export interface TableJoinNotice {
  message: string;
  personId: string;
  slotNumber: number;
  at: string;
}

export interface TableJoinHighlight {
  personId: string;
  slotNumber: number;
}

export function formatPlayerJoinedMessage(displayName: string, slotNumber: number): string {
  const name = displayName.trim() || 'Player';
  return `${name} joined the table on Box ${slotNumber}.`;
}

export function clearTableUiEphemeral(state: GameState): GameState {
  if (!state.tableMeta.tableNotice && !state.tableMeta.joinHighlight) {
    return state;
  }
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      tableNotice: null,
      joinHighlight: null,
    },
  };
}

export function allocateStartingChipsForPersonIfNeeded(
  state: GameState,
  personId: string,
): GameState {
  const chips = getStartingChipsEachSeat(state);
  if (chips <= 0 || !state.players[personId]) {
    return state;
  }
  const balance = derivePlayerBalanceFromLedger(personId, state.ledger);
  if (balance > 0) {
    return state;
  }
  const next = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: personId,
    amount: chips,
    reason: 'initial-player',
    source: 'join-table',
  });
  log.info('inviteJoinStartingChips', {
    personId,
    chips,
    balanceAfter: derivePlayerBalanceFromLedger(personId, next.ledger),
  });
  return next;
}

export function ensurePersonInPlayerOrder(state: GameState, personId: string): GameState {
  const order = getEffectivePlayerOrder(state);
  if (order.includes(personId)) {
    return state;
  }
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      playerOrder: [...order, personId],
    },
  };
}

export function setJoinTableUiState(
  state: GameState,
  personId: string,
  displayName: string,
  slotNumber: number,
): GameState {
  const message = formatPlayerJoinedMessage(displayName, slotNumber);
  const boxId =
    state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber)?.playerId ?? null;
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      tableNotice: { message, personId, slotNumber, at: new Date().toISOString() },
      joinHighlight: { personId, slotNumber },
    },
    selectedSeatId: boxId ?? state.selectedSeatId,
  };
}

export function slotNumberForPersonBox(state: GameState, personId: string): number | null {
  const slot = state.tableMeta.boxSlots.find((s) => s.nativeAssignedPersonId === personId);
  return slot?.slotNumber ?? null;
}

export function isJoinAssignedHighlight(
  state: GameState,
  slotNumber: number,
  protocolPhase: string,
): boolean {
  if (protocolPhase !== 'betting') {
    return false;
  }
  const highlight = state.tableMeta.joinHighlight;
  return highlight !== null && highlight !== undefined && highlight.slotNumber === slotNumber;
}

export function assignFirstFreeBox(
  state: GameState,
  personId: string,
): { state: GameState; boxAssigned: boolean; spectator: boolean; slotNumber: number | null } {
  const preferredSlot = getAssignedSlotForPerson(state, personId);
  if (preferredSlot) {
    const slot = state.tableMeta.boxSlots.find((s) => s.slotNumber === preferredSlot);
    if (slot && !slot.playerId) {
      log.info('inviteJoinBoxAssigned', {
        personId,
        slotNumber: preferredSlot,
        reason: 'preferredSlot',
      });
      return {
        state: ensureBoxPositionForPerson(state, preferredSlot, personId),
        boxAssigned: true,
        spectator: false,
        slotNumber: preferredSlot,
      };
    }
  }

  const free = state.tableMeta.boxSlots.find((s) => !s.playerId);
  if (!free) {
    log.info('inviteJoinSpectator', { personId, reason: 'noFreeBox' });
    return { state, boxAssigned: false, spectator: true, slotNumber: null };
  }

  log.info('inviteJoinBoxAssigned', {
    personId,
    slotNumber: free.slotNumber,
    reason: 'firstFree',
  });
  return {
    state: ensureBoxPositionForPerson(state, free.slotNumber, personId),
    boxAssigned: true,
    spectator: false,
    slotNumber: free.slotNumber,
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

/** Seat, starting chips, player order, box assignment, and join UI notice. */
export function finalizeInviteJoinAtTable(
  state: GameState,
  personId: string,
  displayName: string,
): { state: GameState; boxAssigned: boolean; spectator: boolean } {
  let next = addPersonSeatIfMissing(state, personId, displayName);
  next = allocateStartingChipsForPersonIfNeeded(next, personId);
  next = ensurePersonInPlayerOrder(next, personId);
  next = syncPlayerOrderAndAssignments(next);

  const boxResult = assignFirstFreeBox(next, personId);
  next = boxResult.state;

  if (boxResult.boxAssigned && boxResult.slotNumber !== null) {
    next = setJoinTableUiState(next, personId, displayName, boxResult.slotNumber);
  }

  if (isZilchTable(next)) {
    next = reconcileZilchRoster(next);
  }

  return {
    state: next,
    boxAssigned: boxResult.boxAssigned,
    spectator: boxResult.spectator,
  };
}
