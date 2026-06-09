import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { TABLE_UX } from './tableUxContract';
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
  it('desktop: side panel docks right of table shell without felt overlay', () => {
    const html = renderAt(1280, playingState());
    expect(html).toContain(TABLE_UX.sideRailDock);
    expect(html).not.toContain('bj-casino__this-table--float');
    expect(html).not.toContain('bj-casino__this-table--below');
    expect(html).toContain(TABLE_UX.desktopStage);
    expect(html).toContain('bj-casino__rail-wrap');
    expect(html).not.toContain('bj-casino__rail--with-this-table');
    expect(html).not.toMatch(/bj-table-slide-overlay[^>]*>[\s\S]*This Table/);
    expect(html).toContain('bj-accounts-panel');
    expect(html).toContain('bj-side-rail-shell');
    expect(html).toContain('bj-side-rail-shell__title');
    const css = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
    const sharedCss = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
    expect(css).not.toContain('.bj-casino__this-table--float');
    expect(sharedCss).toContain('.bj-casino__this-table--dock');
    expect(sharedCss).toMatch(/\.bj-casino__desktop-stage[\s\S]*display:\s*flex/);
    expect(sharedCss).toMatch(/\.bj-casino__this-table--dock[\s\S]*flex:\s*0\s*0\s*12\.5rem/);
    expect(css).not.toContain('.bj-casino__rail--with-this-table');
    expect(sharedCss).toContain('.bj-casino__this-table');
    expect(sharedCss).toContain('.bj-side-rail-shell');
    const stageIdx = html.indexOf(TABLE_UX.desktopStage);
    const railIdx = html.indexOf('bj-casino__rail-wrap');
    const dockIdx = html.indexOf(TABLE_UX.sideRailDock);
    expect(stageIdx).toBeGreaterThan(-1);
    expect(railIdx).toBeGreaterThan(stageIdx);
    expect(dockIdx).toBeGreaterThan(railIdx);
  });

  it('mobile: This Table opens as overlay sheet (not below-table flow)', () => {
    const html = renderAt(390, playingState());
    expect(html).not.toContain('bj-casino__this-table--below');
    expect(html).not.toContain(TABLE_UX.mobileSidePanelOverlay);
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(panelSrc).toContain('TABLE_UX.mobileSidePanelOverlay');
    expect(panelSrc).toContain("renderSideRailPanel('overlay')");
    expect(panelSrc).toContain('renderMobileSidePanelTabs');
    expect(panelSrc).toContain('<PlayLedgerPanel');
  });

  it('Play Ledger still uses modal overlay markup', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
    expect(css).toContain('.bj-table-slide-overlay');
  });

  it('Table Details lives in Settings menu (not dealer button or side-rail slot)', () => {
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    const settingsSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackFlowSettings.tsx'), 'utf8');
    expect(settingsSrc).toContain('TableDetailsPanelContent');
    expect(panelSrc).toContain('tableDetails={tableDetailsProps}');
    expect(panelSrc).not.toContain('onOpenTableDetails');
    expect(panelSrc).not.toContain('TableDetailsSlidePanel');
    const html = renderAt(1280, playingState());
    expect(html).not.toContain('bj-table-slide-overlay--details');
    expect(html).not.toContain('dealer-block__details-btn');
  });

  it('Settings modal markup remains on desktop; mobile uses overlay tab', () => {
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(panelSrc).toContain("activeTablePanel === 'settings'");
    expect(panelSrc).toContain("activeTablePanel === 'playLedger'");
    expect(panelSrc).toContain("deviceView !== 'mobile'");
    expect(panelSrc).toContain("setMobileSidePanelTab('settings')");
  });
});
