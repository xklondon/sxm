import type { GameState } from '../../types';
import { isSeatedPersonAtTable } from '../session/playerAssignment';
import { isHoldemTable } from '../session/zilchTableKind';
import { getHoldemActingSeatId, isHoldemHandInProgress } from './holdemSelectors';
import { validatePokerBlinds } from '../../types/poker';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';

export function assertHoldemTable(state: GameState): void {
  if (!isHoldemTable(state) || state.session.gameType !== 'texas-holdem') {
    throw new Error('Not a Texas Hold\'em table');
  }
}

export function isHoldemTableHostPerson(state: GameState, personId: string): boolean {
  const ownerId = state.tableMeta.ownerPersonId;
  return Boolean(ownerId && ownerId === personId);
}

/** Map authenticated table member person id → holdem seat player id. */
export function getHoldemPlayerIdForPerson(state: GameState, personId: string): string | null {
  if (state.session.playerIds.includes(personId)) {
    return personId;
  }

  for (const playerId of state.session.playerIds) {
    const player = state.players[playerId];
    if (player?.bankrollOwnerId === personId) {
      return playerId;
    }
  }

  for (const slot of state.tableMeta.boxSlots ?? []) {
    if (slot.nativeAssignedPersonId === personId && slot.playerId) {
      return slot.playerId;
    }
  }

  return null;
}

export function canPersonControlHoldemSeat(
  state: GameState,
  personId: string,
  seatPlayerId: string,
): boolean {
  if (!personId || !seatPlayerId) {
    return false;
  }

  const mapped = getHoldemPlayerIdForPerson(state, personId);
  if (mapped === seatPlayerId) {
    return true;
  }

  const seatPlayer = state.players[seatPlayerId];
  const isPractice =
    state.tableMeta.pokerConfig?.mode === 'practice' ||
    state.tableMeta.tableMode === 'practice';
  if (
    isPractice &&
    seatPlayer?.playerType === 'virtual' &&
    isHoldemTableHostPerson(state, personId)
  ) {
    return true;
  }

  return false;
}

export function assertHoldemPlayerSeated(state: GameState, personId: string): string {
  if (!isSeatedPersonAtTable(state, personId)) {
    throw new Error('Player is not seated at this table');
  }
  const playerId = getHoldemPlayerIdForPerson(state, personId);
  if (!playerId || !state.session.playerIds.includes(playerId)) {
    throw new Error('Player is not seated at this table');
  }
  return playerId;
}

export function assertHoldemHostAction(
  state: GameState,
  personId: string,
  opts: { blockMidHandShuffle?: boolean; blockMidHandStart?: boolean },
): void {
  assertHoldemTable(state);
  if (!isHoldemTableHostPerson(state, personId)) {
    throw new Error('Only the table host may perform this action');
  }
  if (opts.blockMidHandShuffle && isHoldemHandInProgress(state)) {
    throw new Error('Cannot shuffle during an active hand');
  }
  if (opts.blockMidHandStart && isHoldemHandInProgress(state)) {
    throw new Error('Hand already in progress');
  }
}

export function assertHoldemPlayerGameplayAction(
  state: GameState,
  personId: string,
  payload: Record<string, unknown>,
): string {
  assertHoldemTable(state);
  const playerId = assertHoldemPlayerSeated(state, personId);

  const payloadSeat = payload.actorSeatId as string | undefined;
  if (payloadSeat && payloadSeat !== playerId) {
    throw new Error('Cannot act for another seat');
  }

  if (!isHoldemHandInProgress(state)) {
    throw new Error('Betting is not open');
  }

  const actingSeatId = getHoldemActingSeatId(state);
  if (!actingSeatId) {
    throw new Error('No active Hold\'em action');
  }

  if (!canPersonControlHoldemSeat(state, personId, actingSeatId)) {
    throw new Error('Not your turn');
  }

  return playerId;
}

export function assertHoldemAllInAuthorized(
  state: GameState,
  personId: string,
  payload: Record<string, unknown>,
): string {
  const playerId = assertHoldemPlayerGameplayAction(state, personId, payload);
  const balance = derivePlayerBalanceFromLedger(playerId, state.ledger);
  if (balance <= 0) {
    throw new Error('No chips remaining to go all-in');
  }
  return playerId;
}

export function assertUpdateHoldemBlindsAuthorized(
  state: GameState,
  personId: string,
  smallBlind: number,
  bigBlind: number,
): void {
  assertHoldemTable(state);
  if (!isHoldemTableHostPerson(state, personId)) {
    throw new Error('Only the table host may perform this action');
  }
  if (isHoldemHandInProgress(state)) {
    throw new Error('Blinds can only be changed before a hand starts.');
  }
  if (!Number.isFinite(smallBlind) || !Number.isFinite(bigBlind)) {
    throw new Error('smallBlind and bigBlind must be valid numbers');
  }
  const validationError = validatePokerBlinds(smallBlind, bigBlind);
  if (validationError) {
    throw new Error(validationError);
  }
}
