import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey, addChipToBoxStake } from '../engine/blackjack';
import { tableAfterStartPlaying, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { TABLE_UX } from './tableUxContract';
import {
  CARD_VIEW_HERO_LAYERED_CARD_WRAP_CLASS,
  CARD_VIEW_HERO_VALUE_CLASS,
  FULL_TABLE_PRIMARY_HIT_CLASS,
} from './blackjackLayoutContract';

const noop = () => {};
const CARD_AREA_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
const SHELL_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-blackjack-table-shell.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');

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

function playingState(view: 'full' | 'card'): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const handKey = blackjackHandKey(box1, 0);
  return {
    ...state,
    tableViewMode: view,
    selectedSeatId: box1,
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
    },
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      activeHandKey: handKey,
      activePlayerId: box1,
      dealerCardIds: [findCardId(deck, '7'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: {
        [handKey]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '6'), findCardId(deck, '7')],
          currentBet: 25,
          actionStatus: 'acting',
        },
      },
    },
  };
}

function bettingState(view: 'full' | 'card'): GameState {
  let state = playingState(view);
  const box1 = boxPlayerId(state, 1)!;
  state = addChipToBoxStake(state, box1, 20);
  return {
    ...state,
    blackjack: null,
    tableMeta: { ...state.tableMeta, bettingLocked: false },
  };
}

function renderPanel(state: GameState): string {
  return renderToStaticMarkup(
    createElement(BlackjackPanel, { gameState: state, onGameStateChange: noop }),
  );
}

function zoneSlice(html: string, start: string, end: string): string {
  const startIdx = html.indexOf(start);
  const endIdx = html.indexOf(end, startIdx + start.length);
  return endIdx > startIdx ? html.slice(startIdx, endIdx) : html.slice(startIdx);
}

describe('blackjack final layout fixes', () => {
  it('desktop Full Table pins Hit/Stay lower than prior 0.25rem boxes gap', () => {
    expect(CARD_AREA_CSS).toMatch(/--bj-full-desktop-actions-boxes-gap:\s*0\.3125rem/);
    expect(CARD_AREA_CSS).not.toMatch(/--bj-full-desktop-actions-boxes-gap:\s*0\.25rem/);
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*justify-content:\s*flex-end/,
    );
  });

  it('desktop Full Table keeps stack/value gap token on card column values', () => {
    expect(CARD_AREA_CSS).toMatch(/--bj-full-desktop-stack-value-gap:\s*0\.3125rem/);
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-phone-view__box-value--card-column-below[\s\S]*margin-top:\s*var\(--bj-full-desktop-stack-value-gap\)/,
    );
  });

  it('desktop Card View renders hero value below cards with dealer emphasis token', () => {
    simulatedWidth = 1280;
    const html = renderPanel(playingState('card'));
    const heroZone = zoneSlice(html, 'bj-cards-area--hero', TABLE_UX.tableZoneActions);
    expect(heroZone).toContain(CARD_VIEW_HERO_VALUE_CLASS);
    expect(heroZone).toContain('bj-player-hand-value--emphasis');
    expect(heroZone).toContain('bj-phone-view__hand-meta--below-cards');
    expect(heroZone).toMatch(/>13</);
  });

  it('desktop Card View uses one shell BlackjackActionRow path for Hit/Stay', () => {
    expect((PANEL_SRC.match(/<BlackjackActionRow/g) ?? []).length).toBe(1);
    expect(CARD_VIEW_SRC).not.toContain('BlackjackActionPanel');
    expect(CARD_VIEW_SRC).not.toContain('bj-phone-view__side-action--hit');

    simulatedWidth = 1280;
    const html = renderPanel(playingState('card'));
    const actionsZone = zoneSlice(html, TABLE_UX.tableZoneActions, TABLE_UX.tableZoneBoxes);
    expect(actionsZone).toContain('bj-table-actions');
    expect(actionsZone).toContain(FULL_TABLE_PRIMARY_HIT_CLASS);
    expect(actionsZone).toContain('ds-btn--stand');
  });

  it('desktop Card View actions occupy dedicated grid row (centered)', () => {
    const shellCss = readFileSync(join(process.cwd(), 'src/styles/bj-blackjack-table-shell.css'), 'utf8');
    expect(shellCss).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*grid-row:\s*actions/,
    );
    expect(shellCss).not.toMatch(/--bj-card-desktop-action-offset/);
  });

  it('hero third+ cards use layered offset transform class', () => {
    expect(CARD_VIEW_SRC).toContain(CARD_VIEW_HERO_LAYERED_CARD_WRAP_CLASS);
    expect(CARD_VIEW_CSS).toMatch(
      new RegExp(
        `\\.bj-phone-view__cards--stitched \\.${CARD_VIEW_HERO_LAYERED_CARD_WRAP_CLASS.replace(/\./g, '\\.')}[\\s\\S]*transform:`,
      ),
    );
    expect(CARD_LAYOUT_CSS).toMatch(
      new RegExp(
        `\\.bj-phone-view__card-wrap:not\\(\\.${CARD_VIEW_HERO_LAYERED_CARD_WRAP_CLASS.replace(/\./g, '\\.')}\\)`,
      ),
    );
  });

  it('hides chip stacks inside player boxes during play for all views', () => {
    expect(PANEL_SRC).not.toContain('showPlayChips');
    for (const view of ['full', 'card'] as const) {
      for (const width of [1280, 390]) {
        simulatedWidth = width;
        const html = renderPanel(playingState(view));
        const boxesZone = zoneSlice(html, TABLE_UX.tableZoneBoxes, 'bj-table-zone--bottom');
        expect(boxesZone).toContain('bj-phone-view__mini-hand-value');
        expect(boxesZone).not.toContain('stake-chips--bet');
      }
    }
  });

  it('still renders chip stacks inside player boxes during betting', () => {
    for (const view of ['full', 'card'] as const) {
      for (const width of [1280, 390]) {
        simulatedWidth = width;
        const html = renderPanel(bettingState(view));
        const boxesZone = zoneSlice(html, TABLE_UX.tableZoneBoxes, 'bj-table-zone--bottom');
        expect(boxesZone).toContain('stake-chips--bet');
      }
    }
  });

  it('desktop Card View hero cards zone does not clip value with overflow hidden on shell row', () => {
    const shellCss = readFileSync(join(process.cwd(), 'src/styles/bj-blackjack-table-shell.css'), 'utf8');
    expect(shellCss).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*overflow:\s*hidden/,
    );
    expect(shellCss).not.toMatch(/bj-table-zone--hero-value/);
  });
});
