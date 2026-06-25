import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import { createEmptyLedger } from '../../types/ledger';
import { createEmptyHoldemRound } from '../../types/holdem';
import { createDefaultPokerTableConfig } from '../../types/poker';
import { appendLedgerEntry } from '../ledger/ledger';
import {
  findAutomaticHoldemChallengeWinner,
  findEarlyEndHoldemChallengeWinner,
  getNonEliminatedHoldemSeats,
  maybeAutoEndHoldemChallenge,
} from './challengeWinner';

function baseHoldemState(
  mode: 'practice' | 'challenge',
  playerIds: string[],
): GameState {
  const sessionId = 'sess-challenge';
  return {
    session: {
      id: sessionId,
      playerIds,
      currentRound: 1,
      status: 'active',
      gameType: 'texas-holdem',
      dealerButtonPlayerId: playerIds[0],
      ledgerEntryIds: [],
    },
    players: Object.fromEntries(
      playerIds.map((id) => [id, { id, displayName: id, playerType: 'human' as const }]),
    ),
    ledger: createEmptyLedger(sessionId),
    tableMeta: {
      controllerName: 'Host',
      ownerPersonId: playerIds[0],
      pokerConfig: createDefaultPokerTableConfig({
        mode,
        totalChallengeValue: mode === 'challenge' ? 100 : undefined,
        startingStack: 500,
      }),
    },
    holdem: {
      ...createEmptyHoldemRound(playerIds[0]!, playerIds[0]!, playerIds[1] ?? playerIds[0]!),
      status: 'resolved',
    },
  } as GameState;
}

function withBalance(state: GameState, playerId: string, amount: number): GameState {
  if (amount <= 0) {
    return state;
  }
  const result = appendLedgerEntry(state.session, state.ledger, {
    playerId,
    entryType: 'buy-in',
    amount,
    description: 'Test buy-in',
    roundNumber: state.session.currentRound,
  });
  return { ...state, session: result.session, ledger: result.ledger };
}

describe('challengeWinner helpers', () => {
  it('1. practice mode returns no automatic winner', () => {
    let state = baseHoldemState('practice', ['A', 'B']);
    state = withBalance(state, 'A', 500);
    expect(findAutomaticHoldemChallengeWinner(state)).toBeNull();
  });

  it('2. challenge mode with one non-eliminated player returns last-player-standing', () => {
    let state = baseHoldemState('challenge', ['A', 'B']);
    state = withBalance(state, 'A', 1000);
    const result = findAutomaticHoldemChallengeWinner(state);
    expect(result).toEqual({
      ok: true,
      winnerSeatId: 'A',
      reason: 'last-player-standing',
    });
  });

  it('3. challenge mode with two live players returns null for automatic winner', () => {
    let state = baseHoldemState('challenge', ['A', 'B']);
    state = withBalance(state, 'A', 500);
    state = withBalance(state, 'B', 500);
    expect(findAutomaticHoldemChallengeWinner(state)).toBeNull();
  });

  it('4. eliminated player with stack 0 excluded', () => {
    let state = baseHoldemState('challenge', ['A', 'B', 'C']);
    state = withBalance(state, 'A', 100);
    expect(getNonEliminatedHoldemSeats(state)).toEqual(['A']);
  });

  it('5. early end picks highest chip stack', () => {
    let state = baseHoldemState('challenge', ['A', 'B']);
    state = withBalance(state, 'A', 300);
    state = withBalance(state, 'B', 700);
    expect(findEarlyEndHoldemChallengeWinner(state)).toEqual({
      ok: true,
      winnerSeatId: 'B',
      reason: 'chip-leader',
    });
  });

  it('6. early end tied chip leader rejects', () => {
    let state = baseHoldemState('challenge', ['A', 'B']);
    state = withBalance(state, 'A', 500);
    state = withBalance(state, 'B', 500);
    expect(findEarlyEndHoldemChallengeWinner(state)).toEqual({
      ok: false,
      error: 'Cannot end challenge: chip-leader tie.',
    });
  });

  it('7. early end rejected for practice', () => {
    let state = baseHoldemState('practice', ['A', 'B']);
    state = withBalance(state, 'A', 900);
    state = withBalance(state, 'B', 100);
    expect(findEarlyEndHoldemChallengeWinner(state)).toEqual({
      ok: false,
      error: 'Not a Poker challenge table',
    });
  });

  it('8. automatic challenge end after resolved hand when one player remains', () => {
    let state = baseHoldemState('challenge', ['A', 'B']);
    state = withBalance(state, 'A', 1000);
    const ended = maybeAutoEndHoldemChallenge(state);
    expect(ended.tableMeta.pokerConfig?.challengeStatus).toBe('ended');
    expect(ended.tableMeta.pokerConfig?.challengeWinnerSeatId).toBe('A');
    expect(ended.tableMeta.pokerConfig?.challengeEndReason).toBe('last-player-standing');
    expect(ended.tableMeta.gameStatus).toBe('ended');
  });

  it('9. no automatic end when multiple players remain', () => {
    let state = baseHoldemState('challenge', ['A', 'B']);
    state = withBalance(state, 'A', 500);
    state = withBalance(state, 'B', 500);
    const next = maybeAutoEndHoldemChallenge(state);
    expect(next.tableMeta.pokerConfig?.challengeStatus).toBe('active');
  });
});
