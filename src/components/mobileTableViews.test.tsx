import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';

import type { GameState, TableViewMode } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { TABLE_UX } from './tableUxContract';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
  withInstantInitialDeal,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { addChipToBoxStake, blackjackHandKey } from '../engine/blackjack';

import {
  createMobileLayoutMatchMedia,
  type SimulatedViewport,
} from '../test/mobileLayoutMatchMedia';

const {
  shared: SHARED_CSS,
  shell: SHELL_CSS,
  fullTableCardArea: PLAY_ZONE_CSS,
  cardLayout: CARD_LAYOUT_CSS,
  playerRow: PLAYER_ROW_CSS,
} = readBlackjackLayoutCss();
const noop = () => {};

/**
 * Force a deterministic viewport for the device hooks, which read
 * `window.matchMedia(MOBILE_LAYOUT_MEDIA)`. The test env is `node`, so we install
 * a minimal window whose matchMedia compares to a simulated width/height.
 */
let simulatedViewport: SimulatedViewport = { width: 390, height: 844 };
const globalRef = globalThis as unknown as { window?: unknown };
const hadWindow = 'window' in globalRef;

beforeAll(() => {
  globalRef.window = {
    matchMedia: createMobileLayoutMatchMedia(() => simulatedViewport),
  };
});

afterAll(() => {
  if (!hadWindow) {
    delete globalRef.window;
  }
});

function renderPanelAt(width: number, state: GameState, height = 844): string {
  simulatedViewport = { width, height };
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

  return withInstantInitialDeal({
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
  });
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
  return [...html.matchAll(/class="bj-phone-view__mini-hand-box">Box (\d)/g)].map((m) => m[1]!);
}

function cardViewMiniBoxOrder(html: string): string[] {
  if (!html.includes('bj-arc--player-boxes')) {
    return [];
  }
  const start = html.indexOf('bj-arc--player-boxes');
  const end = html.indexOf(TABLE_UX.tableZoneBottom, start);
  const section = end > start ? html.slice(start, end) : html.slice(start);
  return [...section.matchAll(/aria-label="(?:Join )?[Bb]ox (\d)/g)].map((m) => m[1]!);
}

function mobileFullTableCss(): string {
  return readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
}

/** Canonical section markers — mobile and desktop must both include the same set. */
const FULL_TABLE_SECTIONS = [
  'dealer-block',
  'bj-casino__felt',
  'bj-arc',
] as const;

const FULL_TABLE_PLAYING_SECTIONS = [
  ...FULL_TABLE_SECTIONS,
  'dealer-block__status',
  'bj-table-actions',
  'bj-phone-view__mini-hand-value',
] as const;

const FULL_TABLE_BETTING_SECTIONS = [
  ...FULL_TABLE_SECTIONS,
  'bj-value-chips',
  'chip-tray',
] as const;

const CARD_VIEW_SECTIONS = [
  'dealer-block',
] as const;

const CARD_VIEW_PLAYING_SHARED = [
  ...CARD_VIEW_SECTIONS,
  TABLE_UX.tableLayoutShell,
  TABLE_UX.cardLayoutCommand,
  'dealer-block__stack',
  TABLE_UX.cardsAreaHero,
  'bj-table-zone--summary',
  TABLE_UX.tableZoneActions,
  TABLE_UX.tableZoneBoxes,
  'bj-arc--player-boxes',
  'playing-card',
] as const;

const CARD_VIEW_PLAYING_MOBILE_ONLY = ['bj-phone-view', 'bj-phone-view__hero-stage'] as const;
const CARD_VIEW_PLAYING_DESKTOP_ONLY = ['bj-card-desktop-hero'] as const;

const CARD_VIEW_BETTING_SHARED = [
  ...CARD_VIEW_SECTIONS,
  TABLE_UX.tableLayoutShell,
  'dealer-block__stack',
  TABLE_UX.cardsAreaHero,
  TABLE_UX.tableZoneBoxes,
  'bj-arc--player-boxes',
  TABLE_UX.tableZoneActions,
  'bj-value-chips',
  'chip-tray',
] as const;

const CARD_VIEW_BETTING_MOBILE_ONLY = [
  'bj-phone-view',
  'bj-phone-view__cards-placeholder',
] as const;

function sectionPresence(html: string, marker: string): boolean {
  return html.includes(marker);
}

function assertSameSections(mobileHtml: string, desktopHtml: string, markers: readonly string[]) {
  for (const marker of markers) {
    expect(sectionPresence(mobileHtml, marker), `mobile missing ${marker}`).toBe(true);
    expect(sectionPresence(desktopHtml, marker), `desktop missing ${marker}`).toBe(true);
    expect(sectionPresence(mobileHtml, marker)).toBe(sectionPresence(desktopHtml, marker));
  }
}

function assertCardViewParity(
  mobileHtml: string,
  desktopHtml: string,
  shared: readonly string[],
  mobileOnly: readonly string[] = [],
  desktopOnly: readonly string[] = [],
) {
  for (const marker of shared) {
    expect(sectionPresence(mobileHtml, marker), `mobile missing ${marker}`).toBe(true);
    expect(sectionPresence(desktopHtml, marker), `desktop missing ${marker}`).toBe(true);
  }
  for (const marker of mobileOnly) {
    expect(sectionPresence(mobileHtml, marker), `mobile missing ${marker}`).toBe(true);
  }
  for (const marker of desktopOnly) {
    expect(sectionPresence(desktopHtml, marker), `desktop missing ${marker}`).toBe(true);
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
    assertCardViewParity(
      mobile,
      desktop,
      CARD_VIEW_PLAYING_SHARED,
      CARD_VIEW_PLAYING_MOBILE_ONLY,
      CARD_VIEW_PLAYING_DESKTOP_ONLY,
    );
    expect(mobile).toContain('ds-btn--hit');
  });

  it('betting round: dealer, ordered betting row, This Table', () => {
    const state = withView(bettingState(), 'card');
    const mobile = renderPanelAt(390, state);
    const desktop = renderPanelAt(1280, state);
    assertCardViewParity(mobile, desktop, CARD_VIEW_BETTING_SHARED, CARD_VIEW_BETTING_MOBILE_ONLY);
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
    expect(html).toContain('class="bj-phone-view__mini-hand-box">Box');
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
    expect(html).toContain('bj-value-chips');
  });

  it('chip tray hides denominations below table minimum bet (same on Full Table and Card View)', () => {
    const state = withView(bettingState(), 'full');
    const full = renderPanelAt(390, state);
    const card = renderPanelAt(390, { ...state, tableViewMode: 'card' });
    for (const html of [full, card]) {
      expect(html).toContain('aria-label="Add 5 to bet"');
      expect(html).toContain('aria-label="Add 10 to bet"');
      expect(html).not.toContain('aria-label="Add 1 to bet"');
      expect(html).not.toContain('aria-label="Add 2 to bet"');
    }
  });

  it('highlights the active hand value and active player box during player turn', () => {
    const html = renderPanelAt(390, withView(playingState(), 'full'));
    expect(html).toContain('bj-phone-view__box-value--active-turn');
    expect(html).toContain('bj-box--turn');
  });

  it('keeps a busted box visible with BUST in cards area and bet on box', () => {
    const html = renderPanelAt(390, withView(playingState(), 'full'));
    const cardsArea = html.split('bj-arc--cards')[1]?.split('bj-arc--player-boxes')[0] ?? '';
    expect(cardsArea).toContain('bj-card-outcome-marker--stack-badge');
    expect(cardsArea).toContain('BUST');
    expect(html).toContain('>10<');
  });

  it('uses the same box order as desktop Full Table', () => {
    const state = withView(playingState(), 'full');
    const mobile = renderPanelAt(390, state);
    const desktop = renderPanelAt(1280, state);
    expect(arcBoxOrder(mobile)).toEqual(arcBoxOrder(desktop));
    expect(arcBoxOrder(mobile).length).toBeGreaterThan(0);
  });

  it('felt scroller CSS keeps arc inside shell (no inner horizontal scroll)', () => {
    const css = mobileFullTableCss();
    const sharedCss = SHARED_CSS;
    expect(PLAY_ZONE_CSS).toContain('Full Table play zone');
    expect(sharedCss).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt-main,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt-main[\s\S]*overflow:\s*hidden/,
    );
    expect(PLAY_ZONE_CSS).toMatch(/\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--cards[\s\S]*width:\s*100%/);
    expect(css).toMatch(/\.bj-view-full-mobile[\s\S]*overflow-x:\s*hidden/);
  });

  it('mobile Full Table vertical spacing aligns with Card View (shared felt token, boxes at bottom)', () => {
    const sharedCss = SHARED_CSS;
    expect(sharedCss).toContain('--bj-mobile-felt-min-height: 0');
    expect(sharedCss).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt[\s\S]*min-height:\s*var\(--bj-mobile-felt-min-height\)/,
    );
    expect(sharedCss).toMatch(/\.bj-table-slot-row|\.bj-arc--player-boxes/);
    // Mobile boxes baseline is owned by the shell grid (table-layout-engine), not player-row.
    const shellCss = SHELL_CSS;
    expect(shellCss).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--boxes,\s*\n\s*\.bj-view-card-mobile \.bj-table-layout-shell > \.bj-table-zone--boxes/,
    );
    const layoutCss = CARD_LAYOUT_CSS;
    expect(layoutCss).toContain('--bj-card-row-hero-min: 0');
  });

  it('falls back only on ultra-narrow widths (< 360px)', () => {
    const html = renderPanelAt(320, withView(playingState(), 'full'));
    expect(html).toContain('bj-mobile-fallback');
    expect(html).toContain('Use Card View');
  });

  it('includes Assign chips actions in mobile This Table overlay source', () => {
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(panelSrc).toContain('onAssignChips');
    expect(panelSrc).toContain('renderMobileSidePanelBody');
    expect(panelSrc).toContain('TableAccountsPanel');
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

  it('shares mobile table shell; This Table panel lives in overlay source', () => {
    const card = renderPanelAt(390, withView(playingState(), 'card'));
    const full = renderPanelAt(390, withView(playingState(), 'full'));
    expect(card).toContain(TABLE_UX.mobileTableShell);
    expect(full).toContain(TABLE_UX.mobileTableShell);
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(panelSrc).toContain('renderMobileSidePanelBody');
    expect(panelSrc).toContain('TableAccountsPanel');
  });

  it('arc player boxes row includes all slots in order with active highlight and join boxes', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).toContain('bj-arc--player-boxes');
    expect(html).toContain('>10<');
    expect(html).toContain('bj-phone-view__box-value--active-turn');
    expect(html).toContain('Join');
    const order = cardViewMiniBoxOrder(html);
    expect(order.length).toBe(4);
    expect(order[0]).toBe('4');
    expect(order[order.length - 1]).toBe('1');
  });

  it('mobile Card View arc boxes use table visual order; occupied boxes match Full Table arc', () => {
    const state = withView(playingState(), 'card');
    const card = renderPanelAt(390, state);
    const full = renderPanelAt(390, withView(playingState(), 'full'));
    const cardOrder = cardViewMiniBoxOrder(card);
    const arcOrder = arcBoxOrder(full);
    expect(cardOrder.length).toBe(4);
    expect(cardOrder[0]).toBe('4');
    expect(cardOrder[cardOrder.length - 1]).toBe('1');
    expect(cardOrder.filter((n) => arcOrder.includes(n))).toEqual(arcOrder);
  });

  it('desktop Card View matches table order (Box 1 on the right)', () => {
    const state = withView(playingState(), 'card');
    const desktop = renderPanelAt(1280, state);
    const order = cardViewMiniBoxOrder(desktop);
    expect(order.length).toBe(4);
    expect(order[0]).toBe('4');
    expect(order[order.length - 1]).toBe('1');
  });

  it('highlights the active box as the live hero with shell Stay/Hit controls', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    const actionsZone =
      html.split(TABLE_UX.tableZoneActions)[1]?.split(TABLE_UX.tableZoneBoxes)[0] ?? '';
    expect(actionsZone).toContain('ds-btn--hit');
    expect(html).toContain('bj-arc--player-boxes');
    expect(html).toContain('bj-box--turn');
  });
});

describe('Table Details side rail (same slot as This Table)', () => {
  it('does not render inline info chips or dealer Table Details button in the header', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).not.toContain('dealer-block__info-panel');
    expect(html).not.toContain('dealer-block__info-chip');
    expect(html).not.toContain('dealer-block__details-btn');
    expect(html).not.toContain('Table details');
  });

  it('does not use table-details slide overlay markup', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).not.toContain('bj-table-slide-overlay--details');
    expect(html).not.toContain('TableDetailsSlidePanel');
  });

  it('uses overlay panel slot when open (not below-table flow)', () => {
    const mobile = renderPanelAt(390, withView(playingState(), 'card'));
    const desktop = renderPanelAt(1280, withView(playingState(), 'card'));
    expect(mobile).not.toContain('bj-casino__this-table--below');
    expect(desktop).toContain(TABLE_UX.sideRailDock);
    expect(desktop).toContain('data-side-panel="thisTable"');
    expect(mobile).not.toMatch(/bj-table-slide-overlay[^>]*>[\s\S]*table-details-panel/);
    for (const html of [mobile, desktop]) {
      expect(html).not.toContain('bj-table-slide-overlay--details');
    }
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(panelSrc).toContain('TABLE_UX.mobileSidePanelOverlay');
  });
});

describe('shared table UX classes (Full Table + Card View)', () => {
  it('desktop and mobile render canonical rail, felt, and card column surface classes', () => {
    for (const mode of ['full', 'card'] as const) {
      const state = withView(playingState(), mode);
      for (const width of [390, 1280]) {
        const html = renderPanelAt(width, state);
        expect(html).toContain('bj-table-rail');
        expect(html).toContain('bj-table-surface');
        if (mode === 'card') {
          expect(html).toContain(TABLE_UX.tableLayoutShell);
          expect(html).toContain(TABLE_UX.cardsAreaHero);
        }
      }
    }
  });

  it('shared CSS uses one felt gradient for table surface and card column', () => {
    const sharedCss = SHARED_CSS;
    expect(sharedCss).not.toContain('--bj-table-column-bg');
    expect(sharedCss).toMatch(/\.bj-table-column-surface[\s\S]*var\(--bj-table-felt-bg\)/);
    expect(sharedCss).toMatch(/\.bj-bet-zone[\s\S]*var\(--bj-seat-radius\)/);
    expect(sharedCss).toContain('.bj-player-actions');
  });

  it('shared CSS is imported once via index.css', () => {
    const indexCss = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
    expect(indexCss).toContain("bj-table-shared.css");
  });
});

describe('stable dealer layout slots across phases', () => {
  const dealerSlots = [
    'dealer-block__stack',
    'dealer-block__cards-slot',
    'dealer-block__action-slot',
    'dealer-block__command',
  ] as const;

  it('Card View mobile: same dealer slots in betting and playing', () => {
    const betting = renderPanelAt(390, withView(bettingState(), 'card'));
    const playing = renderPanelAt(390, withView(playingState(), 'card'));
    for (const slot of dealerSlots) {
      expect(betting).toContain(slot);
      expect(playing).toContain(slot);
    }
    expect(betting).toContain('dealer-block__card-placeholder');
    expect(playing).toContain('dealer-block__cards');
    expect(betting).toContain(TABLE_UX.tableZoneActions);
    expect(playing).toContain('ds-btn--hit');
    expect(betting).toContain('bj-arc--player-boxes');
    expect(playing).toContain('bj-arc--player-boxes');
  });

  it('Full Table mobile: dealer slots and action bar area across phases', () => {
    const betting = renderPanelAt(390, withView(bettingState(), 'full'));
    const playing = renderPanelAt(390, withView(playingState(), 'full'));
    for (const slot of dealerSlots) {
      expect(betting).toContain(slot);
      expect(playing).toContain(slot);
    }
    expect(betting).toContain('dealer-block__card-placeholder');
    expect(playing).toContain('dealer-block__cards');
    expect(playing).toContain('bj-table-actions');
  });

  it('mobile Full Table actions zone has +10px clearance above boxes', () => {
    expect(SHARED_CSS).toMatch(/--bj-full-mobile-actions-clearance:\s*10px/);
    expect(PLAY_ZONE_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*margin-bottom:\s*var\(--bj-full-mobile-actions-clearance/,
    );
    expect(PLAY_ZONE_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*--bj-full-mobile-actions-clearance/,
    );
  });
});

describe('mobile Card View width contract', () => {
  it('CSS constrains casino rail and hides horizontal overflow on arc player boxes', () => {
    const panelCss = mobileFullTableCss();
    expect(panelCss).toMatch(/\.bj-view-full-mobile[\s\S]*max-width:\s*100%/);
    expect(panelCss).toMatch(/\.bj-view-card-mobile[\s\S]*max-width:\s*100%/);
    expect(panelCss).toMatch(/\.bj-view-card-mobile \.bj-casino__rail[\s\S]*max-width:\s*100%/);
    expect(PLAYER_ROW_CSS).toMatch(/\.bj-table-slot-row[\s\S]*overflow:\s*visible/);
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*minmax\(0,\s*1fr\)/,
    );
  });
});
