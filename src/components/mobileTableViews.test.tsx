import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

function cardViewMiniBoxOrder(html: string): string[] {
  if (!html.includes('bj-phone-view__mini-row')) {
    return [];
  }
  return [...html.matchAll(/class="bj-phone-view__mini-hand-box">Box (\d)/g)].map((m) => m[1]!);
}

function mobileFullTableCss(): string {
  return readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
}

/** Canonical section markers — mobile and desktop must both include the same set. */
const FULL_TABLE_SECTIONS = [
  'dealer-block',
  'bj-casino__felt',
  'bj-arc',
  'bj-accounts-panel',
] as const;

const FULL_TABLE_PLAYING_SECTIONS = [
  ...FULL_TABLE_SECTIONS,
  'bj-center-status',
  'bj-table-actions',
  'bj-arc__slot--turn',
] as const;

const FULL_TABLE_BETTING_SECTIONS = [
  ...FULL_TABLE_SECTIONS,
  'bj-casino__tray',
] as const;

const CARD_VIEW_SECTIONS = [
  'dealer-block',
  'bj-phone-view',
  'bj-accounts-panel',
] as const;

const CARD_VIEW_PLAYING_SECTIONS = [
  ...CARD_VIEW_SECTIONS,
  'bj-center-status',
  'bj-phone-view__play-area',
  'bj-phone-view__side-btn--live',
  'bj-phone-view__mini-row',
] as const;

const CARD_VIEW_BETTING_SECTIONS = [
  ...CARD_VIEW_SECTIONS,
  'bj-phone-view__betting-stage--row',
  'bj-casino__tray',
] as const;

function sectionPresence(html: string, marker: string): boolean {
  return html.includes(marker);
}

function assertSameSections(mobileHtml: string, desktopHtml: string, markers: readonly string[]) {
  for (const marker of markers) {
    expect(sectionPresence(mobileHtml, marker)).toBe(true);
    expect(sectionPresence(desktopHtml, marker)).toBe(true);
    expect(sectionPresence(mobileHtml, marker)).toBe(sectionPresence(desktopHtml, marker));
  }
}

describe('mobile vs desktop — same canonical Full Table sections', () => {
  it('playing round: dealer, status, arc/boxes, actions, This Table', () => {
    const state = withView(playingState(), 'full');
    const mobile = renderPanelAt(390, state);
    const desktop = renderPanelAt(1280, state);
    assertSameSections(mobile, desktop, FULL_TABLE_PLAYING_SECTIONS);
    expect(mobile).not.toContain('bj-mobile-fallback');
    expect(desktop).not.toContain('bj-mobile-fallback');
  });

  it('betting round: dealer, felt, arc, chip tray, This Table', () => {
    const state = withView(bettingState(), 'full');
    const mobile = renderPanelAt(390, state);
    const desktop = renderPanelAt(1280, state);
    assertSameSections(mobile, desktop, FULL_TABLE_BETTING_SECTIONS);
  });

  it('same arc box ids/order on mobile and desktop', () => {
    const state = withView(playingState(), 'full');
    expect(arcBoxOrder(renderPanelAt(390, state))).toEqual(arcBoxOrder(renderPanelAt(1280, state)));
  });
});

describe('mobile vs desktop — same canonical Card View sections', () => {
  it('playing round: dealer, status, hero/play-area, mini row, This Table', () => {
    const state = withView(playingState(), 'card');
    const mobile = renderPanelAt(390, state);
    const desktop = renderPanelAt(1280, state);
    assertSameSections(mobile, desktop, CARD_VIEW_PLAYING_SECTIONS);
  });

  it('betting round: dealer, ordered betting row, This Table', () => {
    const state = withView(bettingState(), 'card');
    const mobile = renderPanelAt(390, state);
    const desktop = renderPanelAt(1280, state);
    assertSameSections(mobile, desktop, CARD_VIEW_BETTING_SECTIONS);
    expect(mobile).not.toContain('bj-phone-view__bet-secondary-row');
    expect(desktop).not.toContain('bj-phone-view__bet-secondary-row');
  });
});

describe('mobile Full Table renders the real table (not a fallback)', () => {
  it('renders the felt/arc/boxes and never the fallback on a normal phone', () => {
    const html = renderPanelAt(390, withView(playingState(), 'full'));
    expect(html).toContain('bj-view-full-mobile');
    expect(html).not.toContain('bj-mobile-fallback');
    expect(html).toContain('bj-casino__felt');
    expect(html).toContain('bj-casino__rail');
    expect(html).toContain('bj-arc');
    expect(html).not.toContain('bj-phone-view__betting-stage');
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

  it('felt scroller CSS includes horizontal edge gutters for end boxes', () => {
    const css = mobileFullTableCss();
    expect(css).toMatch(/\.bj-view-full-mobile \.bj-casino__felt-main[\s\S]*padding:\s*0\s+0\.55rem/);
    expect(css).toMatch(/\.bj-view-full-mobile \.bj-arc[\s\S]*padding:\s*0\s+0\.85rem/);
    expect(css).toMatch(/\.bj-view-full-mobile \.bj-casino__rail[\s\S]*overflow:\s*visible/);
  });

  it('falls back only on ultra-narrow widths (< 360px)', () => {
    const html = renderPanelAt(320, withView(playingState(), 'full'));
    expect(html).toContain('bj-mobile-fallback');
    expect(html).toContain('Use Card View');
  });

  it('includes full-width Assign chips and Invite actions in This Table markup', () => {
    const html = renderPanelAt(390, withView(bettingState(), 'full'));
    expect(html).toContain('bj-accounts-panel__assign');
    expect(html).toContain('Assign chips');
    expect(html).toContain('bj-accounts-panel__play-flow');
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

  it('uses stacked This Table layout (same markers as mobile Full Table)', () => {
    const card = renderPanelAt(390, withView(playingState(), 'card'));
    const full = renderPanelAt(390, withView(playingState(), 'full'));
    expect(card).toContain('bj-accounts-panel__section');
    expect(card).toContain('bj-accounts-panel__list');
    expect(full).toContain('bj-accounts-panel__section');
    expect(full).toContain('bj-accounts-panel__list');
  });

  it('mini row includes all slots in order with BUST, active highlight, and join boxes', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).toContain('bj-phone-view__mini-row');
    expect(html).toContain('bj-phone-view__box-value--bust');
    expect(html).toContain('BUST');
    expect(html).toContain('bj-phone-view__mini-hand--active');
    expect(html).toContain('Join');
    const order = cardViewMiniBoxOrder(html);
    expect(order.length).toBeGreaterThanOrEqual(3);
    expect(order[0]).toBe('7');
    expect(order[order.length - 1]).toBe('1');
  });

  it('mobile Card View mini row uses table visual order; occupied boxes match Full Table arc', () => {
    const state = withView(playingState(), 'card');
    const card = renderPanelAt(390, state);
    const full = renderPanelAt(390, withView(playingState(), 'full'));
    const cardOrder = cardViewMiniBoxOrder(card);
    const arcOrder = arcBoxOrder(full);
    expect(cardOrder[0]).toBe('7');
    expect(cardOrder[cardOrder.length - 1]).toBe('1');
    expect(cardOrder.filter((n) => arcOrder.includes(n))).toEqual(arcOrder);
  });

  it('desktop Card View keeps ascending box order unchanged', () => {
    const state = withView(playingState(), 'card');
    const desktop = renderPanelAt(1280, state);
    const order = cardViewMiniBoxOrder(desktop);
    expect(order[0]).toBe('1');
    expect(order[order.length - 1]).toBe('7');
  });

  it('highlights the active box as the live hero with its controls', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).toContain('bj-phone-view__side-btn--live');
    expect(html).toContain('bj-phone-view__mini-row');
  });
});
