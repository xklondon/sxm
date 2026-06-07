import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey } from '../engine/blackjack';

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
    tableViewMode: 'card',
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

function renderAt(width: number): string {
  simulatedWidth = width;
  return renderToStaticMarkup(
    <BlackjackPanel gameState={playingState()} onGameStateChange={noop} />,
  );
}

describe('Card View layout polish', () => {
  it('central action rows sit under hand meta', () => {
    const html = renderAt(390);
    const metaIdx = html.indexOf('bj-phone-view__hand-meta');
    const primaryIdx = html.indexOf('bj-phone-view__action-bar-row--primary');
    expect(metaIdx).toBeGreaterThan(-1);
    expect(primaryIdx).toBeGreaterThan(metaIdx);
    expect(html).toContain('bj-phone-view__action-bar-row--secondary');
    expect(html).toMatch(/bj-phone-view__action-bar-row--primary[\s\S]*Stand/);
    expect(html).toMatch(/bj-phone-view__action-bar-row--secondary[\s\S]*2×/);
  });

  it('command box sits between dealer stack and hero display', () => {
    const html = renderAt(390);
    expect(html).toContain('dealer-block__stack');
    expect(html).not.toContain('dealer-block__hero-row');
    expect(html).toContain('bj-card-layout__command');
    expect(html).toContain('dealer-block__command');
    expect(html).toMatch(/Box \d+: Alice, you have \d+\./);
    const stackIdx = html.indexOf('dealer-block__stack');
    const commandIdx = html.indexOf('bj-card-layout__command');
    const heroIdx = html.indexOf('bj-card-layout__hero');
    expect(commandIdx).toBeGreaterThan(stackIdx);
    expect(heroIdx).toBeGreaterThan(commandIdx);
  });

  it('hero action CSS uses two centered rows with smaller extras', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
    expect(css).toContain('.bj-phone-view__action-bar--playing');
    expect(css).toContain('.bj-phone-view__action-bar-row--primary');
    expect(css).toContain('.bj-phone-view__action-bar-row--secondary');
    expect(css).toContain('.bj-phone-view__mini-hand-card-stack');
  });
});
