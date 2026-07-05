import { describe, expect, it } from 'vitest';
import { createBlackjackPlayerHand } from '../../types/blackjack';
import { getBlackjackProtocolPhase } from './protocol';
import {
  canChangeMinimumBet,
  evaluateBlackjackDealEngine,
} from './dealEligibility';
import { tableAfterStartPlaying, boxPlayerId } from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { addChipToBoxStake } from './stakes';
import { blackjackHandKey } from './handKeys';

describe('dealEligibility — canonical phase mapping', () => {
  it('uses getBlackjackProtocolPhase for deal checks (insurance during initial deal is dealing, not insurance)', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, boxId, 50);
    const handKey = blackjackHandKey(boxId, 0);
    state = {
      ...state,
      tableMeta: { ...state.tableMeta, shoeStarted: true, bettingLocked: false },
      blackjack: {
        status: 'initial-deal',
        dealerCardIds: ['d-up'],
        dealerHoleHidden: true,
        activeHandKey: null,
        activePlayerId: null,
        playerHands: {
          [handKey]: {
            ...createBlackjackPlayerHand(boxId, 0),
            cardIds: ['c1'],
            currentBet: 50,
          },
        },
        splitCounts: {},
        outcomes: {},
        insuranceOfferPending: true,
        insuranceBets: {},
        insuranceDeclined: {},
        insuranceSkipReasons: {},
        insuranceStakerDecisions: {},
        insuranceStakerSkipReasons: {},
        insuranceStakerBets: {},
        evenMoneyOfferHandKey: null,
        evenMoneyPendingHandKeys: [],
        evenMoneyDeclined: {},
        tookEvenMoney: {},
      },
    };

    expect(getBlackjackProtocolPhase(state)).toBe('dealing');
    expect(evaluateBlackjackDealEngine(state).reason).toBe('wrong_phase');
    expect(canChangeMinimumBet(state)).toBe(false);
  });

  it('blocks deal during player-turns', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, boxId, 50);
    const handKey = blackjackHandKey(boxId, 0);
    state = {
      ...state,
      tableMeta: { ...state.tableMeta, shoeStarted: true },
      blackjack: {
        status: 'player-turns',
        dealerCardIds: ['d1', 'd2'],
        dealerHoleHidden: false,
        activeHandKey: handKey,
        activePlayerId: boxId,
        playerHands: {
          [handKey]: {
            ...createBlackjackPlayerHand(boxId, 0),
            cardIds: ['c1', 'c2'],
            currentBet: 50,
            actionStatus: 'acting',
          },
        },
        splitCounts: {},
        outcomes: {},
        insuranceOfferPending: false,
        insuranceBets: {},
        insuranceDeclined: {},
        insuranceSkipReasons: {},
        insuranceStakerDecisions: {},
        insuranceStakerSkipReasons: {},
        insuranceStakerBets: {},
        evenMoneyOfferHandKey: null,
        evenMoneyPendingHandKeys: [],
        evenMoneyDeclined: {},
        tookEvenMoney: {},
      },
    };

    expect(getBlackjackProtocolPhase(state)).toBe('player');
    expect(evaluateBlackjackDealEngine(state).reason).toBe('wrong_phase');
  });
});
