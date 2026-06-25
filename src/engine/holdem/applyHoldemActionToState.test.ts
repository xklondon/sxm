import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import { shuffleGameDeck } from '../deck';
import { appendLedgerEntry } from '../ledger/ledger';
import { applyHoldemTableStakeSetup } from '../session/holdemTableSetup';
import { createNewHoldemTable } from '../session/table';
import {
  applyHoldemActionToState,
  applyHoldemActionToStateOrThrow,
} from './applyHoldemActionToState';

function practiceTable(): GameState {
  return applyHoldemTableStakeSetup(createNewHoldemTable(), {
    stakeDescription: 'Practice',
    seatChips: 500,
    bankChips: 500,
    bankerMode: 'self',
    bankerName: 'Alex',
    controllerName: 'Alex',
    controllerEmail: 'alex@example.com',
    protocolId: 'texas-holdem',
    naturalDealing: false,
    dealSpeedPreset: 'normal',
    cardTimerPreset: 0,
    bankDrawAuto: true,
    tableMode: 'practice',
    smallBlind: 5,
    bigBlind: 10,
    virtualPlayerCount: 1,
  });
}

/** Fund seated player ids so blind posting can debit box player ledger rows. */
function fundSeatedPlayers(state: GameState, amount = 500): GameState {
  let next = state;
  for (const playerId of next.session.playerIds) {
    const result = appendLedgerEntry(next.session, next.ledger, {
      playerId,
      entryType: 'buy-in',
      amount,
      description: 'Test buy-in',
      roundNumber: next.session.currentRound,
    });
    next = { ...next, session: result.session, ledger: result.ledger };
  }
  return next;
}

describe('applyHoldemActionToState', () => {
  it('supports all-in via canonical action when player has chips', () => {
    let state = fundSeatedPlayers(shuffleGameDeck(practiceTable()));
    const created = applyHoldemActionToState(state, { type: 'start-hand' });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    state = created.state;
    const dealt = applyHoldemActionToState(state, { type: 'start-hand' });
    expect(dealt.ok).toBe(true);
    if (!dealt.ok) {
      return;
    }
    state = dealt.state;
    const actor = state.holdem?.activePlayerId;
    if (!actor) {
      return;
    }
    const allIn = applyHoldemActionToState(state, {
      type: 'all-in',
      actorSeatId: actor,
    });
    expect(allIn.ok).toBe(true);
    if (allIn.ok) {
      expect(allIn.state.holdem?.playerStates[actor]?.actionStatus).toBe('all-in');
    }
  });

  it('still rejects unsupported advance-street action', () => {
    const state = practiceTable();
    const unsupported = applyHoldemActionToState(state, { type: 'advance-street' });
    expect(unsupported.ok).toBe(false);
  });

  it('start-hand creates a setup round then deals on second call', () => {
    let state = fundSeatedPlayers(shuffleGameDeck(practiceTable()));
    const created = applyHoldemActionToState(state, { type: 'start-hand' });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.state.holdem?.status).toBe('setup');
      state = created.state;
    }

    const dealt = applyHoldemActionToState(state, { type: 'start-hand' });
    expect(dealt.ok).toBe(true);
    if (dealt.ok) {
      expect(dealt.state.holdem?.status).toBe('preflop');
    }
  });

  it('start-hand fails without a shuffled deck', () => {
    const result = applyHoldemActionToState(practiceTable(), { type: 'start-hand' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Shuffle the deck/i);
    }
  });

  it('syncs pokerConfig dealer into session when creating a round', () => {
    const table = practiceTable();
    const dealerId = table.tableMeta.pokerConfig?.dealerSeatId;
    const state = shuffleGameDeck({
      ...table,
      session: {
        ...table.session,
        dealerButtonPlayerId: null,
      },
    });
    const result = applyHoldemActionToState(state, { type: 'start-hand' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.session.dealerButtonPlayerId).toBe(dealerId);
      expect(result.state.holdem?.dealerButtonPlayerId).toBe(dealerId);
    }
  });

  it('applyHoldemActionToStateOrThrow throws on invalid advance action', () => {
    expect(() =>
      applyHoldemActionToStateOrThrow(practiceTable(), { type: 'advance-street' }),
    ).toThrow(/not supported yet/i);
  });
});
