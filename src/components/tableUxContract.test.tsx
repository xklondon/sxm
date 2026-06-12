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
    expect(TABLE_UX.desktopStage).toBe('bj-casino__desktop-stage');
    expect(TABLE_UX.sideRailDock).toBe('bj-casino__this-table--dock');
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
    const panelCss = readSrc('src/components/BlackjackPanel.css');
    expect(css).toContain('.bj-table-surface');
    expect(css).toContain('.bj-table-rail');
    expect(css).toContain('.bj-table-desktop-shell');
    expect(css).toContain('--bj-shell-height: min(88vh, 56rem)');
    expect(css).toContain('--bj-shell-width: min(98vw, 86rem)');
    expect(css).toContain('--bj-desktop-table-height: var(--bj-shell-height)');
    expect(css).toContain('--bj-desktop-table-max-width: var(--bj-shell-width)');
    expect(css).toContain('--bj-player-box-width: 4.85rem');
    expect(css).toContain('--bj-desktop-seat-width: var(--bj-player-box-width)');
    expect(css).toContain('--bj-desktop-mini-hand-width: var(--bj-player-box-width)');
    expect(css).toMatch(/\.bj-view-full-desktop \.bj-casino__felt,\s*\n\s*\.bj-view-card-desktop \.bj-casino__felt/);
    expect(css).toMatch(/\.bj-table-layout-shell\s*\{[\s\S]*background:\s*var\(--bj-table-felt-bg\)/);
    expect(css).toMatch(/--bj-desktop-felt-bg:\s*var\(--bj-table-felt-bg\)/);
    expect(css).toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*background:\s*transparent/,
    );
    expect(css).toMatch(/\.bj-view-full-desktop \.bj-table-zone--boxes[\s\S]*justify-content:\s*flex-end/);
    expect(css).toMatch(/\.bj-view-full-desktop \.bj-arc__slot \.bj-phone-view__mini-hand/);
    expect(css).toMatch(/\.bj-view-card-desktop \.bj-arc__slot \.bj-phone-view__mini-hand[\s\S]*--bj-desktop-mini-hand-width/);
    expect(css).toMatch(/\.bj-casino__this-table--dock[\s\S]*flex:\s*0\s*0\s*12\.5rem/);
    expect(css).toMatch(/\.bj-view-card-desktop \.bj-phone-view\.bj-table-column-surface[\s\S]*background:\s*transparent/);
    expect(css).toMatch(/\.bj-table-desktop-shell[\s\S]*height:\s*var\(--bj-desktop-table-height\)/);
    expect(css).toMatch(/\.bj-table-desktop-shell[\s\S]*overflow:\s*hidden/);
    expect(css).toContain('--bj-desktop-mini-row-height: 7.25rem');
    expect(panelCss).not.toMatch(/\.bj-view-card-desktop \.bj-phone-view__hero-stage[\s\S]*min-height:\s*11\.5rem/);
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
    expect(css).toMatch(/\.bj-view-full-desktop \.bj-arc--cards[\s\S]*overflow:\s*hidden/);
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
    expect(panelSrc).toContain('TABLE_UX.desktopStage');
    expect(panelSrc).toContain('getBoxCardVisualClasses');
    expect(panelSrc).toContain('bj-phone-view__mini-hand');
    expect(panelSrc).toContain('variant="felt"');
    expect(panelSrc).toContain('tableBankInfo');
    expect(panelSrc).toContain('TABLE_UX.playerActions');
    expect(panelSrc).toContain('TableSideRailShell');
  });

  it('BlackjackCardView renders hero-only axis content without layout shell', () => {
    const cardSrc = readSrc('src/components/BlackjackCardView.tsx');
    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    const actionPanelSrc = readSrc('src/components/BlackjackActionPanel.tsx');
    expect(cardSrc).toContain('bj-phone-view__axis');
    expect(cardSrc).not.toContain('BlackjackActionPanel');
    expect(cardSrc).not.toContain('BlackjackTableLayoutShell');
    expect(cardSrc).not.toContain('renderPlayerBoxesArc');
    expect(panelSrc).toContain('BlackjackTableLayoutShell');
    expect(panelSrc).toContain('renderActionsContent');
    expect(actionPanelSrc).toContain('bj-table-actions');
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
      expect(card).toContain(TABLE_UX.tableLayoutShell);
    }
  });

  it('desktop Full Table and Card View share canonical desktop table shell', () => {
    const full = renderAt(1280, 'full');
    const card = renderAt(1280, 'card');
    expect(full).toContain('bj-table-desktop-shell');
    expect(card).toContain('bj-table-desktop-shell');
    expect(full).toContain('bj-table-rail');
    expect(card).toContain('bj-table-rail');
    expect(full).toContain('bj-table-surface');
    expect(card).toContain('bj-table-surface');
  });

  it('desktop shell CSS uses one height token for both views without divergent overrides', () => {
    const css = readSrc('src/styles/bj-table-shared.css');
    const panelCss = readSrc('src/components/BlackjackPanel.css');
    expect(css).toContain('--bj-shell-height: min(88vh, 56rem)');
    expect(css).toContain('--bj-shell-width: min(98vw, 86rem)');
    expect(css).toContain('--bj-desktop-table-height: var(--bj-shell-height)');
    expect(css).toContain('--bj-desktop-table-max-width: var(--bj-shell-width)');
    expect((css.match(/--bj-shell-height:/g) ?? []).length).toBe(1);
    expect((css.match(/--bj-shell-width:/g) ?? []).length).toBe(1);
    expect(css).toMatch(/\.bj-view-full-desktop \.bj-arc__slot \.bj-phone-view__mini-hand[\s\S]*--bj-desktop-mini-hand-width/);
    expect(css).toMatch(/\.bj-view-card-desktop \.bj-arc__slot \.bj-phone-view__mini-hand[\s\S]*--bj-desktop-mini-hand-width/);
    expect(panelCss).not.toMatch(/\.bj-view-card-desktop \.bj-phone-view__hero-stage[\s\S]*min-height:\s*11\.5rem/);
    expect(panelCss).not.toMatch(/\.bj-view-card-desktop \.bj-phone-view__cards-slot[\s\S]*min-height:\s*10\.5rem/);
    expect(panelCss).not.toMatch(/@media \(min-width: 721px\)[\s\S]*\.bj-view-card-desktop[\s\S]*--bj-desktop-table-max-width/);
    expect(readSrc('src/styles/bj-card-layout.css')).not.toMatch(/\.bj-view-card-desktop \.bj-table-desktop-shell[\s\S]*height:/);
  });

  it('bank summary renders inside table shell above dealer', () => {
    for (const mode of ['full', 'card'] as const) {
      const html = renderAt(1280, mode);
      const shellIdx = html.indexOf(TABLE_UX.tableLayoutShell);
      const bankIdx = html.indexOf('bj-table-info-bar--felt-row');
      expect(shellIdx).toBeGreaterThan(-1);
      expect(bankIdx).toBeGreaterThan(shellIdx);
      expect(html).toMatch(/bj-table-info-bar__bank-(summary|chips)/);
      expect(html).toContain('bj-phone-view__box-value--card-column');
      expect(html).not.toContain('bj-casino__header-bank');
      expect(html).not.toContain('dealer-block__brand');
    }
  });

  it('Card View playing actions use shared table action panel contract', () => {
    const card = renderAt(1280, 'card');
    expect(card).toContain('bj-player-actions');
    expect(card).toContain('bj-table-actions');
    expect(card).toMatch(/bj-table-actions[\s\S]*Stay/);
  });

  it('Card View bottom boxes use shared arc player box row', () => {
    const card = renderAt(1280, 'card');
    expect(card).toContain('bj-arc--player-boxes');
    expect(card).toContain('bj-arc__slot');
    expect(card).toContain('bj-phone-view__mini-hand');
  });

  it('player action panels use shared bj-player-actions shell', () => {
    const full = renderAt(1280, 'full');
    const card = renderAt(1280, 'card');
    expect(full).toContain('bj-player-actions');
    expect(card).toContain('bj-player-actions');
    expect(full).toContain('bj-table-actions');
    expect(card).toContain('bj-table-actions');
  });

  it('mobile Full Table and Card View share unified felt tokens and mini-hand sizing', () => {
    const css = readSrc('src/styles/bj-table-shared.css');
    expect(css).toContain('--bj-mobile-mini-hand-width: 2.55rem');
    expect(css).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt/,
    );
    expect(css).toMatch(/\.bj-view-full-mobile \.bj-arc__slot \.bj-phone-view__mini-hand/);
    expect(css).toMatch(/\.bj-view-card-mobile \.bj-phone-view__mini-hand[\s\S]*var\(--bj-mobile-mini-hand-height\)/);
    expect(css).toMatch(/\.bj-phone-view__mini-hand--card-compact[\s\S]*display:\s*none\s*!important/);
  });

  it('mobile Full/Card player boxes share mini-hand class family on render', () => {
    for (const mode of ['full', 'card'] as const) {
      const html = renderAt(390, mode);
      expect(html).toContain('bj-phone-view__mini-hand');
      expect(html).toContain('bj-phone-view__mini-hand-box');
      expect(html).toContain('bj-table-surface');
      expect(html).toContain('bj-table-rail');
    }
  });

  it('Full Table arc seats use vertical card stack + shared box class family', () => {
    const full = renderAt(1280, 'full');
    expect(full).toContain('bj-phone-view__mini-hand');
    expect(full).toContain(TABLE_UX.fullArcBox);
    expect(full).toContain('bj-phone-view__mini-hand-box');
    expect(full).toContain('bj-phone-view__mini-hand-name');
    expect(full).toContain(TABLE_UX.arcCards);
    expect(full).toContain(TABLE_UX.arcCardsStackVertical);
    expect(full).toContain(TABLE_UX.arcCardsStack);
    expect(full).toContain('bj-arc__play-zone');
    expect(full).toContain('bj-phone-view__box-value');
    expect(full).not.toContain(TABLE_UX.cardsFan);
  });

  it('bet zones use rectangular seat shell class during betting', () => {
    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    expect(panelSrc).toContain("'bj-bet-zone'");
    expect(readSrc('src/styles/bj-table-shared.css')).toMatch(/\.bj-bet-zone[\s\S]*--bj-seat-radius/);
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
