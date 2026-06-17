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
import { blackjackHandKey, addChipToBoxStake } from '../engine/blackjack';
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
  DESKTOP_LAYOUT_TOKENS,
  CARD_VIEW_DESKTOP_LAYOUT_TOKENS,
  PLAYER_BOX_IN_PLAY_HAND_VALUE_CLASS,
} from './blackjackLayoutContract';
import { DEFAULT_VISIBLE_TABLE_BOXES } from './tableBoxLayout';
import { getViewRootClass } from './tableViewContract';
import { isMobileLayoutViewport, MOBILE_LAYOUT_MEDIA } from '../styles/mobileLayoutContract';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const CARD_DESKTOP_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-desktop-layout.css'), 'utf8');
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
  ])('$name stacks shell zones cards → hero-value → actions → boxes → tray', ({ width, height }) => {
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
    const cardsZone = container.querySelector('.bj-table-zone--cards');
    const heroValueZone = container.querySelector('.bj-table-zone--hero-value');
    const actionsZone = container.querySelector('.bj-table-zone--actions');
    const boxesZone = container.querySelector('.bj-table-zone--boxes');
    const trayZone = container.querySelector('.bj-table-zone--bottom');
    expect(heroValueZone).toBeTruthy();
    expect(cardsZone!.querySelector('.bj-table-zone--hero-value')).toBeNull();
    assertVerticalStack(
      [
        measureElement(cardsZone!),
        measureElement(heroValueZone!),
        measureElement(actionsZone!),
        measureElement(boxesZone!),
        measureElement(trayZone!),
      ],
      { label: `card-view-shell-${width}`, tolerancePx: 0 },
    );
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

  it('Desktop Full Table player row does not fall back to max-content centering', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*width:\s*100%/,
    );
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*width:\s*max-content/,
    );
  });

  it('Full Table desktop cards row uses auto height so actions sit near boxes', () => {
    const FULL_TABLE_CSS = readFileSync(
      join(process.cwd(), 'src/styles/bj-full-table-card-area.css'),
      'utf8',
    );
    expect(FULL_TABLE_CSS).toMatch(
      /\.bj-view-full-desktop[\s\S]*--bj-desktop-grid-row-cards:\s*auto/,
    );
  });

  it('Card View desktop shows table cloth layer in cards zone', () => {
    expect(CARD_DESKTOP_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*flex/,
    );
  });
});

describe('rendered position — desktop canonical tokens', () => {
  it('defines desktop layout tokens under desktop view roots only', () => {
    for (const token of DESKTOP_LAYOUT_TOKENS) {
      expect(SHARED_CSS).toContain(token);
    }
    expect(SHARED_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-view-full-desktop[\s\S]*--bj-desktop-player-row-spread/,
    );
    expect(SHARED_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-view-card-desktop[\s\S]*--bj-desktop-box-value-scale:\s*2/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-mobile[^,{]*\{[^}]*--bj-desktop-box-value-scale\s*:/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-card-mobile[^,{]*\{[^}]*--bj-desktop-box-value-scale\s*:/,
    );
  });

  it('scopes Card View desktop 7-band grid under bj-view-card-desktop', () => {
    expect(CARD_DESKTOP_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell[\s\S]*\[dealer\]/,
    );
    expect(CARD_DESKTOP_CSS).toMatch(/\[hero-value\]/);
    expect(CARD_DESKTOP_CSS).toMatch(/\[tray\]/);
    expect(CARD_DESKTOP_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*grid-row:\s*cards/,
    );
    expect(CARD_DESKTOP_CSS).not.toMatch(/--bj-card-desktop-hero-lower-offset/);
    expect(CARD_LAYOUT_CSS).not.toMatch(
      /\.bj-view-full-desktop[\s\S]*--bj-card-desktop-box-spread/,
    );
  });

  it('scopes Full Table desktop player-row spread under bj-view-full-desktop', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*--bj-desktop-player-row-spread/,
    );
    expect(CARD_DESKTOP_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*width:\s*100%/,
    );
  });

  it('Desktop Full Table in-box hand value uses 2x scale token', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop[\s\S]*\.bj-phone-view__mini-hand-value[\s\S]*--bj-desktop-box-value-scale/,
    );
  });

  it('Mobile portrait player box value keeps base size (no desktop 2x token)', () => {
    simulatedWidth = 390;
    simulatedHeight = 844;
    const { container } = renderPanelAt(VIEW_SCENARIOS[2]!);
    const value = container.querySelector(
      `.${PLAYER_BOX_IN_PLAY_HAND_VALUE_CLASS}:not(.${PLAYER_BOX_IN_PLAY_HAND_VALUE_CLASS}--placeholder)`,
    );
    if (value) {
      const fontSize = getComputedStyle(value).fontSize;
      expect(parseFloat(fontSize)).toBeLessThan(20);
    }
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-mobile[^,{]*\{[^}]*--bj-desktop-box-value-scale\s*:/,
    );
  });
});

describe('rendered position — desktop card view reference layout', () => {
  function bettingCardDesktopState(): GameState {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const box1 = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, box1, 20);
    return {
      ...state,
      tableViewMode: 'card',
      blackjack: null,
      tableMeta: { ...state.tableMeta, bettingLocked: false },
    };
  }

  it('uses four initial visible boxes plus add control during betting', () => {
    simulatedWidth = 1280;
    simulatedHeight = 800;
    const { container } = render(
      createElement(BlackjackPanel, { gameState: bettingCardDesktopState(), onGameStateChange: noop }),
    );
    expect(container.querySelector('.bj-view-card-desktop')).toBeTruthy();
    const row = container.querySelector('.bj-view-card-desktop .bj-table-slot-row.bj-arc--player-boxes');
    expect(row).toBeTruthy();
    expect(row!.className).toContain(`bj-arc--visible-${DEFAULT_VISIBLE_TABLE_BOXES}`);
    expect(row!.querySelector('.bj-table-slot-row__add')).toBeTruthy();
    expect(row!.querySelectorAll('.bj-arc__slot').length).toBe(DEFAULT_VISIBLE_TABLE_BOXES);
  });

  it('defines Card View desktop 7-band grid with isolated shell rows', () => {
    for (const token of CARD_VIEW_DESKTOP_LAYOUT_TOKENS) {
      expect(CARD_DESKTOP_CSS).toContain(token);
    }
    expect(CARD_DESKTOP_CSS).toMatch(/grid-template-rows:[\s\S]*\[dealer\][\s\S]*\[tray\]/);
    expect(CARD_DESKTOP_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--hero-value[\s\S]*grid-row:\s*hero-value/,
    );
    expect(CARD_DESKTOP_CSS).not.toMatch(
      /--bj-card-desktop-hero-lower-offset|--bj-card-desktop-action-offset/,
    );
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-view-card-desktop \.bj-table-slot-row\.bj-arc--player-boxes\s*\{[^}]*width:\s*max-content/,
    );
    expect(CARD_DESKTOP_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*align-items:\s*stretch/,
    );
  });

  it('does not alter Full Table desktop player row spread rules', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*width:\s*100%/,
    );
    expect(CARD_DESKTOP_CSS).not.toMatch(/\.bj-view-full-desktop/);
  });

  it('keeps mobile Card View hero overflow rules unchanged', () => {
    expect(CARD_LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile[\s\S]*\.bj-phone-view__cards[\s\S]*overflow:\s*hidden/,
    );
    expect(CARD_DESKTOP_CSS).not.toMatch(/\.bj-view-card-mobile/);
  });
});

describe('rendered position — desktop card view hero fit', () => {
  it('Desktop Card View keeps hero cards inside cards zone without clipping value/actions', () => {
    const { container } = renderPanelAt(VIEW_SCENARIOS[1]!);
    const cardsZone = container.querySelector('.bj-table-zone--cards.bj-cards-area--hero');
    const heroCards = requireBand(container, 'hero-cards');
    const heroValue = requireBand(container, 'hero-value');
    const actionRow = requireBand(container, 'action-row');
    const cardsRect = measureElement(cardsZone!);
    const heroCardsRect = measureElement(heroCards);
    expect(heroCardsRect.bottom).toBeLessThanOrEqual(cardsRect.bottom + 1);
    assertVerticalStack(
      [heroCardsRect, measureElement(heroValue), measureElement(actionRow)],
      { label: 'Desktop Card View hero stack', tolerancePx: 0 },
    );
    assertNoPairwiseOverlap(
      [heroCardsRect, measureElement(heroValue), measureElement(actionRow)],
      { label: 'Desktop Card View hero stack' },
    );
  });
});
