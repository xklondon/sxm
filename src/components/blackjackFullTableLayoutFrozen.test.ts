import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey, addChipToBoxStake, confirmBoxStake } from '../engine/blackjack';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
} from '../engine/blackjack/sanity/fixtures';
import {
  BLACKJACK_LAYOUT_CONTRACT_DOC,
  CARD_VIEW_DESKTOP_FROZEN,
  CARD_VIEW_FROZEN,
  CARD_VIEW_LAYOUT_GUARD_FILES,
  CARD_VIEW_MOBILE_LANDSCAPE_FROZEN,
  CARD_VIEW_MOBILE_PORTRAIT_FROZEN,
  FULL_TABLE_ACTIONS_RENDER_FN,
  FULL_TABLE_ACTION_ROW_PRIMARY_BUTTONS,
  FULL_TABLE_CARD_AREA_CLASS,
  FULL_TABLE_CARD_VALUE_CLASS,
  FULL_TABLE_DESKTOP_AID_VISIBLE,
  FULL_TABLE_DESKTOP_FROZEN,
  FULL_TABLE_DESKTOP_POLISH_TOKENS,
  FULL_TABLE_DESKTOP_REFERENCE_IMAGE,
  FULL_TABLE_DESKTOP_VIEW_ROOT,
  FULL_TABLE_FORBIDDEN_CARD_AREA_ACTION_MARKERS,
  FULL_TABLE_FORBIDDEN_LAYOUT_PATTERNS,
  FULL_TABLE_LAYOUT_GUARDED_CSS_FILES,
  FULL_TABLE_LAYOUT_OWNER_FILES,
  FULL_TABLE_MOBILE_FROZEN,
  FULL_TABLE_MOBILE_LANDSCAPE_FROZEN,
  FULL_TABLE_MOBILE_PORTRAIT_FROZEN,
  FULL_TABLE_MOBILE_VIEW_ROOT,
  FULL_TABLE_OPTIONAL_PLAY_BUTTON_CLASS,
  FULL_TABLE_OPTIONAL_PLAY_OVERLAY_ANCHOR_CLASS,
  FULL_TABLE_OPTIONAL_PLAY_OVERLAY_BUTTONS,
  FULL_TABLE_PLAY_ZONE_CSS,
  FULL_TABLE_PRIMARY_HIT_CLASS,
  FULL_TABLE_SHELL_ZONE_CLASSES,
  FULL_TABLE_SHELL_ZONE_ORDER,
} from './blackjackLayoutContract';

const noop = () => {};
const PLAY_ZONE_CSS = readFileSync(join(process.cwd(), FULL_TABLE_PLAY_ZONE_CSS), 'utf8');
const INSURANCE_OVERLAY_CSS = readFileSync(
  join(process.cwd(), 'src/components/InsuranceDecisionOverlay.css'),
  'utf8',
);
const INDEX_CSS = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CONTRACT_DOC = readFileSync(join(process.cwd(), BLACKJACK_LAYOUT_CONTRACT_DOC), 'utf8');

const GUARDED_CSS = Object.fromEntries(
  FULL_TABLE_LAYOUT_GUARDED_CSS_FILES.map((path) => [path, readFileSync(join(process.cwd(), path), 'utf8')]),
);
const CARD_VIEW_GUARD_SRC = Object.fromEntries(
  CARD_VIEW_LAYOUT_GUARD_FILES.map((path) => [path, readFileSync(join(process.cwd(), path), 'utf8')]),
);

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
    tableViewMode: 'full',
    selectedSeatId: box1,
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
      adviceEnabled: true,
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

function splittableDesktopState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const box1 = boxPlayerId(state, 1)!;
  const ownerId = state.tableMeta.ownerPersonId!;
  state = addChipToBoxStake(state, box1, 20, ownerId);
  state = confirmBoxStake(state, box1);
  const deck = state.deck!;
  const handKey = blackjackHandKey(box1, 0);
  return {
    ...state,
    tableViewMode: 'full',
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
      adviceEnabled: true,
    },
    blackjackSettings: {
      ...state.blackjackSettings,
      allowDoubleDown: true,
      allowSplit: true,
    },
    tableMeta: { ...state.tableMeta, bettingLocked: true },
    blackjack: {
      ...actingRound(state, box1, [findCardId(deck, '8'), findCardId(deck, '8')], 25),
      status: 'player-turns',
      activeHandKey: handKey,
      activePlayerId: box1,
      dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
      dealerHoleHidden: true,
      playerHands: {
        [handKey]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '8'), findCardId(deck, '8')],
          currentBet: 25,
          actionStatus: 'acting',
        },
      },
    },
  };
}

function renderFullTableAt(width: number, state: GameState = playingState()): string {
  simulatedWidth = width;
  return renderToStaticMarkup(
    createElement(BlackjackPanel, { gameState: state, onGameStateChange: noop }),
  );
}

function zoneSlice(html: string, zoneClass: string, endClass?: string): string {
  const start = html.indexOf(zoneClass);
  if (start < 0) {
    return '';
  }
  if (!endClass) {
    return html.slice(start);
  }
  const end = html.indexOf(endClass, start + zoneClass.length);
  return end > start ? html.slice(start, end) : html.slice(start);
}

describe('Blackjack Full Table layout freeze — contract constants', () => {
  it('documents frozen flags and reference image', () => {
    expect(FULL_TABLE_DESKTOP_FROZEN).toBe(true);
    expect(FULL_TABLE_MOBILE_PORTRAIT_FROZEN).toBe(true);
    expect(FULL_TABLE_MOBILE_FROZEN).toBe(true);
    expect(FULL_TABLE_MOBILE_LANDSCAPE_FROZEN).toBe(false);
    expect(CARD_VIEW_DESKTOP_FROZEN).toBe(false);
    expect(CARD_VIEW_MOBILE_PORTRAIT_FROZEN).toBe(false);
    expect(CARD_VIEW_MOBILE_LANDSCAPE_FROZEN).toBe(false);
    expect(CARD_VIEW_FROZEN).toBe(false);
    expect(FULL_TABLE_DESKTOP_AID_VISIBLE).toBe(false);
    expect(FULL_TABLE_DESKTOP_REFERENCE_IMAGE).toContain('a_digital_blackjack_poker_style_casino_game_ui_scr.png');
    expect(CONTRACT_DOC).toContain('Before changing layout');
    expect(CONTRACT_DOC).toContain('FROZEN');
    expect(CONTRACT_DOC).toContain('PENDING FREEZE');
  });

  it('exports shell zone order and action row contracts', () => {
    expect(FULL_TABLE_SHELL_ZONE_ORDER).toEqual(['dealer', 'command', 'cards', 'actions', 'boxes', 'tray']);
    expect(FULL_TABLE_SHELL_ZONE_CLASSES).toContain('bj-table-zone--cards');
    expect(FULL_TABLE_SHELL_ZONE_CLASSES.indexOf('bj-table-zone--actions')).toBeLessThan(
      FULL_TABLE_SHELL_ZONE_CLASSES.indexOf('bj-table-zone--boxes'),
    );
    expect(FULL_TABLE_ACTION_ROW_PRIMARY_BUTTONS).toEqual(['Stay', 'Hit']);
    expect(FULL_TABLE_OPTIONAL_PLAY_OVERLAY_BUTTONS).toContain('Split');
    expect(FULL_TABLE_LAYOUT_OWNER_FILES).toContain(FULL_TABLE_PLAY_ZONE_CSS);
  });
});

describe('Blackjack Full Table layout freeze — desktop regression guards', () => {
  it('does not introduce internal scrollbars on desktop Full Table card zone', () => {
    const cardZoneRule =
      PLAY_ZONE_CSS.match(
        /@media \(min-width: 721px\)[\s\S]*?\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table\s*\{[^}]*\}/,
      )?.[0] ??
      PLAY_ZONE_CSS.match(
        /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table\s*\{[^}]*\}/,
      )?.[0] ??
      '';
    expect(cardZoneRule).toMatch(/overflow:\s*visible/);
    expect(cardZoneRule).not.toMatch(/overflow-x:\s*hidden/);
    expect(cardZoneRule).not.toMatch(/overflow-y:\s*auto/);
  });

  it('keeps visible playing cards with value below stack in card area', () => {
    const html = renderFullTableAt(1280);
    expect(html).toContain(FULL_TABLE_DESKTOP_VIEW_ROOT);
    const cardsZone = zoneSlice(html, 'bj-table-zone--cards', 'bj-table-zone--actions');
    expect(cardsZone).toContain(FULL_TABLE_CARD_AREA_CLASS);
    expect(cardsZone).toContain('playing-card');
    expect(cardsZone).toContain(FULL_TABLE_CARD_VALUE_CLASS);
    const column = cardsZone.split('bj-arc__slot--card-column').find((c) => c.includes('playing-card')) ?? '';
    expect(column.indexOf('playing-card')).toBeLessThan(column.indexOf(FULL_TABLE_CARD_VALUE_CLASS));
  });

  it('renders Hit/Stay below card area and player boxes below actions', () => {
    const html = renderFullTableAt(1280);
    const cardsIdx = html.indexOf('bj-table-zone--cards');
    const actionsIdx = html.indexOf('bj-table-zone--actions');
    const boxesIdx = html.indexOf('bj-table-zone--boxes');
    expect(cardsIdx).toBeGreaterThan(-1);
    expect(actionsIdx).toBeGreaterThan(cardsIdx);
    expect(boxesIdx).toBeGreaterThan(actionsIdx);

    const actionsZone = zoneSlice(html, 'bj-table-zone--actions', 'bj-table-zone--boxes');
    expect(actionsZone).toContain(FULL_TABLE_PRIMARY_HIT_CLASS);
    expect(actionsZone).toContain('>Stay<');
    expect(actionsZone).toContain('>Hit<');
  });

  it('keeps Double/Split in optional overlay — not duplicated in Hit/Stay action row', () => {
    expect(PANEL_SRC).toContain('showDouble={false}');
    expect(PANEL_SRC).toContain('showSplit={false}');

    const html = renderFullTableAt(1280, splittableDesktopState());
    const cardsZone = zoneSlice(html, 'bj-table-zone--cards', 'bj-table-zone--actions');
    const actionsZone = zoneSlice(html, 'bj-table-zone--actions', 'bj-table-zone--boxes');
    expect(cardsZone).toContain(FULL_TABLE_OPTIONAL_PLAY_OVERLAY_ANCHOR_CLASS);
    expect(cardsZone).toContain('>Split<');
    expect(cardsZone).toContain(FULL_TABLE_OPTIONAL_PLAY_BUTTON_CLASS);
    expect(actionsZone).not.toContain('>Split<');
    expect(actionsZone).not.toContain('>Double<');
  });

  it('uses compact overlay button class for Double/Split — not primary Hit/Stay sizing', () => {
    expect(INSURANCE_OVERLAY_CSS).toContain(`.${FULL_TABLE_OPTIONAL_PLAY_BUTTON_CLASS}`);
    const hitRule =
      PLAY_ZONE_CSS.match(
        /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--actions \.ds-btn--hit[\s\S]*?\{[^}]*\}/,
      )?.[0] ?? '';
    expect(hitRule).toMatch(/max-height:\s*1\.55rem/);

    const html = renderFullTableAt(1280, splittableDesktopState());
    const cardsZone = zoneSlice(html, 'bj-table-zone--cards', 'bj-table-zone--actions');
    expect(cardsZone).toContain(FULL_TABLE_OPTIONAL_PLAY_BUTTON_CLASS);
    expect(PANEL_SRC).toContain('showDouble={false}');
    expect(PANEL_SRC).toContain('showSplit={false}');
  });

  it('does not render AID in desktop Full Table', () => {
    expect(FULL_TABLE_DESKTOP_AID_VISIBLE).toBe(false);
    const html = renderFullTableAt(1280);
    expect(html).toContain(FULL_TABLE_DESKTOP_VIEW_ROOT);
    expect(html).not.toMatch(/bj-view-full-desktop[\s\S]*>AID</);
  });

  it('forbids forbidden layout CSS patterns in play zone stylesheet', () => {
    for (const guard of FULL_TABLE_FORBIDDEN_LAYOUT_PATTERNS) {
      expect(PLAY_ZONE_CSS).not.toMatch(guard.pattern);
    }
  });

  it('scopes desktop polish tokens under min-width 721px bj-view-full-desktop only', () => {
    for (const token of FULL_TABLE_DESKTOP_POLISH_TOKENS) {
      expect(PLAY_ZONE_CSS).toMatch(
        new RegExp(`@media \\(min-width: 721px\\)[\\s\\S]*\\.bj-view-full-desktop[\\s\\S]*${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      );
    }
    const mobileOnlyBlock = PLAY_ZONE_CSS.match(
      /@media \(max-width: 720px\)[\s\S]*?\.bj-view-full-mobile[\s\S]*?\}/,
    )?.[0] ?? '';
    for (const token of FULL_TABLE_DESKTOP_POLISH_TOKENS) {
      expect(mobileOnlyBlock).not.toContain(token);
    }
  });

  it('hides Hit/Stay inside card area via CSS guard markers', () => {
    for (const marker of FULL_TABLE_FORBIDDEN_CARD_AREA_ACTION_MARKERS) {
      expect(PLAY_ZONE_CSS).toMatch(
        new RegExp(
          `\\.bj-view-full-desktop \\.bj-table-zone--cards\\.bj-cards-area--table \\.${marker.replace(/\./g, '\\.')}[\\s\\S]*display:\\s*none`,
        ),
      );
    }
  });

  it('keeps frozen actions-boxes-gap at 0.25rem so Hit/Stay sits close above box amounts', () => {
    expect(PLAY_ZONE_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-view-full-desktop[\s\S]*--bj-full-desktop-actions-boxes-gap:\s*0\.25rem/,
    );
    expect(PLAY_ZONE_CSS).not.toMatch(/--bj-full-desktop-actions-boxes-gap:\s*1\.25rem/);
  });

  it('pins desktop Full Table Hit/Stay to bottom of actions row toward player boxes', () => {
    expect(PLAY_ZONE_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*justify-content:\s*flex-end/,
    );
  });

  it('keeps positive cards-actions gap between card value band and Hit/Stay row', () => {
    expect(PLAY_ZONE_CSS).toMatch(/--bj-full-desktop-cards-actions-gap:\s*0\.28rem/);
    expect(PLAY_ZONE_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell[\s\S]*--bj-cards-actions-gap:\s*var\(--bj-full-desktop-cards-actions-gap\)/,
    );
    expect(PLAY_ZONE_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*padding-top:\s*var\(--bj-full-table-cards-actions-gap\)/,
    );
  });

  it('renders card column values in cards zone and Hit/Stay only in actions zone', () => {
    const html = renderFullTableAt(1280);
    const cardsZone = zoneSlice(html, 'bj-table-zone--cards', 'bj-table-zone--actions');
    const actionsZone = zoneSlice(html, 'bj-table-zone--actions', 'bj-table-zone--boxes');
    expect(cardsZone).toContain(FULL_TABLE_CARD_VALUE_CLASS);
    expect(cardsZone).not.toContain(FULL_TABLE_PRIMARY_HIT_CLASS);
    expect(actionsZone).toContain(FULL_TABLE_PRIMARY_HIT_CLASS);
    expect(actionsZone).not.toContain(FULL_TABLE_CARD_VALUE_CLASS);
  });

  it('scopes Card View in-box hand totals away from Full Table player boxes', () => {
    expect(PANEL_SRC).toMatch(/viewMode === 'card'[\s\S]*inBoxPlayPhase/);
    const html = renderFullTableAt(1280);
    const boxesZone = zoneSlice(html, 'bj-table-zone--boxes', 'bj-table-zone--bottom');
    expect(boxesZone).not.toContain('bj-phone-view__mini-hand-value');
  });
});

describe('Blackjack Full Table layout freeze — mobile regression guards', () => {
  it('renders mobile Full Table with same zone order and visible cards', () => {
    const html = renderFullTableAt(390);
    expect(html).toContain(FULL_TABLE_MOBILE_VIEW_ROOT);
    const cardsIdx = html.indexOf('bj-table-zone--cards');
    const actionsIdx = html.indexOf('bj-table-zone--actions');
    const boxesIdx = html.indexOf('bj-table-zone--boxes');
    expect(actionsIdx).toBeGreaterThan(cardsIdx);
    expect(boxesIdx).toBeGreaterThan(actionsIdx);

    const cardsZone = zoneSlice(html, 'bj-table-zone--cards', 'bj-table-zone--actions');
    expect(cardsZone).toContain('playing-card');
    expect(cardsZone).not.toContain(FULL_TABLE_OPTIONAL_PLAY_OVERLAY_ANCHOR_CLASS);
  });

  it('does not apply desktop-only card nudge to mobile Full Table markup', () => {
    simulatedWidth = 390;
    const html = renderFullTableAt(390);
    expect(html).toContain(FULL_TABLE_MOBILE_VIEW_ROOT);
    expect(html).not.toContain(FULL_TABLE_OPTIONAL_PLAY_OVERLAY_ANCHOR_CLASS);
  });

  it('keeps mobile Full Table card values in cards zone and Hit/Stay in actions zone', () => {
    const html = renderFullTableAt(390);
    const cardsZone = zoneSlice(html, 'bj-table-zone--cards', 'bj-table-zone--actions');
    const actionsZone = zoneSlice(html, 'bj-table-zone--actions', 'bj-table-zone--boxes');
    expect(cardsZone).toContain(FULL_TABLE_CARD_VALUE_CLASS);
    expect(cardsZone).not.toContain(FULL_TABLE_PRIMARY_HIT_CLASS);
    expect(actionsZone).toContain(FULL_TABLE_PRIMARY_HIT_CLASS);
  });
});

describe('Blackjack Full Table layout freeze — source ownership guards', () => {
  it('imports play-zone CSS after shared and card-layout stylesheets', () => {
    expect(INDEX_CSS.indexOf('bj-table-shared.css')).toBeLessThan(INDEX_CSS.indexOf('bj-card-layout.css'));
    expect(INDEX_CSS.indexOf('bj-card-layout.css')).toBeLessThan(INDEX_CSS.indexOf('bj-full-table-card-area.css'));
  });

  it('uses one Full Table actions render path', () => {
    expect(PANEL_SRC).toContain(FULL_TABLE_ACTIONS_RENDER_FN);
    expect(PANEL_SRC).toContain('actions={renderActionsContent()}');
    expect((PANEL_SRC.match(/<BlackjackActionPanel/g) ?? []).length).toBe(1);
  });

  it('does not define competing card-column grid in guarded CSS files', () => {
    for (const [path, css] of Object.entries(GUARDED_CSS)) {
      expect(css, path).not.toMatch(
        /\.bj-view-full-desktop \.bj-arc__slot--card-column\s*\{[^}]*grid-template-rows:[^}]*bj-full-table-card-stack-zone-height/,
      );
    }
    expect(GUARDED_CSS['src/styles/bj-table-shared.css']).not.toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table\s*\{[^}]*overflow:\s*hidden/,
    );
  });

  it('prevents Card View sources from overriding Full Table card-area class layout', () => {
    for (const [path, src] of Object.entries(CARD_VIEW_GUARD_SRC)) {
      expect(src, path).not.toMatch(/\.bj-view-full-desktop[\s\S]*\.bj-full-table-card-area[\s\S]*grid-template-rows/);
      expect(src, path).not.toMatch(/\.bj-full-table-card-area\s*\{[^}]*translateY/);
    }
    expect(CARD_VIEW_GUARD_SRC['src/components/BlackjackCardView.tsx']).not.toContain(
      FULL_TABLE_OPTIONAL_PLAY_OVERLAY_ANCHOR_CLASS,
    );
  });

  it('prevents Card View CSS from altering frozen Full Table spacing tokens', () => {
    for (const [path, src] of Object.entries(CARD_VIEW_GUARD_SRC)) {
      expect(src, path).not.toContain('--bj-full-desktop-actions-boxes-gap');
      expect(src, path).not.toMatch(/\.bj-view-full-desktop[\s\S]*--bj-full-desktop-/);
      expect(src, path).not.toMatch(/\.bj-view-full-mobile[\s\S]*--bj-full-desktop-/);
    }
    const playerRowCss = GUARDED_CSS['src/styles/bj-player-row-layout.css'];
    expect(playerRowCss).toMatch(
      /\.bj-view-card-desktop \.bj-table-slot-row\.bj-arc--player-boxes \.bj-phone-view__mini-hand-value/,
    );
    expect(playerRowCss).not.toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--player-boxes \.bj-phone-view__mini-hand-value/,
    );
    expect(playerRowCss).not.toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes \.bj-phone-view__mini-hand-value/,
    );
  });

  it('documents layout owner files in contract module', () => {
    for (const owner of FULL_TABLE_LAYOUT_OWNER_FILES) {
      expect(readFileSync(join(process.cwd(), owner), 'utf8').length).toBeGreaterThan(0);
    }
  });
});
