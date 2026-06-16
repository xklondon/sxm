import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey } from '../engine/blackjack';
import { tableAfterStartPlaying, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import {
  FULL_TABLE_ACTIONS_RENDER_FN,
  FULL_TABLE_CARD_STACK_HOST_CLASS,
  FULL_TABLE_FORBIDDEN_CARD_AREA_ACTION_MARKERS,
  FULL_TABLE_PLAY_ZONE_CSS,
  FULL_TABLE_SHELL_ZONE_ORDER,
  FULL_TABLE_CARD_COLUMN_VIEW_ROOTS,
} from './blackjackLayoutContract';

const PLAY_ZONE_CSS = readFileSync(join(process.cwd(), FULL_TABLE_PLAY_ZONE_CSS), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const SHELL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');
const INDEX_CSS = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');

const noop = () => {};

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
    tableViewMode: 'full',
    selectedSeatId: box1,
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
    },
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

function renderFullTableAt(width: number): string {
  simulatedWidth = width;
  return renderToStaticMarkup(
    createElement(BlackjackPanel, { gameState: playingState(), onGameStateChange: noop }),
  );
}

function extractCardsTableZone(html: string): string {
  const start = html.indexOf('bj-cards-area--table');
  if (start < 0) {
    return '';
  }
  const actionsIdx = html.indexOf('bj-table-zone--actions', start);
  return actionsIdx > start ? html.slice(start, actionsIdx) : html.slice(start);
}

function extractActionsZone(html: string): string {
  const start = html.indexOf('bj-table-zone--actions');
  if (start < 0) {
    return '';
  }
  const boxesIdx = html.indexOf('bj-table-zone--boxes', start);
  return boxesIdx > start ? html.slice(start, boxesIdx) : html.slice(start);
}

function cardColumnWithCards(cardsZone: string): string {
  const columns = cardsZone.split('bj-arc__slot--card-column').slice(1);
  for (const chunk of columns) {
    if (chunk.includes('playing-card')) {
      return `bj-arc__slot--card-column${chunk}`;
    }
  }
  return '';
}

describe('Full Table play zone canonical contract', () => {
  it('imports play-zone CSS after shared, player-row, and card-layout', () => {
    expect(INDEX_CSS.indexOf('bj-table-shared.css')).toBeLessThan(INDEX_CSS.indexOf('bj-card-layout.css'));
    expect(INDEX_CSS.indexOf('bj-card-layout.css')).toBeLessThan(INDEX_CSS.indexOf('bj-full-table-card-area.css'));
    expect(INDEX_CSS.indexOf('bj-full-table-card-area.css')).toBeLessThan(INDEX_CSS.indexOf('bj-felt-skins.css'));
  });

  it('documents shell zone order dealer → command → cards → actions → boxes → tray', () => {
    expect(FULL_TABLE_SHELL_ZONE_ORDER).toEqual(['dealer', 'command', 'cards', 'actions', 'boxes', 'tray']);
    expect(SHELL_SRC).toMatch(/dealer[\s\S]*BlackjackCommandZone[\s\S]*BlackjackCardsAreaZone[\s\S]*BlackjackActionsZone[\s\S]*BlackjackPlayerBoxesZone/);
  });

  it('uses one Full Table actions render path via shell actions slot', () => {
    expect(PANEL_SRC).toContain(FULL_TABLE_ACTIONS_RENDER_FN);
    expect(PANEL_SRC).toContain('actions={renderActionsContent()}');
    expect(PANEL_SRC).toContain('BlackjackActionRow');
    expect(CARD_VIEW_SRC).not.toContain('BlackjackActionRow');
    expect((PANEL_SRC.match(/<BlackjackActionRow/g) ?? []).length).toBe(1);
  });

  it('hides action controls inside Full Table card area via CSS guard', () => {
    for (const marker of FULL_TABLE_FORBIDDEN_CARD_AREA_ACTION_MARKERS) {
      expect(PLAY_ZONE_CSS).toContain(`.bj-table-zone--cards.bj-cards-area--table .${marker}`);
      expect(PLAY_ZONE_CSS).toMatch(
        new RegExp(
          `\\.bj-view-full-desktop \\.bj-table-zone--cards\\.bj-cards-area--table \\.${marker.replace(/\./g, '\\.')}[\\s\\S]*display:\\s*none`,
        ),
      );
    }
  });

  it('bottom-pins card columns with visible stacks (no clip on 2-card hands)', () => {
    expect(PLAY_ZONE_CSS).toContain('--bj-full-table-card-stack-zone-min-2');
    const cardZoneRule =
      PLAY_ZONE_CSS.match(
        /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table\s*\{[^}]*\}/,
      )?.[0] ?? '';
    expect(cardZoneRule).toMatch(/overflow:\s*visible/);
    expect(cardZoneRule).not.toMatch(/overflow-y:\s*visible/);
    expect(cardZoneRule).not.toMatch(/overflow-x:\s*hidden/);
    for (const viewRoot of FULL_TABLE_CARD_COLUMN_VIEW_ROOTS) {
      expect(PLAY_ZONE_CSS).toMatch(
        new RegExp(
          `\\.${viewRoot} \\.bj-arc--cards\\.bj-full-table-card-area \\.bj-arc__slot--card-column > \\.bj-phone-view__box-value--card-column-below[\\s\\S]*grid-row:\\s*3`,
        ),
      );
    }
  });

  it('does not reintroduce competing card-area layout in shared, card-layout, or panel CSS', () => {
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards\s*\{[^}]*overflow:\s*hidden/,
    );
    expect(CARD_LAYOUT_CSS).not.toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table \.bj-arc--cards[\s\S]*overflow:\s*hidden/,
    );
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table \.bj-table-slot-row\.bj-arc--cards\s*\{[^}]*height:\s*100%/,
    );
    expect(PANEL_CSS).not.toMatch(/\.bj-view-full-mobile \.bj-arc--cards\s*\{[^}]*flex:\s*1\s+1\s+auto/);
    expect(PANEL_CSS).toContain('.bj-arc--cards:not(.bj-full-table-card-area) .bj-arc__slot');
  });

  it('styles Full Table desktop and mobile action zone under card area', () => {
    expect(PLAY_ZONE_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*height:\s*var\(--bj-zone-actions-height\)/,
    );
    expect(PLAY_ZONE_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*height:\s*var\(--bj-zone-actions-height\)/,
    );
    expect(PLAY_ZONE_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--actions \.ds-btn--hit/,
    );
  });

  it('marks card arc row with FULL_TABLE_CARD_AREA_CLASS in panel', () => {
    expect(PANEL_SRC).toContain('FULL_TABLE_CARD_AREA_CLASS');
    expect(PANEL_SRC).toMatch(/['"]bj-arc--cards['"][\s\S]*FULL_TABLE_CARD_AREA_CLASS/);
    expect(PANEL_SRC).toContain(FULL_TABLE_CARD_STACK_HOST_CLASS);
  });

  it('pins stack host to grid row 2 (play-zone wrapper, not direct stack-vertical child)', () => {
    for (const viewRoot of FULL_TABLE_CARD_COLUMN_VIEW_ROOTS) {
      expect(PLAY_ZONE_CSS).toMatch(
        new RegExp(
          `\\.${viewRoot} \\.bj-arc--cards\\.bj-full-table-card-area \\.bj-arc__slot--card-column > \\.bj-arc__play-zone[\\s\\S]*grid-row:\\s*2`,
        ),
      );
    }
  });

  it('card column contract avoids vertical centering / flex-grow on stack host', () => {
    const stackHostRule =
      PLAY_ZONE_CSS.match(
        /\.bj-view-full-desktop \.bj-arc--cards\.bj-full-table-card-area \.bj-arc__slot--card-column > \.bj-arc__play-zone[\s\S]*?\{[^}]*\}/,
      )?.[0] ?? '';
    expect(stackHostRule).toContain('align-self: end');
    expect(stackHostRule).toContain('justify-content: flex-end');
    expect(stackHostRule).not.toContain('align-self: center');
    expect(stackHostRule).not.toContain('justify-content: center');
    expect(stackHostRule).not.toMatch(/[^-]flex:\s*1\s+1\s+auto/);
  });

  it('desktop Full Table renders visible playing cards in cards zone (not only values)', () => {
    const html = renderFullTableAt(1280);
    expect(html).toContain('bj-view-full-desktop');
    const cardsZone = extractCardsTableZone(html);
    expect(cardsZone).toContain('bj-full-table-card-area');
    expect(cardsZone).toContain('playing-card');
    expect(cardsZone).toContain(FULL_TABLE_CARD_STACK_HOST_CLASS);
    const column = cardColumnWithCards(cardsZone);
    expect(column).toContain('playing-card');
    expect(column).toContain('bj-phone-view__box-value--card-column-below');
    expect(column.indexOf('playing-card')).toBeLessThan(
      column.indexOf('bj-phone-view__box-value--card-column-below'),
    );
  });

  it('mobile Full Table renders visible playing cards in cards zone (not only values)', () => {
    const html = renderFullTableAt(390);
    expect(html).toContain('bj-view-full-mobile');
    const cardsZone = extractCardsTableZone(html);
    expect(cardsZone).toContain('playing-card');
    const column = cardColumnWithCards(cardsZone);
    expect(column).toContain('playing-card');
    expect(column.indexOf('playing-card')).toBeLessThan(
      column.indexOf('bj-phone-view__box-value--card-column-below'),
    );
  });

  it('renders Hit/Stay only in actions zone below card area', () => {
    for (const width of [1280, 390] as const) {
      const html = renderFullTableAt(width);
      const cardsZone = extractCardsTableZone(html);
      const actionsZone = extractActionsZone(html);
      expect(cardsZone).not.toContain('ds-btn--hit');
      expect(cardsZone).not.toContain('ds-btn--stand');
      expect(actionsZone).toContain('ds-btn--hit');
      expect(actionsZone).toContain('ds-btn--stand');
      expect(html.indexOf('bj-table-zone--cards')).toBeLessThan(html.indexOf('bj-table-zone--actions'));
    }
  });
});
