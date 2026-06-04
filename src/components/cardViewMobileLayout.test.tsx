import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
  it('betting phase: page overflow hidden, betting row scrolls internally', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
    expect(css).toMatch(/\.bj-view-card-mobile[\s\S]*overflow-x:\s*hidden/);
    expect(css).toMatch(/\.bj-view-card-mobile \.bj-phone-view__betting-stage--row[\s\S]*overflow-x:\s*auto/);
  });

  it('betting and playing both render fixed action and box slots', () => {
    const betting = renderPanelAt(390, withView(bettingState(), 'card'));
    const playing = renderPanelAt(390, withView(playingState(), 'card'));
    for (const html of [betting, playing]) {
      expect(html).toContain('bj-phone-view__slot--actions');
      expect(html).toContain('bj-phone-view__action-bar');
    }
    expect(betting).toContain('bj-phone-view__slot--betting');
    expect(playing).toContain('bj-phone-view__slot--boxes');
    expect(playing).toContain('bj-phone-view__mini-row');
  });

  it('playing phase: Stand left, Hit right beside hero cards; extras in action bar', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).toContain('bj-phone-view__hero-stage');
    expect(html).toContain('bj-phone-view__side-action--stand');
    expect(html).toContain('bj-phone-view__side-action--hit');
    expect(html).toContain('bj-phone-view__action-bar-secondary');
    const standIdx = html.indexOf('bj-phone-view__side-action--stand');
    const hitIdx = html.indexOf('bj-phone-view__side-action--hit');
    const splitIdx = html.indexOf('bj-phone-view__action-bar-extra');
    expect(standIdx).toBeGreaterThan(-1);
    expect(hitIdx).toBeGreaterThan(standIdx);
    expect(splitIdx).toBeGreaterThan(hitIdx);
  });

  it('removes redundant hero label and in-card Full Table button', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).not.toContain('bj-phone-view__hero-label');
    expect(html).not.toContain('bj-phone-view__table-btn');
    expect(html).not.toContain('Full table view');
  });

  it('dealer command area carries box/caller turn text', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).toMatch(/Box \d+ — Alice.{0,12}turn/);
  });
});
