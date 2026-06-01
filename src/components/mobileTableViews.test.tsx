import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState, TableViewMode } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { addChipToBoxStake, blackjackHandKey } from '../engine/blackjack';

const noop = () => {};

/**
 * Force a deterministic viewport width for the device hooks, which read
 * `window.matchMedia('(max-width: …px)')`. The test env is `node`, so we install
 * a minimal window whose matchMedia compares the queried max-width to a
 * simulated CSS width.
 */
let simulatedWidth = 390; // a normal phone (>= 360, so NOT ultra-narrow)
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

function renderPanelAt(width: number, state: GameState): string {
  simulatedWidth = width;
  return renderToStaticMarkup(<BlackjackPanel gameState={state} onGameStateChange={noop} />);
}

function withView(state: GameState, mode: TableViewMode): GameState {
  return { ...state, tableViewMode: mode };
}

/** Two-box player-turns table: box 1 busted (cards kept), box 2 acting. */
function playingState(): GameState {
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

/** Betting table with a confirmed stake (chip tray should be reachable). */
function bettingState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, 2);
  const ownerPersonId = state.tableMeta.ownerPersonId!;
  const box1 = boxPlayerId(state, 1)!;
  state = addChipToBoxStake(state, box1, 50, ownerPersonId);
  return state;
}

function arcBoxOrder(html: string): string[] {
  return [...html.matchAll(/class="bj-arc__box-label">Box (\d)/g)].map((m) => m[1]!);
}

describe('mobile Full Table renders the real table (not a fallback)', () => {
  it('renders the felt/arc/boxes and never the fallback on a normal phone', () => {
    const html = renderPanelAt(390, withView(playingState(), 'full'));
    expect(html).toContain('bj-view-full-mobile');
    expect(html).not.toContain('bj-mobile-fallback');
    expect(html).toContain('bj-casino__felt');
    expect(html).toContain('bj-arc');
    expect(html).toContain('class="bj-arc__box-label">Box');
  });

  it('shows dealer block, status/summary slot, actions, and the This Table bar', () => {
    const html = renderPanelAt(390, withView(playingState(), 'full'));
    expect(html).toContain('dealer-block');
    expect(html).toContain('This Table');
    // Player actions are reachable on the active hand.
    expect(html).toContain('Hit');
    expect(html).toContain('Stay');
  });

  it('exposes the chip tray during betting', () => {
    const html = renderPanelAt(390, withView(bettingState(), 'full'));
    expect(html).toContain('bj-casino__tray');
  });

  it('highlights the active/turn box', () => {
    const html = renderPanelAt(390, withView(playingState(), 'full'));
    expect(html).toContain('bj-arc__slot--turn');
  });

  it('keeps a busted box visible with a BUST label', () => {
    const html = renderPanelAt(390, withView(playingState(), 'full'));
    expect(html).toContain('bj-arc__bust');
    expect(html).toContain('BUST');
  });

  it('uses the same box order as desktop Full Table', () => {
    const state = withView(playingState(), 'full');
    const mobile = renderPanelAt(390, state);
    const desktop = renderPanelAt(1280, state);
    expect(arcBoxOrder(mobile)).toEqual(arcBoxOrder(desktop));
    expect(arcBoxOrder(mobile).length).toBeGreaterThan(0);
  });

  it('falls back only on ultra-narrow widths (< 360px)', () => {
    const html = renderPanelAt(320, withView(playingState(), 'full'));
    expect(html).toContain('bj-mobile-fallback');
    expect(html).toContain('Use Card View');
  });
});

describe('mobile Card View structure', () => {
  it('renders dealer, hero/stage, mini box row, and the This Table bar', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).toContain('bj-view-card-mobile');
    expect(html).toContain('dealer-block');
    expect(html).toContain('bj-phone-view');
    expect(html).toContain('This Table');
    expect(html).not.toContain('bj-mobile-fallback');
  });

  it('highlights the active box as the live hero with its controls', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    // The active box becomes the hero; its action controls go "live".
    expect(html).toContain('bj-phone-view__side-btn--live');
    // Non-active boxes appear in the ordered mini row.
    expect(html).toContain('bj-phone-view__mini-row');
  });
});
