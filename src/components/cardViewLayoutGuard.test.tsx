import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { TABLE_UX } from './tableUxContract';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey } from '../engine/blackjack';

const noop = () => {};

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

const CARD_LAYOUT_ZONES = [
  TABLE_UX.cardLayoutDealer,
  TABLE_UX.cardLayoutSummary,
  TABLE_UX.cardLayoutHero,
  TABLE_UX.cardLayoutActions,
  TABLE_UX.cardLayoutBoxes,
  TABLE_UX.cardLayoutTray,
] as const;

const CARD_LAYOUT_CSS = 'src/styles/bj-card-layout.css';
const CARD_VIEW_TSX = 'src/components/BlackjackCardView.tsx';

function layoutZoneBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\}`))?.[0] ?? '';
}

describe('Card View layout guard', () => {
  let simulatedWidth = 1280;
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

  function settlementState(): GameState {
    const playing = playingState();
    return {
      ...playing,
      blackjack: {
        ...playing.blackjack!,
        status: 'resolved',
        activeHandKey: null,
        activePlayerId: null,
        dealerHoleHidden: false,
      },
    };
  }

  function renderCardPanel(state: GameState, width = 1280): string {
    simulatedWidth = width;
    return renderToStaticMarkup(
      <BlackjackPanel
        gameState={{ ...state, tableViewMode: 'card' }}
        onGameStateChange={noop}
      />,
    );
  }

  function zoneSection(html: string, zoneClass: string): string {
    const classPattern = new RegExp(`class="[^"]*\\b${zoneClass}\\b[^"]*"`);
    const match = classPattern.exec(html);
    expect(match).not.toBeNull();
    const openEnd = html.indexOf('>', match!.index);
    const zoneIndex = CARD_LAYOUT_ZONES.indexOf(zoneClass as (typeof CARD_LAYOUT_ZONES)[number]);
    const nextZone = CARD_LAYOUT_ZONES[zoneIndex + 1];
    const end = nextZone ? html.indexOf(nextZone, openEnd + 1) : html.length;
    return html.slice(openEnd + 1, end > openEnd ? end : html.length);
  }

  it('renders all six grid zones in every phase', () => {
    const phases = [
      tableAfterStartPlaying(500),
      playingState(),
      settlementState(),
    ];
    for (const state of phases) {
      const html = renderCardPanel(state);
      expect(html).toContain(TABLE_UX.cardLayout);
      for (const zone of CARD_LAYOUT_ZONES) {
        expect(html).toContain(zone);
      }
    }
  });

  it('renders player boxes only inside bj-card-layout__boxes', () => {
    const html = renderCardPanel(playingState());
    const boxesSection = zoneSection(html, TABLE_UX.cardLayoutBoxes);
    expect(boxesSection).toContain('bj-phone-view__mini-row');
    expect(boxesSection).toContain(TABLE_UX.cardViewCompactBox);
    const heroSection = zoneSection(html, TABLE_UX.cardLayoutHero);
    expect(heroSection).not.toContain('bj-phone-view__mini-hand--card-compact');
    const actionsSection = zoneSection(html, TABLE_UX.cardLayoutActions);
    expect(actionsSection).not.toContain('bj-phone-view__mini-row');
  });

  it('renders hero hand only inside bj-card-layout__hero', () => {
    const html = renderCardPanel(playingState());
    const heroSection = zoneSection(html, TABLE_UX.cardLayoutHero);
    expect(heroSection).toMatch(/bj-phone-view__hand|bj-phone-view__cards-placeholder/);
    const boxesSection = zoneSection(html, TABLE_UX.cardLayoutBoxes);
    expect(boxesSection).not.toContain('bj-phone-view__hero-stage');
    expect(boxesSection).not.toContain('bj-phone-card--hero');
  });

  it('renders action buttons only inside bj-card-layout__actions', () => {
    const html = renderCardPanel(playingState());
    const actionsSection = zoneSection(html, TABLE_UX.cardLayoutActions);
    expect(actionsSection).toMatch(/bj-phone-view__action-bar|bj-player-actions/);
    const heroSection = zoneSection(html, TABLE_UX.cardLayoutHero);
    expect(heroSection).not.toContain('bj-phone-view__action-bar-btn--hit');
    expect(heroSection).not.toContain('bj-phone-view__action-bar-btn--stand');
  });

  it('Card View CSS contains no margin-top:auto for boxes', () => {
    const layoutCss = readSrc(CARD_LAYOUT_CSS);
    const boxesBlock = layoutZoneBlock(layoutCss, '.bj-card-layout__boxes');
    const boxesReset = layoutCss.match(/\.bj-card-layout__boxes \.bj-phone-view__mini-row[\s\S]*?\}/)?.[0] ?? '';
    expect(boxesBlock).not.toMatch(/margin-top:\s*auto/);
    expect(boxesReset).not.toMatch(/margin-top:\s*auto/);
  });

  it('Card View CSS contains no translateY for hero/actions/boxes zones', () => {
    const layoutCss = readSrc(CARD_LAYOUT_CSS);
    for (const zone of ['__hero', '__actions', '__boxes', '__tray'] as const) {
      const block = layoutZoneBlock(layoutCss, `.bj-card-layout${zone}`);
      expect(block).not.toMatch(/translateY/i);
    }
    const heroReset = layoutCss.match(/\.bj-card-layout__hero \.bj-phone-view__hand[\s\S]*?\n\}/)?.[0] ?? '';
    const actionsReset = layoutCss.match(/\.bj-card-layout__actions \.bj-phone-view__action-bar[\s\S]*?\n\}/)?.[0] ?? '';
    const boxesReset = layoutCss.match(/\.bj-card-layout__boxes \.bj-phone-view__mini-row[\s\S]*?\n\}/)?.[0] ?? '';
    expect(heroReset).not.toMatch(/translateY/i);
    expect(actionsReset).not.toMatch(/translateY/i);
    expect(boxesReset).not.toMatch(/translateY/i);
  });

  it('Card View CSS contains no position:absolute for hero/actions/boxes/tray zones', () => {
    const layoutCss = readSrc(CARD_LAYOUT_CSS);
    for (const zone of ['__hero', '__actions', '__boxes', '__tray'] as const) {
      const block = layoutZoneBlock(layoutCss, `.bj-card-layout${zone}`);
      expect(block).not.toMatch(/position:\s*absolute/);
    }
  });

  it('hero, actions, boxes, and tray are direct grid children in Card View markup', () => {
    const cardSrc = readSrc(CARD_VIEW_TSX);
    expect(cardSrc).toMatch(/<div className=\{TABLE_UX\.cardLayoutHero\}>/);
    expect(cardSrc).toMatch(/<div className=\{TABLE_UX\.cardLayoutActions\}>/);
    expect(cardSrc).toMatch(/<div className=\{TABLE_UX\.cardLayoutBoxes\}>/);
    expect(cardSrc).toMatch(/<div className=\{TABLE_UX\.cardLayoutTray\}>/);
    const html = renderCardPanel(playingState());
    expect(html).toMatch(
      /bj-card-layout[\s\S]*bj-card-layout__hero[\s\S]*bj-card-layout__actions[\s\S]*bj-card-layout__boxes[\s\S]*bj-card-layout__tray/,
    );
  });

  it('each Card View zone declares an explicit grid row', () => {
    const layoutCss = readSrc(CARD_LAYOUT_CSS);
    expect(layoutCss).toMatch(/\.bj-card-layout__dealer\s*\{[\s\S]*grid-row:\s*1/);
    expect(layoutCss).toMatch(/\.bj-card-layout__summary\s*\{[\s\S]*grid-row:\s*2/);
    expect(layoutCss).toMatch(/\.bj-card-layout__hero\s*\{[\s\S]*grid-row:\s*3/);
    expect(layoutCss).toMatch(/\.bj-card-layout__actions\s*\{[\s\S]*grid-row:\s*4/);
    expect(layoutCss).toMatch(/\.bj-card-layout__boxes\s*\{[\s\S]*grid-row:\s*5/);
    expect(layoutCss).toMatch(/\.bj-card-layout__tray\s*\{[\s\S]*grid-row:\s*6/);
  });

  it('boxes row is tall enough for mini-hand tiles with bottom padding', () => {
    const layoutCss = readSrc(CARD_LAYOUT_CSS);
    expect(layoutCss).toContain('--bj-card-row-boxes: 9rem');
    expect(layoutCss).toContain('--bj-card-boxes-padding-bottom: 0.35rem');
    expect(layoutCss).toMatch(/grid-template-rows:[\s\S]*minmax\(var\(--bj-card-row-hero-min\)/);
    expect(layoutZoneBlock(layoutCss, '.bj-card-layout__boxes')).toMatch(/min-height:\s*var\(--bj-card-row-boxes\)/);
    expect(layoutZoneBlock(layoutCss, '.bj-card-layout__boxes')).toMatch(/padding:[\s\S]*var\(--bj-card-boxes-padding-bottom\)/);
  });

  it('boxes row fits mini-hand height plus bottom padding without vertical clip', () => {
    const layoutCss = readSrc(CARD_LAYOUT_CSS);
    const sharedCss = readSrc('src/styles/bj-table-shared.css');
    const boxesBlock = layoutZoneBlock(layoutCss, '.bj-card-layout__boxes');
    const miniRowReset = layoutCss.match(/\.bj-card-layout__boxes \.bj-phone-view__mini-row[\s\S]*?\n\}/)?.[0] ?? '';
    expect(boxesBlock).not.toMatch(/overflow:\s*hidden/);
    expect(miniRowReset).toMatch(/overflow-y:\s*visible/);
    expect(miniRowReset).toMatch(/min-height:\s*0/);
    expect(miniRowReset).toMatch(/max-height:\s*100%/);
    expect(sharedCss).toMatch(/\.bj-view-card-desktop \.bj-phone-view\.bj-card-layout[\s\S]*overflow:\s*hidden/);
    const boxesRem = parseFloat(/--bj-card-row-boxes:\s*([\d.]+rem)/.exec(layoutCss)?.[1] ?? '8');
    const handRem = parseFloat(
      /--bj-cardview-desktop-mini-hand-height:\s*([\d.]+rem)/.exec(sharedCss)?.[1] ?? '4.75',
    );
    const padRem = parseFloat(
      /--bj-card-boxes-padding-bottom:\s*([\d.]+rem)/.exec(layoutCss)?.[1] ?? '0.35',
    );
    expect(boxesRem).toBeGreaterThanOrEqual(handRem + padRem);
  });

  it('table shell height gives enough room for all Card View rows', () => {
    const layoutCss = readSrc(CARD_LAYOUT_CSS);
    expect(layoutCss).toContain('--bj-card-desktop-table-height');
    expect(layoutCss).toMatch(/\.bj-view-card-desktop \.bj-table-desktop-shell[\s\S]*var\(--bj-card-desktop-table-height\)/);
    expect(layoutCss).toMatch(/grid-template-rows:[\s\S]*var\(--bj-card-row-tray\)/);
  });

  it('does not clip Card View boxes row with overflow:hidden', () => {
    const layoutCss = readSrc(CARD_LAYOUT_CSS);
    const boxesBlock = layoutZoneBlock(layoutCss, '.bj-card-layout__boxes');
    expect(boxesBlock).not.toMatch(/overflow:\s*hidden/);
    expect(boxesBlock).toMatch(/overflow:\s*visible/);
  });

  it('uses the same zone structure for betting, play, and settlement snapshots', () => {
    const betting = renderCardPanel(tableAfterStartPlaying(500));
    const playing = renderCardPanel(playingState());
    const settlement = renderCardPanel(settlementState());
    for (const html of [betting, playing, settlement]) {
      for (const zone of CARD_LAYOUT_ZONES) {
        expect(html).toContain(zone);
      }
      expect(html).toContain(TABLE_UX.cardLayout);
    }
  });

  it('Card View shows bank info under page title outside felt', () => {
    const html = renderCardPanel(playingState());
    expect(html).toContain(TABLE_UX.headerBankInfo);
    expect(html).toContain('Bank chips:');
    const titleIdx = html.indexOf('BLACKJACK');
    const headerEnd = html.indexOf('</header>');
    const infoIdx = html.indexOf(TABLE_UX.headerBankInfo);
    expect(titleIdx).toBeGreaterThan(-1);
    expect(infoIdx).toBeGreaterThan(titleIdx);
    expect(infoIdx).toBeLessThan(headerEnd);
    expect(html).not.toContain(TABLE_UX.dealerBankInfo);
  });

  it('Full Table layout tests still pass canonical zone markers', () => {
    simulatedWidth = 1280;
    const full = renderToStaticMarkup(
      <BlackjackPanel
        gameState={{ ...playingState(), tableViewMode: 'full' }}
        onGameStateChange={noop}
      />,
    );
    expect(full).toContain(TABLE_UX.tableZoneDealer);
    expect(full).toContain(TABLE_UX.tableZonePlay);
    expect(full).toContain(TABLE_UX.tableZoneBottom);
    expect(full).toContain(TABLE_UX.arcCards);
    expect(full).toContain(TABLE_UX.dealerBankInfo);
    expect(full).not.toContain(TABLE_UX.cardLayout);
  });
});
