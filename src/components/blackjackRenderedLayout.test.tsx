// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey } from '../engine/blackjack';
import {
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
} from '../engine/blackjack/sanity/fixtures';
import {
  assertNoPairwiseOverlap,
  assertVerticalStack,
  measureElement,
} from './layoutMeasure';
import {
  FULL_TABLE_CARD_VALUE_CLASS,
  FULL_TABLE_DESKTOP_VIEW_ROOT,
  FULL_TABLE_MOBILE_VIEW_ROOT,
} from './blackjackLayoutContract';
import { getViewRootClass } from './tableViewContract';
import { isMobileLayoutViewport, MOBILE_LAYOUT_MEDIA } from '../styles/mobileLayoutContract';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const noop = () => {};

let simulatedWidth = 1280;
let simulatedHeight = 800;

function matchMediaQuery(query: string): boolean {
  if (query === MOBILE_LAYOUT_MEDIA) {
    return isMobileLayoutViewport(simulatedWidth, simulatedHeight, { coarsePointer: true });
  }
  const maxWidth = /max-width:\s*(\d+)/.exec(query);
  if (maxWidth) {
    return simulatedWidth <= Number(maxWidth[1]);
  }
  return false;
}

vi.mock('../storage/profileStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage/profileStorage')>();
  return {
    ...actual,
    loadProfile: () => ({ name: 'Alice', email: 'alice@example.com' }),
  };
});

beforeAll(() => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({
      matches: matchMediaQuery(query),
      media: query,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => false,
    }),
  );
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function playingState(viewMode: 'full' | 'card' = 'full'): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  return {
    ...state,
    tableViewMode: viewMode,
    selectedSeatId: box1,
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
      adviceEnabled: false,
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

type ViewScenario = {
  name: string;
  width: number;
  height: number;
  viewMode: 'full' | 'card';
  viewRoot: string;
};

const VIEW_SCENARIOS: ViewScenario[] = [
  { name: 'Desktop Full Table', width: 1280, height: 800, viewMode: 'full', viewRoot: FULL_TABLE_DESKTOP_VIEW_ROOT },
  { name: 'Desktop Card View', width: 1280, height: 800, viewMode: 'card', viewRoot: 'bj-view-card-desktop' },
  { name: 'Mobile Portrait Full Table', width: 390, height: 844, viewMode: 'full', viewRoot: FULL_TABLE_MOBILE_VIEW_ROOT },
  { name: 'Mobile Portrait Card View', width: 390, height: 844, viewMode: 'card', viewRoot: 'bj-view-card-mobile' },
  { name: 'Mobile Landscape Full Table', width: 844, height: 390, viewMode: 'full', viewRoot: FULL_TABLE_MOBILE_VIEW_ROOT },
];

function renderPanelAt(scenario: ViewScenario, state: GameState = playingState(scenario.viewMode)) {
  simulatedWidth = scenario.width;
  simulatedHeight = scenario.height;
  return render(
    createElement(BlackjackPanel, { gameState: state, onGameStateChange: noop }),
  );
}

function requireBand(root: ParentNode, band: string): Element {
  const el = root.querySelector(`[data-layout-band="${band}"]`);
  if (!el) {
    throw new Error(`Missing layout band: ${band}`);
  }
  return el;
}

function assertBandStack(root: ParentNode, bands: string[], label: string): void {
  const rects = bands.map((band) => measureElement(requireBand(root, band)));
  assertVerticalStack(rects, { label, tolerancePx: 0 });
  assertNoPairwiseOverlap(rects, { label, tolerancePx: 0 });
}

describe('blackjack rendered layout bands', () => {
  it('Panel uses shared row components only (no duplicate action/box/tray paths)', () => {
    expect(PANEL_SRC).toContain('BlackjackActionRow');
    expect(PANEL_SRC).toContain('BlackjackPlayerBoxRow');
    expect(PANEL_SRC).toContain('BlackjackTrayRow');
    expect(PANEL_SRC).not.toContain('BlackjackActionPanel');
    expect(PANEL_SRC).not.toContain('<ValueAndChipsBar');
    expect(CARD_VIEW_SRC).not.toContain('BlackjackActionPanel');
    expect(CARD_VIEW_SRC).not.toContain('BlackjackActionRow');
    expect(CARD_VIEW_SRC).toContain("segment?: 'cards' | 'value' | 'all'");
  });

  it('Card View shell exposes hero value as its own zone between cards and actions', () => {
    expect(PANEL_SRC).toContain('segment="cards"');
    expect(PANEL_SRC).toContain('segment="value"');
    expect(PANEL_SRC).toContain('heroValue=');
  });
});

describe.each(VIEW_SCENARIOS)('rendered position — $name', (scenario) => {
  it('mounts expected view root during player turn', () => {
    const { container } = renderPanelAt(scenario);
    expect(container.querySelector(`.${scenario.viewRoot}`)).toBeTruthy();
    expect(getViewRootClass(
      isMobileLayoutViewport(scenario.width, scenario.height, { coarsePointer: true }) ? 'mobile' : 'desktop',
      scenario.viewMode,
    )).toBe(
      scenario.viewRoot,
    );
  });

  it('keeps action row below cards and player boxes below actions without overlap', () => {
    const { container } = renderPanelAt(scenario);
    const cardsZone = container.querySelector('.bj-table-zone--cards');
    const actionsZone = container.querySelector('.bj-table-zone--actions');
    const boxesZone = container.querySelector('.bj-table-zone--boxes');
    expect(cardsZone).toBeTruthy();
    expect(actionsZone).toBeTruthy();
    expect(boxesZone).toBeTruthy();

    const cardsRect = measureElement(cardsZone!);
    const actionsRect = measureElement(actionsZone!);
    const boxesRect = measureElement(boxesZone!);
    assertVerticalStack([cardsRect, actionsRect, boxesRect], {
      label: `${scenario.name} shell zones`,
      tolerancePx: 0,
    });
    assertNoPairwiseOverlap([cardsRect, actionsRect, boxesRect], {
      label: `${scenario.name} shell zones`,
    });

    const actionRow = requireBand(container, 'action-row');
    const playerBoxes = requireBand(container, 'player-boxes');
    const trayRow = requireBand(container, 'tray-row');
    assertVerticalStack(
      [measureElement(actionsZone!), measureElement(actionRow), measureElement(playerBoxes), measureElement(trayRow)],
      { label: `${scenario.name} action/box/tray`, tolerancePx: 0 },
    );
  });

  it('keeps tray label in tray row band', () => {
    const { container } = renderPanelAt(scenario);
    const trayRow = requireBand(container, 'tray-row');
    expect(trayRow.textContent).toMatch(/SxM Casino Challenge|Available/i);
  });
});

describe('rendered position — card view hero stack', () => {
  it.each([
    { name: 'Desktop Card View', width: 1280, height: 800 },
    { name: 'Mobile Portrait Card View', width: 390, height: 844 },
  ])('$name stacks hero cards, value, and actions without overlap', ({ width, height }) => {
    simulatedWidth = width;
    simulatedHeight = height;
    const { container } = renderPanelAt({
      name: 'card',
      width,
      height,
      viewMode: 'card',
      viewRoot: isMobileLayoutViewport(width, height, { coarsePointer: true })
        ? 'bj-view-card-mobile'
        : 'bj-view-card-desktop',
    });
    assertBandStack(container, ['hero-cards', 'hero-value', 'action-row'], `card-view-${width}`);
  });
});

describe('rendered position — full table card column', () => {
  it('keeps playing cards above column value in the active box', () => {
    const { container } = renderPanelAt(VIEW_SCENARIOS[0]!);
    const column = container.querySelector('.bj-arc__slot--card-column .playing-card')?.closest(
      '.bj-arc__slot--card-column',
    );
    expect(column).toBeTruthy();
    const cardsBand = column!.querySelector('[data-layout-band="card-column-cards"]');
    const valueBand = column!.querySelector('[data-layout-band="card-column-value"]');
    expect(cardsBand).toBeTruthy();
    expect(valueBand).toBeTruthy();
    assertVerticalStack([measureElement(cardsBand!), measureElement(valueBand!)], {
      label: 'full-table card column',
    });
    expect(valueBand!.className).toContain(FULL_TABLE_CARD_VALUE_CLASS);
  });

  it('player boxes in a row share width parity within tolerance', () => {
    const { container } = renderPanelAt(VIEW_SCENARIOS[0]!);
    const boxes = Array.from(
      container.querySelectorAll('.bj-player-box-row .bj-arc__slot--owned, .bj-player-box-row .bj-arc__slot--empty'),
    );
    expect(boxes.length).toBeGreaterThan(0);
    const widths = boxes.map((box) => measureElement(box).width);
    const max = Math.max(...widths);
    const min = Math.min(...widths);
    expect(max - min).toBeLessThanOrEqual(4);
  });
});
