import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { blackjackHandKey } from '../engine/blackjack';

const noop = () => {};

vi.mock('./storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Alice', email: 'alice@test.com' }),
  needsLocalProfileSetup: () => false,
  syncAuthEmailToProfile: () => {},
  getPlayerInitials: () => 'AL',
}));

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

describe('Card View mobile swipe affordances', () => {
  it('shows live side swipe controls when viewer can act', () => {
    simulatedWidth = 390;
    const html = renderToStaticMarkup(
      <BlackjackPanel
        gameState={{ ...playingState(), tableViewMode: 'card' }}
        onGameStateChange={noop}
      />,
    );
    expect(html).toContain('bj-phone-view__side-action--stand');
    expect(html).toContain('bj-phone-view__side-action--hit');
    expect(html).toContain('bj-phone-view__side-action--live');
    expect(html).toContain('bj-phone-view__swipe-guide');
    expect(html).toContain('bj-phone-view__play-area--controls');
  });

  it('uses resolveViewerActionPermission in touch swipe handler', () => {
    const cardViewSrc = readFileSync(
      join(process.cwd(), 'src/components/BlackjackCardView.tsx'),
      'utf8',
    );
    expect(cardViewSrc).toContain('resolveViewerActionPermission');
    expect(cardViewSrc).toMatch(/handleTouchEnd[\s\S]*actionPermission\.canAct/);
  });
});
