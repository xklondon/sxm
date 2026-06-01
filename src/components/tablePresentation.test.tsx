import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey } from '../engine/blackjack';

const noop = () => {};

/** Two-box player-turns state: box 1 busted (cards kept), box 2 acting. */
function playerTurnsState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, 2);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const box2 = boxPlayerId(state, 2)!;
  const k1 = blackjackHandKey(box1, 0);
  const k2 = blackjackHandKey(box2, 0);

  return {
    ...state,
    selectedSeatId: box2,
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      activeHandKey: k2,
      activePlayerId: box2,
      dealerCardIds: [findCardId(deck, '7'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: {
        [k1]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '10'), findCardId(deck, '9'), findCardId(deck, '5')],
          currentBet: 10,
          actionStatus: 'busted',
          bustSettled: true,
        },
        [k2]: {
          ...createBlackjackPlayerHand(box2, 0),
          cardIds: [findCardId(deck, '6'), findCardId(deck, '7')],
          currentBet: 10,
          actionStatus: 'acting',
        },
      },
    },
  };
}

function renderPanel(state: GameState): string {
  return renderToStaticMarkup(
    <BlackjackPanel gameState={state} onGameStateChange={noop} />,
  );
}

describe('Table View presentation', () => {
  it('renders no center active-hand card display (boxes are canonical)', () => {
    const html = renderPanel(playerTurnsState());
    expect(html).not.toContain('bj-center-mini-hand');
    // Boxes/arc remain the canonical hand display.
    expect(html).toContain('bj-arc');
  });

  it('keeps a busted hand visible with a prominent BUST label', () => {
    const html = renderPanel(playerTurnsState());
    expect(html).toContain('bj-arc__bust');
    expect(html).toContain('BUST');
  });
});
