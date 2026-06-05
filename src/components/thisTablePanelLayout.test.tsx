import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { blackjackHandKey } from '../engine/blackjack';

const noop = () => {};

vi.mock('./storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Alice', email: 'alice@test.com' }),
  needsLocalProfileSetup: () => false,
  syncAuthEmailToProfile: () => {},
  getPlayerInitials: () => 'AL',
}));

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

function renderAt(width: number, state: GameState): string {
  simulatedWidth = width;
  return renderToStaticMarkup(
    <BlackjackPanel gameState={{ ...state, tableViewMode: 'card' }} onGameStateChange={noop} />,
  );
}

describe('This Table panel placement', () => {
  it('desktop: floating side panel does not reflow felt', () => {
    const html = renderAt(1280, playingState());
    expect(html).toContain('bj-casino__this-table--float');
    expect(html).not.toContain('bj-casino__this-table--below');
    expect(html).toContain('bj-casino__rail-wrap');
    expect(html).not.toContain('bj-casino__rail--with-this-table');
    expect(html).not.toMatch(/bj-table-slide-overlay[^>]*>[\s\S]*This Table/);
    expect(html).toContain('bj-accounts-panel');
    expect(html).toContain('bj-side-rail-shell');
    expect(html).toContain('bj-side-rail-shell__title');
    const css = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
    const sharedCss = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
    expect(css).toContain('.bj-casino__this-table--float');
    expect(css).toContain('position: absolute');
    expect(css).toContain('max-width: 13rem');
    expect(css).toContain('anchor-name: --this-table-nav');
    expect(css).not.toContain('.bj-casino__rail--with-this-table');
    expect(sharedCss).toContain('.bj-casino__this-table');
    expect(sharedCss).toContain('.bj-side-rail-shell');
    expect(html.indexOf('bj-casino__toolbar')).toBeLessThan(html.indexOf('bj-casino__this-table--float'));
  });

  it('mobile: below chips, not slide overlay', () => {
    const html = renderAt(390, playingState());
    expect(html).toContain('bj-casino__this-table--below');
    expect(html).not.toContain('bj-casino__this-table--side');
    expect(html).not.toMatch(/bj-table-slide-overlay[^>]*>[\s\S]*bj-accounts-panel/);
    expect(html).toContain('bj-accounts-panel');
  });

  it('Play Ledger still uses modal overlay markup', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
    expect(css).toContain('.bj-table-slide-overlay');
  });

  it('Table Details shares this-table panel slot (no details slide overlay)', () => {
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(panelSrc).toContain('TableDetailsPanelContent');
    expect(panelSrc).toContain('data-side-panel={sideRailPanel}');
    expect(panelSrc).not.toContain('TableDetailsSlidePanel');
    const html = renderAt(1280, playingState());
    expect(html).not.toContain('bj-table-slide-overlay--details');
    expect(html).toContain('bj-casino__this-table--float');
    expect(html).toContain('data-side-panel="thisTable"');
  });

  it('Settings modal markup remains separate from side rail', () => {
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(panelSrc).toContain("activeTablePanel === 'settings'");
    expect(panelSrc).toContain("activeTablePanel === 'playLedger'");
  });
});
