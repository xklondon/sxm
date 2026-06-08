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

const SHELL_ZONE_ORDER = [
  TABLE_UX.tableZoneDealer,
  TABLE_UX.tableZoneSummary,
  TABLE_UX.tableZoneActions,
  TABLE_UX.tableZoneCards,
  TABLE_UX.tableZoneBoxes,
  TABLE_UX.tableZoneBottom,
] as const;

const CARD_LAYOUT_CSS = 'src/styles/bj-card-layout.css';
const SHELL_TSX = 'src/components/BlackjackTableLayoutShell.tsx';
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
    const zoneIndex = SHELL_ZONE_ORDER.indexOf(zoneClass as (typeof SHELL_ZONE_ORDER)[number]);
    const nextZone = SHELL_ZONE_ORDER[zoneIndex + 1];
    const end = nextZone ? html.indexOf(nextZone, openEnd + 1) : html.length;
    return html.slice(openEnd + 1, end > openEnd ? end : html.length);
  }

  it('renders all shell zones in every phase', () => {
    const phases = [
      tableAfterStartPlaying(500),
      playingState(),
      settlementState(),
    ];
    for (const state of phases) {
      const html = renderCardPanel(state);
      expect(html).toContain(TABLE_UX.tableLayoutShell);
      for (const zone of SHELL_ZONE_ORDER) {
        expect(html).toContain(zone);
      }
      expect(html).toContain(TABLE_UX.cardsAreaHero);
    }
  });

  it('renders player boxes only inside bj-table-zone--boxes', () => {
    const html = renderCardPanel(playingState());
    const boxesSection = zoneSection(html, TABLE_UX.tableZoneBoxes);
    expect(boxesSection).toContain('bj-arc--player-boxes');
    expect(boxesSection).toContain(TABLE_UX.fullArcBox);
    const cardsSection = zoneSection(html, TABLE_UX.tableZoneCards);
    expect(cardsSection).not.toContain('bj-phone-view__mini-hand--card-compact');
    const actionsSection = zoneSection(html, TABLE_UX.tableZoneActions);
    expect(actionsSection).not.toContain('bj-arc--player-boxes');
  });

  it('renders hero hand only inside bj-cards-area--hero', () => {
    const html = renderCardPanel(playingState());
    expect(html).toMatch(new RegExp(`${TABLE_UX.tableZoneCards}[\\s\\S]*${TABLE_UX.cardsAreaHero}`));
    const cardsSection = zoneSection(html, TABLE_UX.tableZoneCards);
    expect(cardsSection).toMatch(/bj-phone-view__hand|bj-phone-view__cards-placeholder/);
    const boxesSection = zoneSection(html, TABLE_UX.tableZoneBoxes);
    expect(boxesSection).not.toContain('bj-phone-view__hero-stage');
    expect(boxesSection).not.toContain('bj-phone-card--hero');
  });

  it('renders action buttons only inside bj-table-zone--actions', () => {
    const html = renderCardPanel(playingState());
    const actionsSection = zoneSection(html, TABLE_UX.tableZoneActions);
    expect(actionsSection).toMatch(/bj-table-actions|bj-player-actions/);
    const cardsSection = zoneSection(html, TABLE_UX.tableZoneCards);
    expect(cardsSection).not.toContain('bj-phone-view__action-bar-btn--hit');
    expect(cardsSection).not.toContain('bj-phone-view__action-bar-btn--stand');
  });

  it('Card View CSS contains no margin-top:auto for boxes', () => {
    const layoutCss = readSrc(CARD_LAYOUT_CSS);
    const boxesBlock = layoutZoneBlock(layoutCss, '.bj-table-zone--boxes');
    const boxesReset =
      layoutCss.match(/\.bj-table-zone--boxes \.bj-arc--player-boxes[\s\S]*?\}/)?.[0] ?? '';
    expect(boxesBlock).not.toMatch(/margin-top:\s*auto/);
    expect(boxesReset).not.toMatch(/margin-top:\s*auto/);
  });

  it('Card View CSS contains no translateY for hero/actions/boxes zones', () => {
    const layoutCss = readSrc(CARD_LAYOUT_CSS);
    for (const selector of [
      '.bj-table-zone--cards.bj-cards-area--hero',
      '.bj-table-zone--actions',
      '.bj-table-zone--boxes',
      '.bj-table-zone--bottom',
    ] as const) {
      const block = layoutZoneBlock(layoutCss, selector);
      expect(block).not.toMatch(/translateY/i);
    }
    const heroReset =
      layoutCss.match(/\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__hand[\s\S]*?\n\}/)?.[0] ??
      '';
    const actionsReset =
      layoutCss.match(/\.bj-table-zone--actions \.bj-phone-view__action-bar[\s\S]*?\n\}/)?.[0] ?? '';
    const boxesReset =
      layoutCss.match(/\.bj-table-zone--boxes \.bj-arc--player-boxes[\s\S]*?\n\}/)?.[0] ?? '';
    expect(heroReset).not.toMatch(/translateY/i);
    expect(actionsReset).not.toMatch(/translateY/i);
    expect(boxesReset).not.toMatch(/translateY/i);
  });

  it('Card View CSS contains no position:absolute for hero/actions/boxes/tray zones', () => {
    const layoutCss = readSrc(CARD_LAYOUT_CSS);
    for (const selector of [
      '.bj-table-zone--cards.bj-cards-area--hero',
      '.bj-table-zone--actions',
      '.bj-table-zone--boxes',
      '.bj-table-zone--bottom',
    ] as const) {
      const block = layoutZoneBlock(layoutCss, selector);
      expect(block).not.toMatch(/position:\s*absolute/);
    }
  });

  it('hero, actions, boxes, and tray are direct shell children via BlackjackTableLayoutShell', () => {
    const shellSrc = readSrc(SHELL_TSX);
    const cardSrc = readSrc(CARD_VIEW_TSX);
    expect(shellSrc).toContain('BlackjackActionsZone');
    expect(shellSrc).toContain('BlackjackCardsAreaZone');
    expect(shellSrc).toContain('BlackjackPlayerBoxesZone');
    expect(shellSrc).toContain('TABLE_UX.tableZoneBottom');
    expect(cardSrc).toContain('bj-phone-view__axis');
    expect(cardSrc).not.toContain('BlackjackActionsZone');
    const html = renderCardPanel(playingState());
    expect(html).toMatch(
      new RegExp(
        `${TABLE_UX.tableLayoutShell}[\\s\\S]*${TABLE_UX.tableZoneActions}[\\s\\S]*${TABLE_UX.tableZoneCards}[\\s\\S]*${TABLE_UX.tableZoneBoxes}[\\s\\S]*${TABLE_UX.tableZoneBottom}`,
      ),
    );
  });

  it('each shell zone declares explicit flex row sizing', () => {
    const sharedCss = readSrc('src/styles/bj-table-shared.css');
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--dealer\s*\{[\s\S]*flex:\s*0\s*0\s*auto/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--summary\s*\{[\s\S]*flex:\s*0\s*0\s*auto/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--actions\s*\{[\s\S]*flex:\s*0\s*0\s*auto/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*flex:\s*1\s*1\s*auto/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--boxes\s*\{[\s\S]*flex:\s*0\s*0\s*auto/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--bottom\s*\{[\s\S]*flex:\s*0\s*0\s*auto/);
  });

  it('boxes row is tall enough for mini-hand tiles with bottom padding', () => {
    const layoutCss = readSrc(CARD_LAYOUT_CSS);
    const sharedCss = readSrc('src/styles/bj-table-shared.css');
    expect(layoutCss).toContain('--bj-card-row-boxes: var(--bj-zone-boxes-height');
    expect(sharedCss).toContain('--bj-zone-boxes-height: 6.25rem');
    expect(layoutCss).toMatch(/\.bj-table-layout-shell[\s\S]*flex-direction:\s*column/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*height:\s*var\(--bj-zone-boxes-height\)/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*padding-bottom:\s*calc/);
  });

  it('boxes row fits mini-hand height plus bottom padding without vertical clip', () => {
    const sharedCss = readSrc('src/styles/bj-table-shared.css');
    const boxesBlock = sharedCss.match(/\.bj-table-layout-shell \.bj-table-zone--boxes\s*\{[\s\S]*?\}/)?.[0] ?? '';
    const miniRowReset =
      sharedCss.match(
        /\.bj-table-layout-shell \.bj-table-zone--boxes \.bj-arc--player-boxes[\s\S]*?overflow:\s*hidden[\s\S]*?\n\}/,
      )?.[0] ?? '';
    expect(boxesBlock).toMatch(/overflow:\s*hidden/);
    expect(miniRowReset).toMatch(/overflow:\s*hidden/);
    expect(miniRowReset).toMatch(/min-width:\s*0/);
    expect(sharedCss).toMatch(/\.bj-casino\.bj-view-card-desktop[\s\S]*overflow:\s*hidden/);
    const boxesRem = parseFloat(/--bj-zone-boxes-height:\s*([\d.]+rem)/.exec(sharedCss)?.[1] ?? '8');
    const handRem = parseFloat(
      /--bj-cardview-desktop-mini-hand-height:\s*([\d.]+rem)/.exec(sharedCss)?.[1] ?? '4.75',
    );
    const padRem = parseFloat(
      /--bj-card-boxes-padding-bottom:\s*([\d.]+rem)/.exec(sharedCss)?.[1] ?? '0.35',
    );
    expect(boxesRem).toBeGreaterThanOrEqual(handRem + padRem);
  });

  it('table shell height gives enough room for all Card View rows', () => {
    const sharedCss = readSrc('src/styles/bj-table-shared.css');
    expect(sharedCss).toContain('--bj-shell-height: min(88vh, 56rem)');
    expect(sharedCss).toMatch(/\.bj-table-desktop-shell[\s\S]*var\(--bj-shell-height\)/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*height:\s*var\(--bj-zone-tray-height\)/);
  });

  it('boxes row contains player arc without expanding page scroll', () => {
    const sharedCss = readSrc('src/styles/bj-table-shared.css');
    const boxesBlock = sharedCss.match(/\.bj-table-layout-shell \.bj-table-zone--boxes\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(boxesBlock).toMatch(/overflow:\s*hidden/);
  });

  it('uses the same zone structure for betting, play, and settlement snapshots', () => {
    const betting = renderCardPanel(tableAfterStartPlaying(500));
    const playing = renderCardPanel(playingState());
    const settlement = renderCardPanel(settlementState());
    for (const html of [betting, playing, settlement]) {
      for (const zone of SHELL_ZONE_ORDER) {
        expect(html).toContain(zone);
      }
      expect(html).toContain(TABLE_UX.tableLayoutShell);
      expect(html).toContain(TABLE_UX.cardsAreaHero);
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
    expect(full).toContain(TABLE_UX.tableZoneCards);
    expect(full).toContain(TABLE_UX.cardsAreaTable);
    expect(full).toContain(TABLE_UX.tableZoneBoxes);
    expect(full).toContain(TABLE_UX.tableZoneBottom);
    expect(full).toContain(TABLE_UX.arcCards);
    expect(full).toContain(TABLE_UX.headerBankInfo);
    expect(full).not.toMatch(/\bbj-card-layout bj-phone-view\b/);
  });
});
