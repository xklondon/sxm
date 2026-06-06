import { describe, expect, it } from 'vitest';

import type { GameState } from '../types';
import { buildTableInfoDisplay } from './tableInfoDisplay';
import { getVisibleHandCardIds } from '../engine/blackjack/dealing/cardRevealDisplay';
import { resolveControllerPersonId } from '../engine/session';
import { tableAfterStartPlaying, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { blackjackHandKey } from '../engine/blackjack';

function playingStateWithHiddenHole(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  return {
    ...state,
    selectedSeatId: box1,
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      activeHandKey: k1,
      activePlayerId: box1,
      dealerCardIds: [findCardId(deck, '7'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: {
        [k1]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '6'), findCardId(deck, '7')],
          currentBet: 10,
          actionStatus: 'acting',
        },
      },
    },
  };
}

describe('buildTableInfoDisplay', () => {
  it('shows bank visible value without hidden hole card', () => {
    const state = playingStateWithHiddenHole();
    const info = buildTableInfoDisplay(state, resolveControllerPersonId(state, 'Alice'));
    expect(info.bankValue).toBe(7);
    expect(info.bankValue).not.toBe(17);
  });

  it('shows bank chip balance when bank is assigned', () => {
    const state = playingStateWithHiddenHole();
    const info = buildTableInfoDisplay(state, resolveControllerPersonId(state, 'Alice'));
    expect(info.bankChips).toBeGreaterThan(0);
  });

  it('shows player available chips for viewer', () => {
    const state = playingStateWithHiddenHole();
    const viewerId = resolveControllerPersonId(state, 'Alice') ?? boxPlayerId(state, 1)!;
    const info = buildTableInfoDisplay(state, viewerId);
    expect(info.playerAvailable).toBe(490);
  });
});

describe('Full Table visible card projection', () => {
  it('uses same visible-card helper as Card View', () => {
    const state = playingStateWithHiddenHole();
    const round = state.blackjack!;
    const box1 = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(box1, 0);
    const visibleIds = getVisibleHandCardIds(round, handKey);
    expect(visibleIds.length).toBe(2);
  });
});
