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
import { CARD_VIEW_HERO_VALUE_CLASS } from './blackjackLayoutContract';

const noop = () => {};
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
const CHIP_CSS = readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');

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

function playingCardViewState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const handKey = blackjackHandKey(box1, 0);
  return {
    ...state,
    tableViewMode: 'card',
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

function bettingCardViewState(): GameState {
  let state = playingCardViewState();
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

describe('Card View display regressions', () => {
  it('reserves a fixed hero value band and clips cards above it on desktop and mobile', () => {
    expect(CARD_LAYOUT_CSS).toContain('--bj-cardview-hero-value-band-height');
    expect(CARD_LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop[\s\S]*\.bj-phone-view__cards-slot[\s\S]*max-height:\s*calc\(100% - var\(--bj-cardview-hero-value-band-height\)\)/,
    );
    expect(CARD_LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile[\s\S]*\.bj-phone-view__hand-meta[\s\S]*flex:\s*0 0 var\(--bj-cardview-hero-value-band-height\)/,
    );
    expect(CARD_LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop[\s\S]*\.bj-phone-view__cards[\s\S]*overflow:\s*hidden/,
    );
  });

  it('desktop Card View renders hero value between cards and actions without overlap', () => {
    simulatedWidth = 1280;
    const html = renderPanel(playingCardViewState());
    const hero = heroZone(html);
    const cardsIdx = hero.indexOf('bj-phone-view__cards-slot');
    const valueIdx = hero.indexOf(CARD_VIEW_HERO_VALUE_CLASS);
    const actionsIdx = html.indexOf(TABLE_UX.tableZoneActions);
    expect(cardsIdx).toBeGreaterThan(-1);
    expect(valueIdx).toBeGreaterThan(cardsIdx);
    expect(actionsIdx).toBeGreaterThan(valueIdx);
    expect(hero).toContain('bj-player-hand-value--emphasis');
    expect(hero).toMatch(/>13</);
  });

  it('mobile Card View renders hero value between cards and actions without overlap', () => {
    simulatedWidth = 390;
    const html = renderPanel(playingCardViewState());
    const hero = heroZone(html);
    const cardsIdx = hero.indexOf('bj-phone-view__cards-slot');
    const valueIdx = hero.indexOf(CARD_VIEW_HERO_VALUE_CLASS);
    const actionsIdx = html.indexOf(TABLE_UX.tableZoneActions);
    expect(cardsIdx).toBeGreaterThan(-1);
    expect(valueIdx).toBeGreaterThan(cardsIdx);
    expect(actionsIdx).toBeGreaterThan(valueIdx);
    expect(hero).toMatch(/>13</);
  });

  it('desktop Card View tray matches shared ValueAndChipsBar label-below-row layout', () => {
    expect(CHIP_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-value-chips--with-label[\s\S]*grid-template-rows:\s*auto auto/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-value-chips--with-label \.bj-value-chips__row--label[\s\S]*grid-row:\s*2/,
    );

    simulatedWidth = 1280;
    const html = renderPanel(playingCardViewState());
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

  it('desktop Card View player boxes show hand total and hide chips during play', () => {
    simulatedWidth = 1280;
    const html = renderPanel(playingCardViewState());
    const boxes = boxesZone(html);
    expect(boxes).toContain('bj-phone-view__mini-hand-value');
    expect(boxes).toMatch(/>13</);
    expect(boxes).not.toContain('stake-chips--bet');
  });

  it('mobile Card View player boxes show hand total and hide chips during play', () => {
    simulatedWidth = 390;
    const html = renderPanel(playingCardViewState());
    const boxes = boxesZone(html);
    expect(boxes).toContain('bj-phone-view__mini-hand-value');
    expect(boxes).toMatch(/>13</);
    expect(boxes).not.toContain('stake-chips--bet');
  });

  it('Card View still shows chip stacks in player boxes during betting', () => {
    for (const width of [1280, 390]) {
      simulatedWidth = width;
      const html = renderPanel(bettingCardViewState());
      expect(boxesZone(html)).toContain('stake-chips--bet');
    }
  });

  it('collapses stake slot when in-box hand total is shown in Card View boxes', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-card-desktop[\s\S]*:has\([\s\S]*\.bj-phone-view__mini-hand-value:not\(\.bj-phone-view__mini-hand-value--placeholder\)[\s\S]*\.bj-phone-view__mini-stake-slot/,
    );
  });
});
