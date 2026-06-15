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

describe('mobile Card View layout contract', () => {
  it('betting phase: page overflow hidden, arc player boxes fit shell width', () => {
    const panelCss = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
    expect(panelCss).toMatch(/\.bj-view-card-mobile[\s\S]*overflow-x:\s*hidden/);
    const playerRowCss = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
    expect(playerRowCss).toMatch(/\.bj-table-slot-row[\s\S]*display:\s*grid/);
    expect(playerRowCss).toMatch(
      /\.bj-view-card-mobile \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*minmax\(0,\s*1fr\)/,
    );
  });

  it('betting and playing share stage, action, and box strip slots', () => {
    const betting = renderPanelAt(390, withView(bettingState(), 'card'));
    const playing = renderPanelAt(390, withView(playingState(), 'card'));
    for (const html of [betting, playing]) {
      expect(html).toContain(TABLE_UX.cardsAreaHero);
      expect(html).toContain(TABLE_UX.tableZoneActions);
      expect(html).toContain(TABLE_UX.tableZoneBoxes);
      expect(html).toContain('bj-arc--player-boxes');
      expect(html).not.toContain('bj-phone-view__slot--betting');
    }
    expect(betting).toContain('bj-phone-view__hand--waiting');
    expect(betting).toContain('bj-phone-view__cards-placeholder');
    expect(betting).not.toContain('bj-phone-view__bet-chip-wrap--main');
    expect(playing).toContain('bj-phone-view__hero-stage');
  });

  it('playing phase: hero side Stay/Hit controls beside stitched cards', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).toContain('bj-phone-view__side-action--hit');
    expect(html).toContain('bj-phone-view__side-action--stand');
    expect(html).toContain('bj-phone-view__play-area--controls');
  });

  it('removes redundant hero label and in-card Full Table button', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).not.toContain('bj-phone-view__hero-label');
    expect(html).not.toContain('bj-phone-view__table-btn');
    expect(html).not.toContain('Full table view');
  });

  it('dealer command area carries box/caller turn text', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).toMatch(/Box \d+ — your turn\./);
  });
});
