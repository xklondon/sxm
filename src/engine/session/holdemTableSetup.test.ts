import { describe, expect, it } from 'vitest';
import {
  applyHoldemTableStakeSetup,
  createNewHoldemTable,
} from './index';
import { applyHoldemActionToState } from '../holdem/applyHoldemActionToState';
import { shuffleGameDeck } from '../deck';
import { appendLedgerEntry } from '../ledger/ledger';

const HOLDEM_CHALLENGE_INPUT = {
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

describe('holdemTableSetup stabilization', () => {
  it('challenge setup does not freeze participant snapshot before guests join', () => {
    const state = applyHoldemTableStakeSetup(createNewHoldemTable(), HOLDEM_CHALLENGE_INPUT);
    expect(state.tableMeta.pokerConfig?.mode).toBe('challenge');
    expect(state.tableMeta.pokerConfig?.challengeParticipants).toBeUndefined();
  });

  it('rejects invalid blinds at setup', () => {
    expect(() =>
      applyHoldemTableStakeSetup(createNewHoldemTable(), {
        ...HOLDEM_CHALLENGE_INPUT,
        smallBlind: 10,
        bigBlind: 5,
      }),
    ).toThrow(/Big blind must be greater/i);
  });

  it('snapshots participants on first hand start after guests are seated', () => {
    let state = applyHoldemTableStakeSetup(createNewHoldemTable(), HOLDEM_CHALLENGE_INPUT);
    const hostId = state.session.playerIds[0]!;
    state = {
      ...state,
      session: {
        ...state.session,
        playerIds: [hostId, 'guest'],
      },
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
    const dealt = applyHoldemActionToState(started.state, { type: 'start-hand' });
    expect(dealt.ok).toBe(true);
    expect(dealt.state.tableMeta.pokerConfig?.challengeParticipants?.map((p) => p.seatId)).toEqual([
      hostId,
      'guest',
    ]);
  });
});
