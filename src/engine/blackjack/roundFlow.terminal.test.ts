import { describe, expect, it } from 'vitest';
import { createBlackjackPlayerHand } from '../../types/blackjack';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableWithClaimedBox,
} from './sanity/fixtures';
import { blackjackHandKey } from './handKeys';
import { shouldSkipBankDraw } from './roundFlow';

describe('roundFlow terminal bank draw skip', () => {
  it('skips bank draw when every active box is terminal (including naturals)', () => {
    const state = tableWithClaimedBox(1);
    const deck = state.deck!;
    const box1 = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(box1, 0);
    const naturalHand = {
      ...createBlackjackPlayerHand(box1, 0),
      cardIds: [findCardId(deck, 'A'), findCardId(deck, 'K')],
      currentBet: 25,
      actionStatus: 'blackjack' as const,
    };

    const round = {
      ...actingRound(state, box1, naturalHand.cardIds, 25),
      status: 'bank-turn' as const,
      activeHandKey: null,
      playerHands: { [handKey]: naturalHand },
    };
    expect(shouldSkipBankDraw(state.session, round)).toBe(true);
  });

  it('does not skip bank draw when a stood hand still needs comparison', () => {
    const state = tableWithClaimedBox(1);
    const deck = state.deck!;
    const box1 = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(box1, 0);
    const stoodHand = {
      ...createBlackjackPlayerHand(box1, 0),
      cardIds: [findCardId(deck, '10'), findCardId(deck, '8')],
      currentBet: 25,
      actionStatus: 'stood' as const,
    };
    const round = {
      ...actingRound(state, box1, stoodHand.cardIds, 25),
      status: 'bank-turn' as const,
      activeHandKey: null,
      playerHands: { [handKey]: stoodHand },
    };
    expect(shouldSkipBankDraw(state.session, round)).toBe(false);
  });
});
