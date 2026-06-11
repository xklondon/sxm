import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  it('action rows render in actions zone below hero hand meta', () => {
    const html = renderAt(390);
    const heroIdx = html.indexOf(TABLE_UX.cardsAreaHero);
    const actionsIdx = html.indexOf(TABLE_UX.tableZoneActions);
    const metaIdx = html.indexOf('bj-phone-view__hand-meta');
    const primaryIdx = html.indexOf('sxm-primary-actions');
    expect(heroIdx).toBeGreaterThan(-1);
    expect(actionsIdx).toBeGreaterThan(heroIdx);
    expect(metaIdx).toBeGreaterThan(heroIdx);
    expect(metaIdx).toBeLessThan(actionsIdx);
    expect(primaryIdx).toBeGreaterThan(actionsIdx);
    expect(html).toContain('sxm-secondary-actions');
    expect(html).toMatch(/sxm-primary-actions[\s\S]*Stay/);
    expect(html).toMatch(/sxm-secondary-actions[\s\S]*2×/);
  });

  it('command sits under dealer stack, hero cards below command, then actions', () => {
    const html = renderAt(390);
    expect(html).toContain('dealer-block__stack');
    expect(html).not.toContain('dealer-block__hero-row');
    expect(html).toContain('bj-card-layout__command');
    expect(html).toContain('dealer-block__command');
    expect(html).toMatch(/Box \d+, Alice, your turn\./);
    const stackIdx = html.indexOf('dealer-block__stack');
    const commandIdx = html.indexOf('bj-card-layout__command');
    const heroIdx = html.indexOf(TABLE_UX.cardsAreaHero);
    const actionsIdx = html.indexOf(TABLE_UX.tableZoneActions);
    expect(commandIdx).toBeGreaterThan(stackIdx);
    expect(heroIdx).toBeGreaterThan(commandIdx);
    expect(actionsIdx).toBeGreaterThan(heroIdx);
  });

  it('hero action CSS uses shared shell action panel and player box stack', () => {
    const sharedCss = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions__row/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions__btn--sm/);
    expect(sharedCss).toMatch(/\.bj-phone-view__mini-hand-card-stack[\s\S]*position:\s*relative/);
  });
});
