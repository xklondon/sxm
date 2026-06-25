import type { GameState } from '../../types';
import type { PokerChallengeParticipantRecord } from '../../types/poker';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { resolveEmailForPlayerId } from '../scoreLedger/gameEndIou';

function isHoldemChallengeTable(state: GameState): boolean {
  return (
    state.session.gameType === 'texas-holdem' &&
    state.tableMeta.pokerConfig?.mode === 'challenge'
  );
}

export type HoldemChallengeParticipant = {
  seatId: string;
  playerId: string;
  displayName: string;
  email?: string;
  stack: number;
  isEliminated: boolean;
};

function isHoldemChallengeParticipantSeat(state: GameState, seatId: string): boolean {
  if (!state.session.playerIds.includes(seatId)) {
    return false;
  }

  const player = state.players[seatId];
  if (!player) {
    return false;
  }

  if (player.role === 'bank' || player.role === 'box') {
    return false;
  }

  if (player.playerType === 'virtual') {
    return false;
  }

  return true;
}

export function resolveHoldemChallengeParticipantPlayerId(
  state: GameState,
  seatId: string,
): string {
  const player = state.players[seatId];
  if (!player) {
    return seatId;
  }
  return player.bankrollOwnerId ?? seatId;
}

export function isHoldemSeatEliminated(state: GameState, seatId: string): boolean {
  const balance = derivePlayerBalanceFromLedger(seatId, state.ledger);
  if (balance > 0) {
    return false;
  }

  const holdem = state.holdem;
  if (!holdem || holdem.status === 'setup' || holdem.status === 'resolved') {
    return true;
  }

  const committed = holdem.playerStates[seatId]?.playerTotalCommitted ?? 0;
  return committed <= 0;
}

function buildLiveHoldemChallengeParticipant(
  state: GameState,
  seatId: string,
): HoldemChallengeParticipant {
  const playerId = resolveHoldemChallengeParticipantPlayerId(state, seatId);
  const player = state.players[seatId];
  const email = resolveEmailForPlayerId(state, playerId) ?? undefined;
  return {
    seatId,
    playerId,
    displayName: player?.displayName ?? 'Player',
    email,
    stack: derivePlayerBalanceFromLedger(seatId, state.ledger),
    isEliminated: isHoldemSeatEliminated(state, seatId),
  };
}

function scanLiveHoldemChallengeParticipants(state: GameState): HoldemChallengeParticipant[] {
  if (!isHoldemChallengeTable(state)) {
    return [];
  }

  return state.session.playerIds
    .filter((seatId) => isHoldemChallengeParticipantSeat(state, seatId))
    .map((seatId) => buildLiveHoldemChallengeParticipant(state, seatId));
}

function hydrateHoldemChallengeParticipant(
  state: GameState,
  record: PokerChallengeParticipantRecord,
): HoldemChallengeParticipant {
  const email = record.email ?? resolveEmailForPlayerId(state, record.playerId) ?? undefined;
  return {
    seatId: record.seatId,
    playerId: record.playerId,
    displayName: record.displayName,
    email,
    stack: derivePlayerBalanceFromLedger(record.seatId, state.ledger),
    isEliminated: isHoldemSeatEliminated(state, record.seatId),
  };
}

/** Canonical challenge roster — persisted snapshot when frozen, else live scan. */
export function getHoldemChallengeParticipants(state: GameState): HoldemChallengeParticipant[] {
  const config = state.tableMeta.pokerConfig;
  if (!config || config.mode !== 'challenge') {
    return [];
  }

  const snapshot = config.challengeParticipants;
  if (snapshot?.length) {
    return snapshot.map((record) => hydrateHoldemChallengeParticipant(state, record));
  }

  return scanLiveHoldemChallengeParticipants(state);
}

/** Hold'em challenge seat ids — excludes bank, box, and practice virtuals. */
export function getHoldemChallengeSeatIds(state: GameState): string[] {
  return getHoldemChallengeParticipants(state).map((participant) => participant.seatId);
}

function buildParticipantSnapshotRecords(state: GameState): PokerChallengeParticipantRecord[] {
  return scanLiveHoldemChallengeParticipants(state).map((participant) => ({
    seatId: participant.seatId,
    playerId: participant.playerId,
    displayName: participant.displayName,
    email: participant.email,
  }));
}

/** Freeze challenge participant roster once (first hand start or challenge setup). */
export function ensureHoldemChallengeParticipantSnapshot(state: GameState): GameState {
  const config = state.tableMeta.pokerConfig;
  if (!config || config.mode !== 'challenge') {
    return state;
  }

  if (config.challengeParticipants && config.challengeParticipants.length > 0) {
    return state;
  }

  const records = buildParticipantSnapshotRecords(state);
  if (records.length === 0) {
    return state;
  }

  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      pokerConfig: {
        ...config,
        challengeParticipants: records,
        challengeParticipantSeatIds: records.map((record) => record.seatId),
        challengeParticipantPlayerIds: records.map((record) => record.playerId),
      },
    },
  };
}
