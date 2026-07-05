import { describe, expect, it } from 'vitest';
import type { BlackjackRound } from '../../../types/blackjack';
import { createBlackjackPlayerHand } from '../../../types/blackjack';
import {
  hasPendingCardReveal,
  maxVisibilityForRound,
  nextGameplayRevealStep,
  nextSequentialRevealStep,
  totalCardCount,
  type CardVisibilityCounts,
} from './cardRevealDisplay';

function assertVisibilityAdvances(before: CardVisibilityCounts, after: CardVisibilityCounts): void {
  expect(totalCardCount(after)).toBeGreaterThan(totalCardCount(before));
  expect(after.dealer).toBeGreaterThanOrEqual(before.dealer);
  for (const handKey of new Set([...Object.keys(before.hands), ...Object.keys(after.hands)])) {
    expect(after.hands[handKey] ?? 0).toBeGreaterThanOrEqual(before.hands[handKey] ?? 0);
  }
}

describe('gameplay card reveal steps', () => {
  it('reveals one player card at a time after initial deal', () => {
    const visible = { dealer: 2, hands: { 'p:0': 2 } };
    const target = { dealer: 2, hands: { 'p:0': 3 } };
    expect(hasPendingCardReveal(visible, target)).toBe(true);
    expect(nextGameplayRevealStep(visible, target)).toEqual({
      dealer: 2,
      hands: { 'p:0': 3 },
    });
  });

  it('reveals dealer cards before player cards when dealer pending', () => {
    const visible = { dealer: 1, hands: { 'p:0': 2 } };
    const target = { dealer: 2, hands: { 'p:0': 2 } };
    expect(nextGameplayRevealStep(visible, target)).toEqual({
      dealer: 2,
      hands: { 'p:0': 2 },
    });
  });

  it('reveals hit mid-round without regressing visibility', () => {
    const visible = { dealer: 2, hands: { 'p:0': 2 } };
    const target = { dealer: 2, hands: { 'p:0': 3 } };
    const step = nextSequentialRevealStep(visible, target, null, 'player-turns');
    expect(step).not.toBeNull();
    assertVisibilityAdvances(visible, step!);
    expect(step!.hands['p:0']).toBe(3);
  });

  it('reveals double mid-round without regressing visibility', () => {
    const visible = { dealer: 2, hands: { 'p2:0': 2 } };
    const target = { dealer: 2, hands: { 'p2:0': 3 } };
    const round = {
      status: 'player-turns',
      activeHandKey: 'p2:0',
      activePlayerId: 'p2',
      initialDealHandKeys: ['p2:0'],
      playerHands: {
        'p2:0': {
          ...createBlackjackPlayerHand('p2', 0),
          cardIds: ['c1', 'c2', 'c3'],
          currentBet: 50,
          actionStatus: 'stood',
          doubled: true,
        },
      },
      dealerCardIds: ['d1', 'd2'],
      dealerHoleHidden: false,
      insuranceOfferPending: false,
      evenMoneyOfferHandKey: null,
      splitCounts: {},
      outcomes: {},
    } satisfies BlackjackRound;

    const step = nextSequentialRevealStep(visible, target, round, 'player-turns');
    expect(step).not.toBeNull();
    assertVisibilityAdvances(visible, step!);
    expect(step!.hands['p2:0']).toBe(3);
    expect(hasPendingCardReveal(step!, target)).toBe(false);
  });

  it('reveals split companion hand not listed in initialDealHandKeys', () => {
    const originalKey = 'p2:0';
    const splitKey = 'p2:1';
    const round = {
      status: 'player-turns',
      activeHandKey: originalKey,
      activePlayerId: 'p2',
      initialDealHandKeys: [originalKey],
      playerHands: {
        [originalKey]: {
          ...createBlackjackPlayerHand('p2', 0),
          cardIds: ['c1', 'c2'],
          currentBet: 25,
          actionStatus: 'acting',
          fromSplit: true,
        },
        [splitKey]: {
          ...createBlackjackPlayerHand('p2', 1, true),
          cardIds: ['c3', 'c4'],
          currentBet: 25,
          actionStatus: 'acting',
        },
      },
      dealerCardIds: ['d1', 'd2'],
      dealerHoleHidden: false,
      insuranceOfferPending: false,
      evenMoneyOfferHandKey: null,
      splitCounts: { p2: 1 },
      outcomes: {},
    } satisfies BlackjackRound;
    const target = maxVisibilityForRound(round);
    const visible = { dealer: 2, hands: { [originalKey]: 2 } };

    expect(hasPendingCardReveal(visible, target)).toBe(true);
    const step = nextSequentialRevealStep(visible, target, round, 'player-turns');
    expect(step).not.toBeNull();
    assertVisibilityAdvances(visible, step!);
    expect(step!.hands[splitKey]).toBe(1);

    const step2 = nextSequentialRevealStep(step!, target, round, 'player-turns');
    expect(step2?.hands[splitKey]).toBe(2);
    expect(hasPendingCardReveal(step2 ?? visible, target)).toBe(false);
  });

  it('reveals resplit hand index :2 outside initialDealHandKeys', () => {
    const originalKey = 'p2:0';
    const firstSplitKey = 'p2:1';
    const resplitKey = 'p2:2';
    const round = {
      status: 'player-turns',
      activeHandKey: originalKey,
      activePlayerId: 'p2',
      initialDealHandKeys: [originalKey],
      playerHands: {
        [originalKey]: {
          ...createBlackjackPlayerHand('p2', 0),
          cardIds: ['c1', 'c2'],
          currentBet: 25,
          actionStatus: 'acting',
          fromSplit: true,
        },
        [firstSplitKey]: {
          ...createBlackjackPlayerHand('p2', 1, true),
          cardIds: ['c3', 'c4'],
          currentBet: 25,
          actionStatus: 'stood',
        },
        [resplitKey]: {
          ...createBlackjackPlayerHand('p2', 2, true),
          cardIds: ['c5', 'c6'],
          currentBet: 25,
          actionStatus: 'acting',
        },
      },
      dealerCardIds: ['d1', 'd2'],
      dealerHoleHidden: false,
      insuranceOfferPending: false,
      evenMoneyOfferHandKey: null,
      splitCounts: { p2: 2 },
      outcomes: {},
    } satisfies BlackjackRound;
    const target = maxVisibilityForRound(round);
    const visible = { dealer: 2, hands: { [originalKey]: 2, [firstSplitKey]: 2 } };

    const step = nextSequentialRevealStep(visible, target, round, 'player-turns');
    expect(step).not.toBeNull();
    assertVisibilityAdvances(visible, step!);
    expect(step!.hands[resplitKey]).toBe(1);

    const step2 = nextSequentialRevealStep(step!, target, round, 'player-turns');
    expect(step2?.hands[resplitKey]).toBe(2);
    expect(hasPendingCardReveal(step2 ?? step!, target)).toBe(false);
  });

  it('does not regress dealer visibility when initial plan is already caught up', () => {
    const originalKey = 'p2:0';
    const splitKey = 'p2:1';
    const round = {
      status: 'player-turns',
      activeHandKey: originalKey,
      activePlayerId: 'p2',
      initialDealHandKeys: [originalKey],
      playerHands: {
        [originalKey]: {
          ...createBlackjackPlayerHand('p2', 0),
          cardIds: ['c1', 'c2'],
          currentBet: 25,
          actionStatus: 'acting',
        },
        [splitKey]: {
          ...createBlackjackPlayerHand('p2', 1, true),
          cardIds: ['c3', 'c4'],
          currentBet: 25,
          actionStatus: 'acting',
        },
      },
      dealerCardIds: ['d1', 'd2'],
      dealerHoleHidden: false,
      insuranceOfferPending: false,
      evenMoneyOfferHandKey: null,
      splitCounts: { p2: 1 },
      outcomes: {},
    } satisfies BlackjackRound;
    const target = maxVisibilityForRound(round);
    const visible = { dealer: 2, hands: { [originalKey]: 2 } };

    const step = nextSequentialRevealStep(visible, target, round, 'player-turns');
    expect(step?.dealer).toBe(2);
    expect((step?.hands[splitKey] ?? 0)).toBeGreaterThan(0);
  });
});
