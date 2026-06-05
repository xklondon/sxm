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
  return html.indexOf('bj-phone-view__slot--boxes');
}

describe('Card View central layout', () => {
  it('dealer command sits under centered stack, not beside cards', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).toContain('dealer-block__stack');
    expect(html).not.toContain('dealer-block__hero-row');
    const stackIdx = html.indexOf('dealer-block__stack');
    const commandIdx = html.indexOf('dealer-block__command');
    const cardsIdx = html.indexOf('dealer-block__cards-slot');
    expect(stackIdx).toBeGreaterThan(-1);
    expect(commandIdx).toBeGreaterThan(stackIdx);
    expect(cardsIdx).toBeGreaterThan(stackIdx);
    expect(cardsIdx).toBeLessThan(commandIdx);
    const dealerCss = readFileSync(join(process.cwd(), 'src/components/DealerBlock.css'), 'utf8');
    expect(dealerCss).toMatch(/\.dealer-block__command[\s\S]*border-top:/);
    expect(dealerCss).not.toMatch(/\.dealer-block__command[\s\S]*border-left:/);
    expect(dealerCss).toMatch(/\.dealer-block__center-col[\s\S]*align-items:\s*center/);
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
      expect(html).toContain('bj-phone-view__slot--stage');
      expect(html).toContain('bj-phone-view__slot--actions');
      expect(html).toContain('bj-phone-view__slot--boxes');
      expect(html).toContain('bj-phone-view__mini-row');
      expect(html).toContain('bj-phone-view__axis');
      expect(html).not.toContain('bj-phone-view__slot--betting');
      expect(html).not.toContain('bj-phone-view__slot--boxes-placeholder');
    }
    expect(betting).toContain('bj-casino__tray');
    expect(betting).toContain('bj-phone-view__action-bar--play-placeholder');
    expect(boxSlotIndex(betting)).toBeGreaterThan(-1);
    expect(boxSlotIndex(playing)).toBeGreaterThan(-1);
    expect(betting.indexOf('bj-phone-view__slot--actions')).toBeLessThan(boxSlotIndex(betting));
    expect(playing.indexOf('bj-phone-view__slot--actions')).toBeLessThan(boxSlotIndex(playing));
  });

  it('central action rows: Stand/Hit then 2x/Split/AID', () => {
    const html = renderPanelAt(390, withView(playingState(), 'card'));
    expect(html).toContain('bj-phone-view__action-bar-row--primary');
    expect(html).toContain('bj-phone-view__action-bar-row--secondary');
    expect(html).toContain('bj-phone-view__side-action--stand');
    expect(html).toContain('bj-phone-view__side-action--hit');
    expect(html).toContain('bj-phone-view__side-action--live');
    const primaryIdx = html.indexOf('bj-phone-view__action-bar-row--primary');
    const extrasIdx = html.indexOf('bj-phone-view__action-bar-row--secondary');
    expect(extrasIdx).toBeGreaterThan(primaryIdx);
    expect(html).toMatch(/bj-phone-view__action-bar-row--primary[\s\S]*Stand/);
    expect(html).toMatch(/bj-phone-view__action-bar-row--primary[\s\S]*Hit/);
    expect(html).toMatch(/bj-phone-view__action-bar-row--secondary[\s\S]*2×/);
  });

  it('hero cards remain overflow-visible on central axis', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
    expect(css).toMatch(/\.bj-phone-view__axis[\s\S]*align-items:\s*center/);
    expect(css).toMatch(/\.bj-phone-view__cards-slot[\s\S]*overflow:\s*visible/);
    expect(css).toMatch(/\.bj-phone-view__hero-stage[\s\S]*overflow:\s*visible/);
    expect(css).toMatch(/\.bj-phone-view__slot--stage[\s\S]*overflow:\s*visible/);
  });
});
