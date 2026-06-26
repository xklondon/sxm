import { describe, expect, it } from 'vitest';
import { createNewBlackjackTable, createNewHoldemTable } from '../session/table';
import { assignBankBot } from '../session/boxOps';
import { applyHoldemTableStakeSetup } from '../session/holdemTableSetup';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import {
  listHoldemPlayableSeatIds,
  pruneHoldemSessionForPlay,
} from '../holdem/holdemPlayableSeats';
import { getHoldemChallengeParticipants } from '../holdem/challengeParticipants';
import { applyHoldemActionToState } from '../holdem/applyHoldemActionToState';
import { shuffleGameDeck } from '../deck';
import { appendLedgerEntry } from '../ledger/ledger';

const CHALLENGE_INPUT = {
  stakeDescription: '$100 dinner',
  seatChips: 500,
  bankChips: 500,
  bankerMode: 'self' as const,
  bankerName: 'Alex',
  controllerName: 'Alex',
  controllerEmail: 'alex@example.com',
  protocolId: 'texas-holdem',
  naturalDealing: false,
  dealSpeedPreset: 'normal' as const,
  cardTimerPreset: 0,
  bankDrawAuto: true,
  tableMode: 'challenge' as const,
  smallBlind: 5,
  bigBlind: 10,
  totalChallengeValue: 100,
  currency: '$',
};

describe('holdemPlayableSeats', () => {
  it('challenge setup prunes bank bot — host only before guests join', () => {
    let state = assignBankBot(createNewBlackjackTable(), 500);
    state = applyHoldemTableStakeSetup(state, CHALLENGE_INPUT);
    expect(listHoldemPlayableSeatIds(state)).toHaveLength(1);
    expect(state.session.playerIds).toHaveLength(1);
    const hostId = state.session.playerIds[0]!;
    expect(state.players[hostId]?.role).toBe('person');
    expect(derivePlayerBalanceFromLedger(hostId, state.ledger)).toBe(500);
  });

  it('challenge with host and one guest has exactly two participants', () => {
    let state = applyHoldemTableStakeSetup(createNewHoldemTable(), CHALLENGE_INPUT);
    const hostId = state.session.playerIds[0]!;
    state = pruneHoldemSessionForPlay({
      ...state,
      session: { ...state.session, playerIds: [hostId, 'guest'] },
      players: {
        ...state.players,
        guest: {
          id: 'guest',
          displayName: 'Guest',
          controllerName: 'Guest',
          playerType: 'real',
          role: 'person',
          cardIds: [],
          currentBet: 0,
          status: 'active',
          startingBalance: 500,
        },
      },
    });
    expect(listHoldemPlayableSeatIds(state)).toEqual([hostId, 'guest']);
    expect(getHoldemChallengeParticipants(state)).toHaveLength(2);
  });

  it('Practice default creates at least 2 playable seats', () => {
    const state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
      ...CHALLENGE_INPUT,
      tableMode: 'practice',
      stakeDescription: 'Practice',
      totalChallengeValue: undefined,
    });
    expect(listHoldemPlayableSeatIds(state).length).toBeGreaterThanOrEqual(2);
  });

  it('practice adds virtual players but never bank or box', () => {
    let state = assignBankBot(createNewBlackjackTable(), 500);
    state = applyHoldemTableStakeSetup(state, {
      ...CHALLENGE_INPUT,
      tableMode: 'practice',
      stakeDescription: 'Practice',
      totalChallengeValue: undefined,
      virtualPlayerCount: 2,
    });
    const ids = listHoldemPlayableSeatIds(state);
    expect(ids).toHaveLength(3);
    expect(ids.every((id) => state.players[id]?.role === 'person')).toBe(true);
    expect(ids.filter((id) => state.players[id]?.playerType === 'virtual')).toHaveLength(2);
    for (const id of ids) {
      expect(derivePlayerBalanceFromLedger(id, state.ledger)).toBe(500);
    }
  });

  it('2-player challenge blind posting succeeds after funding', () => {
    let state = applyHoldemTableStakeSetup(createNewHoldemTable(), CHALLENGE_INPUT);
    const hostId = state.session.playerIds[0]!;
    state = {
      ...state,
      session: { ...state.session, playerIds: [hostId, 'guest'] },
      players: {
        ...state.players,
        guest: {
          id: 'guest',
          displayName: 'Guest',
          controllerName: 'Guest',
          playerType: 'real',
          role: 'person',
          cardIds: [],
          currentBet: 0,
          status: 'active',
          startingBalance: 500,
        },
      },
    };
    state = shuffleGameDeck(state);
    for (const playerId of state.session.playerIds) {
      const funded = appendLedgerEntry(state.session, state.ledger, {
        playerId,
        entryType: 'buy-in',
        amount: 500,
        description: 'Test buy-in',
        roundNumber: state.session.currentRound,
      });
      state = { ...state, session: funded.session, ledger: funded.ledger };
    }
    const started = applyHoldemActionToState(state, { type: 'start-hand' });
    expect(started.ok).toBe(true);
    expect(started.state.holdem?.status).toBe('preflop');
    expect(started.state.holdem?.smallBlindPlayerId).toBe(hostId);
  });
});
