import { describe, expect, it } from 'vitest';
import {
  applyCardVisibility,
  cardRevealScopeKey,
  countVisibleCards,
  emptyCardVisibility,
  hasPendingCardReveal,
  isStaleHandVisibility,
  maxVisibilityForRound,
  resolveRevealScopeTransition,
  shouldHydrateCardRevealScope,
  shouldUseOrderedInitialReveal,
  totalCardCount,
} from './cardRevealDisplay';
import { tableWithClaimedBox, boxPlayerId, findCardId } from '../sanity/fixtures';
import { createBlackjackPlayerHand, createEmptyBlackjackRound } from '../../../types/blackjack';
import { blackjackHandKey } from '../handKeys';
import type { BlackjackRound } from '../../../types/blackjack';

describe('card reveal hydration helpers', () => {
  it('scope key is stable per table and round', () => {
    expect(cardRevealScopeKey('table-a', 3)).toBe('table-a:3');
    expect(cardRevealScopeKey('table-a', 4)).toBe('table-a:4');
  });

  it('empty visibility starts a paced round from no revealed cards', () => {
    expect(emptyCardVisibility()).toEqual({ dealer: 0, hands: {} });
    expect(resolveRevealScopeTransition('t:1', 't:2')).toBe('reset');
  });

  it('stale visibility from prior round hands forces pending reveal', () => {
    const stale = { dealer: 2, hands: { 'round1:0': 2 } };
    const target = { dealer: 2, hands: { 'round2:0': 2 } };
    expect(isStaleHandVisibility(stale, target)).toBe(true);
    expect(hasPendingCardReveal(stale, target)).toBe(true);
  });

  it('hydrates on first snapshot and on table/round change', () => {
    expect(shouldHydrateCardRevealScope(null, 't:1', false)).toBe(true);
    expect(shouldHydrateCardRevealScope('t:1', 't:1', true)).toBe(false);
    expect(shouldHydrateCardRevealScope('t:1', 't:2', true)).toBe(true);
  });

  it('ordered initial reveal uses canonical plan for any pending initial-deal cards', () => {
    const empty = { dealer: 0, hands: {} };
    const oneCard = { dealer: 0, hands: { 'p:0': 1 } };
    expect(shouldUseOrderedInitialReveal('initial-deal', empty, oneCard)).toBe(true);
    expect(
      shouldUseOrderedInitialReveal('initial-deal', empty, { dealer: 2, hands: { 'p:0': 2, 'p2:0': 2 } }),
    ).toBe(true);
    expect(
      shouldUseOrderedInitialReveal('player-turns', empty, { dealer: 2, hands: { 'p:0': 2 } }),
    ).toBe(true);
    expect(
      shouldUseOrderedInitialReveal('bank-turn', { dealer: 1, hands: {} }, { dealer: 3, hands: {} }),
    ).toBe(false);
  });

  it('mid-round hydrate snapshot shows all dealt cards immediately', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    const round: BlackjackRound = {
      ...createEmptyBlackjackRound(),
      status: 'player-turns',
      activeHandKey: handKey,
      activePlayerId: boxId,
      dealerCardIds: [findCardId(deck, '7'), findCardId(deck, 'K')],
      dealerHoleHidden: false,
      playerHands: {
        [handKey]: {
          ...createBlackjackPlayerHand(boxId, 0),
          cardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
          currentBet: 50,
          actionStatus: 'acting',
        },
      },
      insuranceOfferPending: false,
      evenMoneyOfferHandKey: null,
    };
    state = { ...state, blackjack: round };
    const target = maxVisibilityForRound(round);
    expect(totalCardCount(target)).toBe(4);
    const hydrated = applyCardVisibility(state, target);
    expect(hydrated.blackjack!.dealerCardIds.filter(Boolean).length).toBe(2);
    expect(hydrated.blackjack!.playerHands[handKey]!.cardIds.length).toBe(2);
    expect(countVisibleCards(round).dealer).toBe(2);
  });

  it('bank-turn hydrate shows all existing dealer cards without replay steps', () => {
    let state = tableWithClaimedBox(1);
    const deck = state.deck!;
    const round: BlackjackRound = {
      ...createEmptyBlackjackRound(),
      status: 'bank-turn',
      activeHandKey: null,
      dealerCardIds: [
        findCardId(deck, '7'),
        findCardId(deck, '8'),
        findCardId(deck, '9'),
      ],
      dealerHoleHidden: false,
      playerHands: {},
      insuranceOfferPending: false,
      evenMoneyOfferHandKey: null,
    };
    state = { ...state, blackjack: round };
    const target = maxVisibilityForRound(round);
    expect(
      shouldUseOrderedInitialReveal('bank-turn', { dealer: 0, hands: {} }, target),
    ).toBe(false);
    const hydrated = applyCardVisibility(state, target);
    expect(hydrated.blackjack!.dealerCardIds.filter(Boolean).length).toBe(3);
  });
});
