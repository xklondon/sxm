import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { TableSideRailShell } from './TableSideRailShell';
import { BLACKJACK_TABLE_LAYOUT } from './blackjackTableLayout';
import { TABLE_UX } from './tableUxContract';
import { tableAfterStartPlaying, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { blackjackHandKey } from '../engine/blackjack';

const noop = () => {};

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('TABLE_UX class contract', () => {
  it('exports stable canonical class names', () => {
    expect(TABLE_UX.surface).toBe('bj-table-surface');
    expect(TABLE_UX.rail).toBe('bj-table-rail');
    expect(TABLE_UX.desktopTableShell).toBe('bj-table-desktop-shell');
    expect(TABLE_UX.pageTitle).toBe('bj-casino__title');
    expect(TABLE_UX.cardViewBareActions).toBe('bj-phone-view__action-bar--bare');
    expect(TABLE_UX.columnSurface).toBe('bj-table-column-surface');
    expect(TABLE_UX.sideRailShell).toBe('bj-side-rail-shell');
    expect(TABLE_UX.sideRailPlacement).toBe('bj-casino__this-table');
  });

  it('BLACKJACK_TABLE_LAYOUT includes TABLE_UX entries', () => {
    expect(BLACKJACK_TABLE_LAYOUT.surface).toBe(TABLE_UX.surface);
    expect(BLACKJACK_TABLE_LAYOUT.rail).toBe(TABLE_UX.rail);
    expect(BLACKJACK_TABLE_LAYOUT.columnSurface).toBe(TABLE_UX.columnSurface);
  });

  it('shared CSS defines one table surface, seat shell, and side-rail shell', () => {
    const css = readSrc('src/styles/bj-table-shared.css');
    expect(css).toContain('.bj-table-surface');
    expect(css).toContain('.bj-table-rail');
    expect(css).toContain('.bj-table-desktop-shell');
    expect(css).toContain('--bj-desktop-table-height');
    expect(css).toContain('.bj-table-column-surface');
    expect(css).toContain('.bj-seat-shell');
    expect(css).toContain('.bj-phone-view__mini-hand');
    expect(css).toContain('.bj-arc__play-zone');
    expect(css).toContain('.bj-bet-zone');
    expect(css).toMatch(/@keyframes bj-turn-pulse/);
    expect(css).toContain('.bj-side-rail-shell');
    expect(css).toContain('.bj-casino__this-table');
    expect(css).toContain('.bj-player-actions');
    expect(css).toContain('.bj-phone-view__action-bar--bare');
    expect(css).not.toContain('--bj-table-column-bg');
    expect(css).toMatch(/\.bj-table-column-surface[\s\S]*var\(--bj-table-felt-bg\)/);
    expect(css).toMatch(/\.bj-bet-zone[\s\S]*--bj-seat-radius/);
    expect(css).toMatch(/\.bj-table-actions[\s\S]*--bj-actions-panel-bg/);
    expect(css).toMatch(/\.bj-view-full-desktop \.bj-arc[\s\S]*margin-top:\s*auto/);
  });

  it('exports bet zone and player action class names', () => {
    expect(TABLE_UX.betZone).toBe('bj-bet-zone');
    expect(TABLE_UX.playerActions).toBe('bj-player-actions');
  });

  it('BlackjackPanel applies shared rail and felt classes', () => {
    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    expect(panelSrc).toContain('TABLE_UX.rail');
    expect(panelSrc).toContain('TABLE_UX.surface');
    expect(panelSrc).toContain('TABLE_UX.desktopTableShell');
    expect(panelSrc).toContain('TABLE_UX.pageTitle');
    expect(panelSrc).toContain('TABLE_UX.playerActions');
    expect(panelSrc).toContain('TableSideRailShell');
  });

  it('BlackjackCardView applies shared column surface and bare action shell', () => {
    const cardSrc = readSrc('src/components/BlackjackCardView.tsx');
    expect(cardSrc).toContain('TABLE_UX.columnSurface');
    expect(cardSrc).toContain('TABLE_UX.playerActions');
    expect(cardSrc).toContain('TABLE_UX.cardViewBareActions');
    expect(cardSrc).toContain('getVisibleHandCardIds');
  });
});

describe('TABLE_UX markup across views', () => {
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
    const deck = state.deck!;
    const box1 = boxPlayerId(state, 1)!;
    const k1 = blackjackHandKey(box1, 0);
    return {
      ...state,
      selectedSeatId: box1,
      blackjack: {
        ...state.blackjack!,
        status: 'player-turns',
        activeHandKey: k1,
        activePlayerId: box1,
        dealerCardIds: [findCardId(deck, '7'), findCardId(deck, 'K')],
        dealerHoleHidden: true,
        playerHands: {
          [k1]: {
            ...createBlackjackPlayerHand(box1, 0),
            cardIds: [findCardId(deck, '6'), findCardId(deck, '7')],
            currentBet: 10,
            actionStatus: 'acting',
          },
        },
      },
    };
  }

  function renderAt(width: number, mode: 'full' | 'card'): string {
    simulatedWidth = width;
    const state: GameState = {
      ...playingState(),
      tableViewMode: mode,
    };
    return renderToStaticMarkup(
      <BlackjackPanel gameState={state} onGameStateChange={noop} />,
    );
  }

  it('Full Table and Card View share rail + surface classes on desktop and mobile', () => {
    for (const width of [1280, 390]) {
      const full = renderAt(width, 'full');
      const card = renderAt(width, 'card');
      for (const html of [full, card]) {
        expect(html).toContain('bj-table-rail');
        expect(html).toContain('bj-table-surface');
      }
      expect(card).toContain('bj-table-column-surface');
    }
  });

  it('desktop Full Table and Card View share canonical desktop table shell', () => {
    const full = renderAt(1280, 'full');
    const card = renderAt(1280, 'card');
    expect(full).toContain('bj-table-desktop-shell');
    expect(card).toContain('bj-table-desktop-shell');
    expect(full).toContain('bj-table-rail');
    expect(card).toContain('bj-table-rail');
  });

  it('BLACKJACK title renders in toolbar outside felt border', () => {
    for (const mode of ['full', 'card'] as const) {
      const html = renderAt(1280, mode);
      const titleIdx = html.indexOf('bj-casino__title');
      const railIdx = html.indexOf('bj-table-rail');
      const toolbarIdx = html.indexOf('bj-casino__toolbar');
      expect(titleIdx).toBeGreaterThan(-1);
      expect(html).toContain('BLACKJACK');
      expect(toolbarIdx).toBeGreaterThan(-1);
      expect(titleIdx).toBeGreaterThan(toolbarIdx);
      expect(railIdx).toBeGreaterThan(titleIdx);
      expect(html).not.toContain('dealer-block__brand');
    }
  });

  it('Card View playing actions use bare shell without panel chrome class pairing', () => {
    const card = renderAt(1280, 'card');
    expect(card).toContain('bj-phone-view__action-bar--bare');
    expect(card).toContain('bj-phone-view__action-bar--playing');
    expect(card).toMatch(/bj-phone-view__action-bar--bare[\s\S]*Stand/);
  });

  it('Card View bottom boxes render visible mini-cards for dealt hands', () => {
    const card = renderAt(1280, 'card');
    expect(card).toContain('bj-phone-view__mini-hand-card-stack');
    expect(card).toContain('bj-phone-view__mini-card');
    expect(card).toContain('playing-card');
  });

  it('player action panels use shared bj-player-actions shell', () => {
    const full = renderAt(1280, 'full');
    const card = renderAt(1280, 'card');
    expect(full).toContain('bj-player-actions');
    expect(card).toContain('bj-player-actions');
    expect(card).toContain('bj-phone-view__action-bar--playing');
  });

  it('bet zones use rectangular seat shell class', () => {
    const html = renderAt(1280, 'full');
    expect(html).toContain('bj-bet-zone');
  });
});

describe('TableSideRailShell', () => {
  it('renders shared header, title, close, and body slots', () => {
    const html = renderToStaticMarkup(
      <TableSideRailShell title="This Table" onClose={noop}>
        <p>Panel body</p>
      </TableSideRailShell>,
    );
    expect(html).toContain('bj-side-rail-shell');
    expect(html).toContain('bj-side-rail-shell__header');
    expect(html).toContain('bj-side-rail-shell__title');
    expect(html).toContain('This Table');
    expect(html).toContain('bj-side-rail-shell__close');
    expect(html).toContain('bj-side-rail-shell__body');
    expect(html).toContain('Panel body');
  });
});
