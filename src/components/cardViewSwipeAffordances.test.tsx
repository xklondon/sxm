import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { TABLE_UX } from './tableUxContract';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { blackjackHandKey } from '../engine/blackjack';

const noop = () => {};

let simulatedWidth = 390;
const globalRef = globalThis as unknown as { window?: unknown };
const hadWindow = 'window' in globalRef;

beforeAll(() => {
  globalRef.window = {
    matchMedia: (query: string) => {
      const m = /max-width:\s*(\d+)/.exec(query);
      const max = m ? Number(m[1]) : Number.POSITIVE_INFINITY;
      return {
        matches: simulatedWidth <= max,
        media: query,
        addEventListener: noop,
        removeEventListener: noop,
        addListener: noop,
        removeListener: noop,
        onchange: null,
        dispatchEvent: () => false,
      };
    },
  };
});

afterAll(() => {
  if (!hadWindow) {
    delete globalRef.window;
  }
});

function playingState(): GameState {
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

describe('Card View mobile action affordances', () => {
  it('uses shell BlackjackActionPanel when viewer can act (no side-action path)', () => {
    simulatedWidth = 390;
    const html = renderToStaticMarkup(
      <BlackjackPanel
        gameState={{ ...playingState(), tableViewMode: 'card' }}
        onGameStateChange={noop}
      />,
    );
    const actionsZone =
      html.split(TABLE_UX.tableZoneActions)[1]?.split(TABLE_UX.tableZoneBoxes)[0] ?? '';
    expect(actionsZone).toContain('ds-btn--hit');
    expect(actionsZone).toContain('ds-btn--stand');
    expect(html).not.toContain('bj-phone-view__side-action--hit');
    expect(html).not.toContain('bj-phone-view__swipe-guide');
  });

  it('wires mobile card-view play swipe on felt during player turn', () => {
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(panelSrc).toContain('useMobileCardViewPlaySwipe');
    expect(panelSrc).toContain('cardViewPlaySwipeEnabled');
    expect(panelSrc).toContain('mobileFeltTouchHandlers');
    expect(panelSrc).toContain('useMobileBoxSwipeNavigation');
  });

  it('does not wire Card View hero swipe handlers for gameplay actions', () => {
    const cardViewSrc = readFileSync(
      join(process.cwd(), 'src/components/BlackjackCardView.tsx'),
      'utf8',
    );
    expect(cardViewSrc).toContain('resolveViewerActionPermission');
    expect(cardViewSrc).not.toContain('handleTouchEnd');
  });
});
