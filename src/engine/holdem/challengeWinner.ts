import type { GameState } from '../../types';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { isHoldemHandInProgress } from './holdemSelectors';
import {
  getHoldemChallengeSeatIds,
  isHoldemSeatEliminated,
} from './challengeParticipants';

export { isHoldemSeatEliminated, getHoldemChallengeSeatIds } from './challengeParticipants';

export type HoldemChallengeWinnerResult =
  | { ok: true; winnerSeatId: string; reason: 'last-player-standing' | 'chip-leader' }
  | { ok: false; error: string };

export type HoldemChallengeEndReason = 'last-player-standing' | 'chip-leader';

export function isHoldemChallengeTable(state: GameState): boolean {
  return (
    state.session.gameType === 'texas-holdem' &&
    state.tableMeta.pokerConfig?.mode === 'challenge'
  );
}

export function getNonEliminatedHoldemSeats(state: GameState): string[] {
  return getHoldemChallengeSeatIds(state).filter((seatId) => !isHoldemSeatEliminated(state, seatId));
}

export function getAuthoritativeChallengeWinnerId(state: GameState): string | null {
  const config = state.tableMeta.pokerConfig;
  if (!config || config.mode !== 'challenge' || config.challengeStatus !== 'ended') {
    return null;
  }
  return config.challengeWinnerSeatId ?? config.challengeWinnerPlayerId ?? null;
}

export function findAutomaticHoldemChallengeWinner(
  state: GameState,
): HoldemChallengeWinnerResult | null {
  if (!isHoldemChallengeTable(state)) {
    return null;
  }

  const config = state.tableMeta.pokerConfig;
  if (!config || config.mode === 'practice' || config.challengeStatus === 'ended') {
    return null;
  }

  const survivors = getNonEliminatedHoldemSeats(state);
  if (survivors.length !== 1) {
    return null;
  }

  return {
    ok: true,
    winnerSeatId: survivors[0]!,
    reason: 'last-player-standing',
  };
}

export function findEarlyEndHoldemChallengeWinner(state: GameState): HoldemChallengeWinnerResult {
  if (!isHoldemChallengeTable(state)) {
    return { ok: false, error: 'Not a Poker challenge table' };
  }

  const config = state.tableMeta.pokerConfig;
  if (!config || config.mode === 'practice') {
    return { ok: false, error: 'Practice tables do not have challenge winners' };
  }

  if (config.challengeStatus === 'ended') {
    return { ok: false, error: 'Challenge has already ended' };
  }

  const balances = getHoldemChallengeSeatIds(state).map((seatId) => ({
    seatId,
    balance: derivePlayerBalanceFromLedger(seatId, state.ledger),
  }));

  if (balances.length === 0) {
    return { ok: false, error: 'No seated players' };
  }

  const maxBalance = Math.max(...balances.map((entry) => entry.balance));
  const leaders = balances.filter((entry) => entry.balance === maxBalance);
  if (leaders.length !== 1) {
    return { ok: false, error: 'Cannot end challenge: chip-leader tie.' };
  }

  return {
    ok: true,
    winnerSeatId: leaders[0]!.seatId,
    reason: 'chip-leader',
  };
}

export function applyHoldemChallengeEndToState(
  state: GameState,
  winner: { winnerSeatId: string; reason: HoldemChallengeEndReason },
): GameState {
  const config = state.tableMeta.pokerConfig;
  if (!config) {
    throw new Error('Missing poker table config');
  }

  const now = new Date().toISOString();
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      gameStatus: 'ended',
      winnerId: winner.winnerSeatId,
      endedAt: now,
      gameEndReason: winner.reason,
      settlementMode: 'winner-takes-all',
      pokerConfig: {
        ...config,
        challengeStatus: 'ended',
        challengeWinnerSeatId: winner.winnerSeatId,
        challengeWinnerPlayerId: winner.winnerSeatId,
        challengeEndReason: winner.reason,
        challengeEndedAt: now,
      },
    },
  };
}

export function endHoldemChallengeEarlyOnState(state: GameState): GameState {
  const result = findEarlyEndHoldemChallengeWinner(state);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return applyHoldemChallengeEndToState(state, {
    winnerSeatId: result.winnerSeatId,
    reason: result.reason,
  });
}

/** After hand payout, end challenge when exactly one non-eliminated player remains. */
export function maybeAutoEndHoldemChallenge(state: GameState): GameState {
  if (!isHoldemChallengeTable(state)) {
    return state;
  }

  if (state.tableMeta.pokerConfig?.challengeStatus === 'ended') {
    return state;
  }

  if (state.holdem?.status !== 'resolved') {
    return state;
  }

  const automaticWinner = findAutomaticHoldemChallengeWinner(state);
  if (!automaticWinner?.ok) {
    return state;
  }

  return applyHoldemChallengeEndToState(state, {
    winnerSeatId: automaticWinner.winnerSeatId,
    reason: automaticWinner.reason,
  });
}

export function assertEndHoldemChallengeAuthorized(state: GameState, personId: string): void {
  if (!isHoldemChallengeTable(state)) {
    throw new Error('Not a Poker challenge table');
  }

  const config = state.tableMeta.pokerConfig;
  if (!config || config.mode === 'practice') {
    throw new Error('Practice tables do not have challenge winners');
  }

  if (config.challengeStatus === 'ended') {
    throw new Error('Challenge has already ended');
  }

  const ownerId = state.tableMeta.ownerPersonId;
  if (!ownerId || ownerId !== personId) {
    throw new Error('Only the table host may end the challenge');
  }

  if (isHoldemHandInProgress(state)) {
    throw new Error('Cannot end challenge during an active hand');
  }

  const result = findEarlyEndHoldemChallengeWinner(state);
  if (!result.ok) {
    throw new Error(result.error);
  }
}
