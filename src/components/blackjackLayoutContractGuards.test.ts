import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey } from '../engine/blackjack';
import { tableAfterStartPlaying, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import {
  BLACKJACK_LAYOUT_CONTRACT_DOC,
  CARD_VIEW_CARDS_AREA_CLASS,
  CARD_VIEW_DESKTOP_FROZEN,
  CARD_VIEW_DESKTOP_ROOT,
  CARD_VIEW_FROZEN,
  CARD_VIEW_LAYOUT_GUARD_FILES,
  CARD_VIEW_MOBILE_DUAL_ACTION_PATH_DOCUMENTED,
  CARD_VIEW_MOBILE_LANDSCAPE_FROZEN,
  CARD_VIEW_MOBILE_PORTRAIT_FROZEN,
  CARD_VIEW_MOBILE_ROOT,
  CARD_VIEW_MOBILE_SIDE_ACTION_CLASS,
  FULL_TABLE_CARD_AREA_CLASS,
  FULL_TABLE_CARDS_AREA_CLASS,
  FULL_TABLE_MOBILE_LANDSCAPE_FROZEN,
  FULL_TABLE_MOBILE_LANDSCAPE_MEDIA,
  FULL_TABLE_MOBILE_LANDSCAPE_MEDIA_BLOCKS,
  FULL_TABLE_MOBILE_LANDSCAPE_TOKEN_SOURCES,
  FULL_TABLE_MOBILE_PORTRAIT_FROZEN,
  FULL_TABLE_MOBILE_PORTRAIT_MEDIA,
  LAYOUT_FREEZE_RECOMMENDED_ORDER,
} from './blackjackLayoutContract';
import {
  MOBILE_LAYOUT_MEDIA,
  MOBILE_LAYOUT_MEDIA_LANDSCAPE,
  MOBILE_MAX_WIDTH,
} from '../styles/mobileLayoutContract';
import { TABLE_UX } from './tableUxContract';

const noop = () => {};
const CONTRACT_DOC = readFileSync(join(process.cwd(), BLACKJACK_LAYOUT_CONTRACT_DOC), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

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

function playingCardViewState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  return {
    ...state,
    tableViewMode: 'card',
    selectedSeatId: box1,
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
    },
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

describe('layout contract audit guards — freeze flags', () => {
  it('documents recommended freeze order in contract doc and constants', () => {
    expect(LAYOUT_FREEZE_RECOMMENDED_ORDER).toEqual([
      'FULL_TABLE_MOBILE_LANDSCAPE',
      'CARD_VIEW_DESKTOP',
      'CARD_VIEW_MOBILE_PORTRAIT',
      'CARD_VIEW_MOBILE_LANDSCAPE',
    ]);
    expect(CONTRACT_DOC).toContain('Recommended freeze order');
    expect(CONTRACT_DOC).toMatch(/1\.\s+\*\*Mobile Landscape Full Table\*\*/);
  });

  it('separates portrait frozen from landscape pending flags', () => {
    expect(FULL_TABLE_MOBILE_PORTRAIT_FROZEN).toBe(true);
    expect(FULL_TABLE_MOBILE_LANDSCAPE_FROZEN).toBe(false);
    expect(CARD_VIEW_DESKTOP_FROZEN).toBe(false);
    expect(CARD_VIEW_MOBILE_PORTRAIT_FROZEN).toBe(false);
    expect(CARD_VIEW_MOBILE_LANDSCAPE_FROZEN).toBe(false);
    expect(CARD_VIEW_FROZEN).toBe(false);
  });
});

describe('layout contract audit guards — Full Table Mobile Landscape (B2 pending)', () => {
  it('documents B2 as pending freeze with landscape risks in contract doc', () => {
    expect(CONTRACT_DOC).toContain('B2. Full Table Mobile Landscape');
    expect(CONTRACT_DOC).toContain('PENDING FREEZE');
    expect(CONTRACT_DOC).toContain('Duplicate landscape');
    expect(CONTRACT_DOC).toContain('overflow: hidden');
  });

  it('distinguishes portrait and landscape media constants', () => {
    expect(FULL_TABLE_MOBILE_PORTRAIT_MEDIA).toContain('orientation: portrait');
    expect(FULL_TABLE_MOBILE_LANDSCAPE_MEDIA).toContain('orientation: landscape');
    expect(FULL_TABLE_MOBILE_PORTRAIT_MEDIA).not.toEqual(FULL_TABLE_MOBILE_LANDSCAPE_MEDIA);
    expect(FULL_TABLE_MOBILE_LANDSCAPE_MEDIA).toBe(MOBILE_LAYOUT_MEDIA_LANDSCAPE);
  });

  it('documents known duplicate landscape media blocks until consolidation', () => {
    for (const block of FULL_TABLE_MOBILE_LANDSCAPE_MEDIA_BLOCKS) {
      expect(SHARED_CSS).toContain(block);
    }
    for (const source of FULL_TABLE_MOBILE_LANDSCAPE_TOKEN_SOURCES) {
      expect(readFileSync(join(process.cwd(), source), 'utf8')).toMatch(
        /--bj-mobile-landscape-compact:\s*1/,
      );
    }
  });

  it('aligns portrait media constant with player-row Contract C block', () => {
    expect(PLAYER_ROW_CSS).toContain('orientation: portrait');
    expect(FULL_TABLE_MOBILE_PORTRAIT_MEDIA.split(',')[0]!.trim()).toBe(
      '(max-width: 720px) and (orientation: portrait)',
    );
  });
});

describe('layout contract audit guards — Card View Desktop (C1 pending)', () => {
  it('keeps Card View desktop freeze flag false', () => {
    expect(CARD_VIEW_DESKTOP_FROZEN).toBe(false);
    expect(CONTRACT_DOC).toContain('C1. Desktop Card View');
  });

  it('uses hero cards area mode, not Full Table arc class', () => {
    expect(CARD_VIEW_CARDS_AREA_CLASS).toBe(TABLE_UX.cardsAreaHero);
    expect(CARD_VIEW_CARDS_AREA_CLASS).toBe('bj-cards-area--hero');
    expect(FULL_TABLE_CARDS_AREA_CLASS).toBe('bj-cards-area--table');

    simulatedWidth = 1280;
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, {
        gameState: { ...playingCardViewState(), tableViewMode: 'card' },
        onGameStateChange: noop,
      }),
    );
    expect(html).toContain(CARD_VIEW_DESKTOP_ROOT);
    expect(html).toContain(CARD_VIEW_CARDS_AREA_CLASS);
    expect(html).not.toContain(`bj-arc--cards ${FULL_TABLE_CARD_AREA_CLASS}`);
  });

  it('does not apply bj-full-table-card-area selectors in Card View guard sources', () => {
    for (const path of CARD_VIEW_LAYOUT_GUARD_FILES) {
      const src = readFileSync(join(process.cwd(), path), 'utf8');
      expect(src, path).not.toMatch(/\.bj-full-table-card-area\b/);
    }
    expect(PANEL_SRC).toMatch(
      /viewMode === 'full'[\s\S]*FULL_TABLE_CARD_AREA_CLASS[\s\S]*BlackjackCardView/,
    );
  });
});

describe('layout contract audit guards — Mobile Card View (C2 pending)', () => {
  it('documents dual action path as a known risk without changing behavior', () => {
    expect(CARD_VIEW_MOBILE_DUAL_ACTION_PATH_DOCUMENTED).toBe(true);
    expect(CONTRACT_DOC).toContain('Dual action path');
    expect(CONTRACT_DOC).toContain('side/swipe');
  });

  it('renders hero side-action path on mobile Card View', () => {
    simulatedWidth = 390;
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, {
        gameState: playingCardViewState(),
        onGameStateChange: noop,
      }),
    );
    expect(html).toContain(CARD_VIEW_MOBILE_ROOT);
    const heroZone =
      html.split(CARD_VIEW_CARDS_AREA_CLASS)[1]?.split(TABLE_UX.tableZoneActions)[0] ?? '';
    expect(heroZone).toContain(CARD_VIEW_MOBILE_SIDE_ACTION_CLASS);
    expect(heroZone).toContain('bj-phone-view__side-action--hit');
  });

  it('currently also renders shell BlackjackActionPanel during player turn (dual path)', () => {
    simulatedWidth = 390;
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, {
        gameState: playingCardViewState(),
        onGameStateChange: noop,
      }),
    );
    const actionsZone =
      html.split(TABLE_UX.tableZoneActions)[1]?.split(TABLE_UX.tableZoneBoxes)[0] ?? '';
    expect(actionsZone).toContain('ds-btn--hit');
    expect(actionsZone).toContain('ds-btn--stand');
    expect(CARD_VIEW_MOBILE_PORTRAIT_FROZEN).toBe(false);
  });
});

describe('layout contract audit guards — media query parity', () => {
  it('aligns MOBILE_MAX_WIDTH with contract doc and CSS max-width breakpoints', () => {
    expect(MOBILE_MAX_WIDTH).toBe(720);
    expect(CONTRACT_DOC).toContain('720');
    expect(SHARED_CSS).toMatch(/max-width:\s*720px/);
    expect(MOBILE_LAYOUT_MEDIA).toContain(`max-width: ${MOBILE_MAX_WIDTH}px`);
  });

  it('documents MOBILE_LAYOUT_MEDIA in contract doc related section', () => {
    expect(CONTRACT_DOC).toContain('MOBILE_LAYOUT_MEDIA');
    expect(CONTRACT_DOC).toContain('MOBILE_MAX_WIDTH');
  });
});
