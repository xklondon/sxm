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
  CARD_VIEW_HERO_VALUE_CLASS,
  CARD_VIEW_SHELL_VERTICAL_ORDER,
  PLAYER_BOX_IN_PLAY_HAND_VALUE_CLASS,
} from './blackjackLayoutContract';

const noop = () => {};
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
const CHIP_CSS = readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const SHELL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');

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

function heroZone(html: string): string {
  return zoneSlice(html, 'bj-cards-area--hero', TABLE_UX.tableZoneActions);
}

function boxesZone(html: string): string {
  return zoneSlice(html, TABLE_UX.tableZoneBoxes, 'bj-table-zone--bottom');
}

function assertShellVerticalOrder(html: string): void {
  const indices = CARD_VIEW_SHELL_VERTICAL_ORDER.map((zone) => html.indexOf(zone));
  for (const idx of indices) {
    expect(idx).toBeGreaterThan(-1);
  }
  for (let i = 1; i < indices.length; i += 1) {
    expect(indices[i]).toBeGreaterThan(indices[i - 1]!);
  }
}

function assertHeroBeforeActions(html: string): void {
  const cardsZoneIdx = html.indexOf('bj-cards-area--hero');
  const heroValueZoneIdx = html.indexOf('bj-table-zone--hero-value');
  const actionsIdx = html.indexOf(TABLE_UX.tableZoneActions);
  const cardsSlotIdx = html.indexOf('bj-phone-view__cards-slot');
  const valueIdx = html.indexOf(CARD_VIEW_HERO_VALUE_CLASS);
  expect(cardsSlotIdx).toBeGreaterThan(-1);
  expect(cardsZoneIdx).toBeGreaterThan(-1);
  expect(heroValueZoneIdx).toBeGreaterThan(cardsZoneIdx);
  expect(valueIdx).toBeGreaterThan(cardsSlotIdx);
  expect(actionsIdx).toBeGreaterThan(heroValueZoneIdx);
}

describe('Card View display regressions', () => {
  it('uses one shared shell path for actions, boxes, and tray', () => {
    expect(SHELL_SRC).toContain('BlackjackActionsZone');
    expect(SHELL_SRC).toContain('BlackjackPlayerBoxesZone');
    expect(PANEL_SRC).toContain('BlackjackActionRow');
    expect(PANEL_SRC).toContain('renderPlayerBoxesArc');
    expect(PANEL_SRC).toContain('BlackjackTrayRow');
    expect((PANEL_SRC.match(/<BlackjackActionRow/g) ?? []).length).toBe(1);
    expect(CARD_VIEW_SRC).not.toContain('BlackjackActionPanel');
    expect(CARD_VIEW_SRC).not.toContain('renderPlayerBoxesArc');
    expect(CARD_VIEW_SRC).not.toContain('ValueAndChipsBar');
    expect(CARD_VIEW_SRC).not.toContain('bj-phone-view__side-action--hit');
  });

  it('reserves hero value band and clips cards (cards-slot overflow hidden in Card View)', () => {
    expect(CARD_LAYOUT_CSS).toContain('--bj-cardview-hero-value-band-height');
    expect(CARD_LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop[\s\S]*?\.bj-phone-view__cards-slot\s*\{[\s\S]*?overflow:\s*hidden/,
    );
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__hero-stage[\s\S]*min-height:\s*0/,
    );
  });

  it('desktop Card View shell order: dealer → command → hero cards → hero value → actions → boxes → tray', () => {
    simulatedWidth = 1280;
    const html = renderPanel(playingState('card'));
    assertShellVerticalOrder(html);
    assertHeroBeforeActions(html);
    const heroValueZone = zoneSlice(html, 'bj-table-zone--hero-value', TABLE_UX.tableZoneActions);
    expect(heroValueZone).toContain('bj-player-hand-value--emphasis');
    expect(heroValueZone).toMatch(/>13</);
    const cardsOnlyZone = zoneSlice(html, 'bj-cards-area--hero', 'bj-table-zone--hero-value');
    expect(cardsOnlyZone).not.toContain(CARD_VIEW_HERO_VALUE_CLASS);
  });

  it('mobile Card View shell order: dealer → command → hero cards → hero value → actions → boxes → tray', () => {
    simulatedWidth = 390;
    const html = renderPanel(playingState('card'));
    assertShellVerticalOrder(html);
    assertHeroBeforeActions(html);
    const heroValueZone = zoneSlice(html, 'bj-table-zone--hero-value', TABLE_UX.tableZoneActions);
    expect(heroValueZone).toMatch(/>13</);
  });

  it('desktop Card View tray matches shared ValueAndChipsBar label-below-row layout', () => {
    expect(CHIP_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-value-chips--with-label[\s\S]*grid-template-rows:\s*auto auto/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-value-chips--with-label \.bj-value-chips__row--label[\s\S]*grid-row:\s*2/,
    );

    simulatedWidth = 1280;
    const html = renderPanel(playingState('card'));
    const tray = zoneSlice(html, 'bj-table-zone--bottom', 'bj-casino__this-table');
    expect(tray).toContain('bj-value-chips--with-label');
    expect(tray).toContain('bj-value-chips__row--label');
    expect(tray).toContain('SxM Casino Challenge');
    expect(tray).toContain('chip-token--plaque');
  });

  it('does not hide in-box hand totals via global box-value display:none', () => {
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-phone-view__box-value:not\(\.bj-phone-view__box-value--above\):not\(\.bj-phone-view__mini-hand-value\)/,
    );
    expect(CARD_VIEW_CSS).toContain('.bj-phone-view__mini-hand-value.bj-phone-view__box-value');
  });

  it('player boxes show in-box total and hide chips during play in Card View and Full Table', () => {
    for (const view of ['card', 'full'] as const) {
      for (const width of [1280, 390]) {
        simulatedWidth = width;
        const html = renderPanel(playingState(view));
        const boxes = boxesZone(html);
        expect(boxes).toContain(PLAYER_BOX_IN_PLAY_HAND_VALUE_CLASS);
        expect(boxes).toMatch(/>13</);
        expect(boxes).not.toContain('stake-chips--bet');
      }
    }
  });

  it('player boxes still show chip stacks during betting in Card View and Full Table', () => {
    for (const view of ['card', 'full'] as const) {
      for (const width of [1280, 390]) {
        simulatedWidth = width;
        const html = renderPanel(bettingState(view));
        expect(boxesZone(html)).toContain('stake-chips--bet');
      }
    }
  });

  it('collapses stake slot when in-box hand total is shown (all views)', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*:has\([\s\S]*\.bj-phone-view__mini-hand-value:not\(\.bj-phone-view__mini-hand-value--placeholder\)[\s\S]*\.bj-phone-view__mini-stake-slot/,
    );
    expect(PANEL_SRC).not.toContain('showPlayChips');
  });
});
