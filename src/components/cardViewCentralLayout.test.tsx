import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState, TableViewMode } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { TABLE_UX } from './tableUxContract';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { addChipToBoxStake, blackjackHandKey } from '../engine/blackjack';

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

function renderPanelAt(width: number, state: GameState): string {
  simulatedWidth = width;
  return renderToStaticMarkup(<BlackjackPanel gameState={state} onGameStateChange={noop} />);
}

function withView(state: GameState, mode: TableViewMode): GameState {
  return { ...state, tableViewMode: mode };
}

function bettingState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, 2);
  const ownerPersonId = state.tableMeta.ownerPersonId!;
  const box1 = boxPlayerId(state, 1)!;
  state = addChipToBoxStake(state, box1, 50, ownerPersonId);
  return state;
}

function playingState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, 2);
  const deck = state.deck!;
  const box2 = boxPlayerId(state, 2)!;
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

function boxSlotIndex(html: string): number {
  return html.indexOf(TABLE_UX.tableZoneBoxes);
}

describe('Card View central layout', () => {
  it('dealer command sits between dealer stack and hero cards, with actions below hero', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).toContain('dealer-block__stack');
    expect(html).toContain('bj-card-layout__command');
    expect(html).not.toContain('dealer-block__hero-row');
    const stackIdx = html.indexOf('dealer-block__stack');
    const commandIdx = html.indexOf('bj-card-layout__command');
    const heroIdx = html.indexOf(TABLE_UX.cardsAreaHero);
    const actionsIdx = html.indexOf(TABLE_UX.tableZoneActions);
    const cardsIdx = html.indexOf('dealer-block__cards-slot');
    expect(stackIdx).toBeGreaterThan(-1);
    expect(commandIdx).toBeGreaterThan(stackIdx);
    expect(heroIdx).toBeGreaterThan(commandIdx);
    expect(actionsIdx).toBeGreaterThan(heroIdx);
    expect(cardsIdx).toBeGreaterThan(stackIdx);
    expect(cardsIdx).toBeLessThan(commandIdx);
    const layoutCss = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
    const sharedCss = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
    expect(layoutCss).toContain('.bj-card-layout__command');
    expect(sharedCss).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__command[\s\S]*max-height:\s*none/,
    );
  });

  it('betting phase does not render central selected-box card', () => {
    const html = renderPanelAt(390, withView(bettingState(), 'card'));
    expect(html).not.toContain('bj-phone-view__betting-center');
    expect(html).not.toContain('bj-phone-view__bet-chip-wrap--main');
    expect(html).not.toContain('bj-phone-view__bet-chip--hero');
    expect(html).toContain('bj-phone-view__hand--waiting');
    expect(html).toContain('bj-phone-view__cards-placeholder');
    expect(html).toContain('bj-phone-view__total--placeholder');
    expect(html).not.toMatch(/>Betting</);
    expect(html).not.toMatch(/>Bet \d+</);
  });

  it('betting and playing use the same main layout slots', () => {
    const betting = renderPanelAt(390, withView(bettingState(), 'card'));
    const playing = renderPanelAt(390, withView(playingState(), 'card'));
    for (const html of [betting, playing]) {
      expect(html).toContain(TABLE_UX.cardsAreaHero);
      expect(html).toContain(TABLE_UX.tableZoneActions);
      expect(html).toContain(TABLE_UX.tableZoneBoxes);
      expect(html).toContain('bj-arc--player-boxes');
      expect(html).toContain('bj-phone-view__axis');
      expect(html).not.toContain('bj-phone-view__slot--betting');
      expect(html).not.toContain('bj-phone-view__slot--boxes-placeholder');
    }
    expect(betting).toContain('bj-value-chips');
    expect(betting).toContain(TABLE_UX.actionsPlaceholder);
    expect(boxSlotIndex(betting)).toBeGreaterThan(-1);
    expect(boxSlotIndex(playing)).toBeGreaterThan(-1);
    expect(betting.indexOf(TABLE_UX.cardsAreaHero)).toBeLessThan(betting.indexOf(TABLE_UX.tableZoneActions));
    expect(playing.indexOf(TABLE_UX.cardsAreaHero)).toBeLessThan(playing.indexOf(TABLE_UX.tableZoneActions));
    expect(betting.indexOf(TABLE_UX.tableZoneActions)).toBeLessThan(boxSlotIndex(betting));
    expect(playing.indexOf(TABLE_UX.tableZoneActions)).toBeLessThan(boxSlotIndex(playing));
  });

  it('central action rows: Stay/Hit then 2×/Split/AID', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).toContain('bj-table-actions__row');
    expect(html).toContain('sxm-secondary-actions');
    expect(html).toContain('ds-btn--stand');
    expect(html).toContain('ds-btn--hit');
    const primaryIdx = html.indexOf('sxm-primary-actions');
    const extrasIdx = html.indexOf('sxm-secondary-actions');
    expect(extrasIdx).toBeGreaterThan(primaryIdx);
    expect(html).toMatch(/sxm-primary-actions[\s\S]*Stay/);
    expect(html).toMatch(/sxm-primary-actions[\s\S]*Hit/);
    expect(html).toMatch(/sxm-secondary-actions[\s\S]*2×/);
  });

  it('hero content is contained inside the cards area zone', () => {
    const layoutCss = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
    expect(layoutCss).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*overflow:\s*visible/);
    expect(layoutCss).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__hand[\s\S]*max-height:\s*100%/);
  });
});
