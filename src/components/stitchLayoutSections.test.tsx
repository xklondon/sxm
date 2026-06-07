import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState, TableViewMode } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { PlayLedgerModal } from './LedgerModals';
import { BlackjackFlowSettingsMenu } from './BlackjackFlowSettings';
import {
  SXM_CARD_VIEW_SECTIONS,
  SXM_FULL_TABLE_SECTIONS,
  SXM_LAYOUT,
  type SxmLayoutSection,
} from './sxmLayoutContract';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { addChipToBoxStake, blackjackHandKey } from '../engine/blackjack';

const noop = () => {};

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

function renderPanelAt(width: number, state: GameState): string {
  simulatedWidth = width;
  return renderToStaticMarkup(<BlackjackPanel gameState={state} onGameStateChange={noop} />);
}

function withView(state: GameState, mode: TableViewMode): GameState {
  return { ...state, tableViewMode: mode };
}

function expectSections(html: string, sections: readonly SxmLayoutSection[]) {
  for (const section of sections) {
    expect(html, `missing section ${section}`).toContain(`data-sxm-section="${section}"`);
    expect(html, `missing class ${section}`).toMatch(
      new RegExp(`class="[^"]*\\b${section}\\b`),
    );
  }
}

function countSections(html: string, section: SxmLayoutSection): number {
  return (html.match(new RegExp(`data-sxm-section="${section}"`, 'g')) ?? []).length;
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
  const box1 = boxPlayerId(state, 1)!;
  const box2 = boxPlayerId(state, 2)!;
  const k1 = blackjackHandKey(box1, 0);
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
        [k1]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '10'), findCardId(deck, '6')],
          actionStatus: 'busted',
        },
        [k2]: {
          ...createBlackjackPlayerHand(box2, 0),
          cardIds: [findCardId(deck, '9'), findCardId(deck, '8')],
          actionStatus: 'acting',
        },
      },
    },
  };
}

function settlementState(): GameState {
  const state = playingState();
  return {
    ...state,
    blackjack: {
      ...state.blackjack!,
      status: 'resolved',
      activeHandKey: null,
      activePlayerId: null,
      dealerHoleHidden: false,
    },
  };
}

describe('Stitch layout sections', () => {
  it('renders core sections in desktop full table view', () => {
    const html = renderPanelAt(1280, withView(bettingState(), 'full'));
    expectSections(html, SXM_FULL_TABLE_SECTIONS);
  });

  it('renders core sections in desktop card view', () => {
    const html = renderPanelAt(1280, withView(bettingState(), 'card'));
    expectSections(html, SXM_CARD_VIEW_SECTIONS);
  });

  it('renders core sections in mobile full table view', () => {
    const html = renderPanelAt(390, withView(bettingState(), 'full'));
    const mobileOnlyInOverlay = new Set<SxmLayoutSection>([
      SXM_LAYOUT.rightSidePanel,
      SXM_LAYOUT.tableInfoPanel,
      SXM_LAYOUT.playersPanel,
    ]);
    const mobileSections = SXM_FULL_TABLE_SECTIONS.filter((s) => !mobileOnlyInOverlay.has(s));
    expectSections(html, mobileSections);
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(panelSrc).toContain('SXM_LAYOUT.rightSidePanel');
    expect(panelSrc).toContain('TABLE_UX.mobileSidePanelOverlay');
  });

  it('renders core sections in mobile card view', () => {
    const html = renderPanelAt(390, withView(bettingState(), 'card'));
    expectSections(html, SXM_CARD_VIEW_SECTIONS);
  });

  it('keeps named sections mounted across betting, play, and settlement in card view', () => {
    const betting = renderPanelAt(1280, withView(bettingState(), 'card'));
    const playing = renderPanelAt(1280, playingState());
    const settlement = renderPanelAt(1280, settlementState());

    for (const html of [betting, playing, settlement]) {
      expectSections(html, [
        SXM_LAYOUT.heroZone,
        SXM_LAYOUT.actionZone,
        SXM_LAYOUT.playerBoxesZone,
        SXM_LAYOUT.chipTray,
        SXM_LAYOUT.handTotal,
      ]);
    }
  });

  it('keeps card view hero, actions, and boxes in distinct sections', () => {
    const html = renderPanelAt(1280, playingState());
    expect(countSections(html, SXM_LAYOUT.heroZone)).toBe(1);
    expect(countSections(html, SXM_LAYOUT.actionZone)).toBe(1);
    expect(countSections(html, SXM_LAYOUT.playerBoxesZone)).toBe(1);

    const heroIdx = html.indexOf(`data-sxm-section="${SXM_LAYOUT.heroZone}"`);
    const actionIdx = html.indexOf(`data-sxm-section="${SXM_LAYOUT.actionZone}"`);
    const boxesIdx = html.indexOf(`data-sxm-section="${SXM_LAYOUT.playerBoxesZone}"`);
    expect(heroIdx).toBeGreaterThan(-1);
    expect(actionIdx).toBeGreaterThan(-1);
    expect(actionIdx).toBeLessThan(heroIdx);
    expect(boxesIdx).toBeGreaterThan(heroIdx);
  });

  it('renders player box sub-sections in card view', () => {
    const html = renderPanelAt(1280, withView(bettingState(), 'card'));
    expect(html).toContain(SXM_LAYOUT.playerBoxValue);
    expect(html).toContain(SXM_LAYOUT.playerBoxCards);
    expect(html).toContain(SXM_LAYOUT.playerBoxBet);
  });

  it('exposes ledger and settings panels with stable section names', () => {
    const ledgerHtml = renderToStaticMarkup(
      <PlayLedgerModal open gameState={bettingState()} onClose={noop} />,
    );
    const settingsHtml = renderToStaticMarkup(
      <BlackjackFlowSettingsMenu
        open
        gameState={bettingState()}
        onGameStateChange={noop}
        onClose={noop}
      />,
    );
    expect(ledgerHtml).toContain(`data-sxm-section="${SXM_LAYOUT.ledgerPanel}"`);
    expect(settingsHtml).toContain(`data-sxm-section="${SXM_LAYOUT.settingsPanel}"`);
  });

  it('has one canonical BlackjackPanel production path', () => {
    const appSrc = readFileSync(join(process.cwd(), 'src/screens/TableScreen.tsx'), 'utf8');
    expect(appSrc).toContain('BlackjackPanel');

    const duplicateRouteHits = [
      'desktop_full_table',
      'desktop_card_view',
      'mobile_full_table',
      'mobile_card_view',
      '/demo/blackjack',
      '/preview/blackjack',
    ].filter((needle) => {
      try {
        return readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8').includes(needle);
      } catch {
        return false;
      }
    });
    expect(duplicateRouteHits).toEqual([]);
  });
});
