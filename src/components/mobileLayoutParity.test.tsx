import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { TableViewMode } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { TABLE_UX } from './tableUxContract';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { addChipToBoxStake, blackjackHandKey } from '../engine/blackjack';
import {
  createMobileLayoutMatchMedia,
  type SimulatedViewport,
} from '../test/mobileLayoutMatchMedia';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');

const LAYOUT_AFFECTING_PROPS =
  /(?:height|min-height|max-height|flex|grid|padding|margin|overflow|position|transform|z-index|width|max-width)\s*:/i;

const MOBILE_SHELL_ZONE_MARKERS = [
  'table-zone--dealer',
  'table-zone--summary',
  'table-zone--actions',
  'table-zone--boxes',
  'table-zone--bottom',
] as const;

function assertPairedMobileShellRules(css: string): string[] {
  const unpaired: string[] = [];
  const ruleRe = /([^{]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(css)) !== null) {
    const selector = match[1]!.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();
    const body = match[2]!;
    if (!LAYOUT_AFFECTING_PROPS.test(body)) continue;
    if (
      !/table-zone--(?:dealer|summary|actions|boxes|bottom)|bj-table-layout-shell|bj-mobile-table-shell|bj-casino__felt-main|bj-casino__felt\b|bj-casino__rail-wrap|bj-casino__tray-wrap|bj-arc--player-boxes|dealer-block/.test(
        selector,
      )
    ) {
      continue;
    }
    if (/table-zone--cards|cards-area--|bj-arc--cards|bj-arc-separator|table-zone--play/.test(selector)) {
      continue;
    }
    const hasFull = selector.includes('.bj-view-full-mobile');
    const hasCard = selector.includes('.bj-view-card-mobile');
    if ((hasFull || hasCard) && !(hasFull && hasCard)) {
      unpaired.push(selector);
    }
  }
  return unpaired;
}

function extractOwnedBoxClasses(html: string): string[] {
  const sectionStart = zoneIndex(html, TABLE_UX.tableZoneBoxes);
  const sectionEnd = zoneIndex(html, TABLE_UX.tableZoneBottom);
  const boxes = html.slice(sectionStart, sectionEnd > sectionStart ? sectionEnd : undefined);
  const owned: string[] = [];
  const slotRe = /bj-arc__slot--owned[\s\S]*?class="([^"]*bj-phone-view__mini-hand[^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = slotRe.exec(boxes)) !== null) {
    owned.push(match[1]!);
  }
  return owned;
}

function shellSection(html: string): string {
  const start = html.indexOf(TABLE_UX.tableLayoutShell);
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf('bj-casino__this-table--below', start);
  return end > start ? html.slice(start, end) : html.slice(start, start + 12000);
}

function zoneIndex(html: string, zoneClass: string): number {
  return html.indexOf(zoneClass);
}

function extractBoxClasses(html: string): string[] {
  return extractOwnedBoxClasses(html);
}

let simulatedViewport: SimulatedViewport = { width: 390, height: 844 };
const globalRef = globalThis as unknown as { window?: unknown };
const hadWindow = 'window' in globalRef;

beforeAll(() => {
  globalRef.window = {
    matchMedia: createMobileLayoutMatchMedia(() => simulatedViewport),
  };
});

afterAll(() => {
  if (!hadWindow) {
    delete globalRef.window;
  }
});

function renderAt(mode: TableViewMode, width = 390, height = 844): string {
  simulatedViewport = { width, height };
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, 2);
  const ownerPersonId = state.tableMeta.ownerPersonId!;
  const box2 = boxPlayerId(state, 2)!;
  state = addChipToBoxStake(state, box2, 10, ownerPersonId);
  const deck = state.deck!;
  const k2 = blackjackHandKey(box2, 0);
  state = {
    ...state,
    tableViewMode: mode,
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
  return renderToStaticMarkup(<BlackjackPanel gameState={state} onGameStateChange={() => {}} />);
}

describe('mobile layout parity audit — Full Table vs Card View', () => {
  it('requires paired mobile view selectors for shell layout rules', () => {
    const unpaired = assertPairedMobileShellRules(`${SHARED_CSS}\n${PANEL_CSS}`);
    expect(unpaired).toEqual([]);
  });

  it('shares identical mobile shell zone CSS pairs for dealer/command/actions/boxes/tray', () => {
    for (const marker of MOBILE_SHELL_ZONE_MARKERS) {
      expect(SHARED_CSS).toMatch(
        new RegExp(`\\.bj-view-full-mobile[\\s\\S]*${marker}[\\s\\S]*\\.bj-view-card-mobile[\\s\\S]*${marker}`),
      );
    }
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt,\s*\n\s*\.bj-view-full-mobile \.bj-casino__felt--card-view,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt--card-view[\s\S]*flex:\s*var\(--bj-mobile-felt-fill-grow\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt[\s\S]*height:\s*var\(--bj-mobile-felt-height\)/,
    );
  });

  it('does not keep Card View-only mobile layout selectors on shell zones in panel CSS', () => {
    for (const marker of MOBILE_SHELL_ZONE_MARKERS) {
      expect(PANEL_CSS).not.toMatch(
        new RegExp(`\\.bj-view-card-mobile[\\s\\S]*${marker}[\\s\\S]*\\{[\\s\\S]*?(?:height|padding|margin|flex):`),
      );
    }
    expect(PANEL_CSS).not.toMatch(/\.bj-view-card-mobile \.dealer-block[\s\S]*padding:/);
    expect(PANEL_CSS).not.toMatch(/\.bj-view-card-mobile \.bj-casino__felt--card-view/);
  });

  it('renders the same canonical shell class tree except CardsArea mode', () => {
    const full = renderAt('full');
    const card = renderAt('card');

    expect(full).toContain('bj-view-full-mobile');
    expect(card).toContain('bj-view-card-mobile');
    expect(full).toContain(TABLE_UX.mobileTableShell);
    expect(card).toContain(TABLE_UX.mobileTableShell);

    const sharedMarkers = [
      TABLE_UX.tableLayoutShell,
      TABLE_UX.tableZoneDealer,
      TABLE_UX.tableZoneSummary,
      TABLE_UX.tableZoneActions,
      TABLE_UX.tableZoneBoxes,
      TABLE_UX.tableZoneBottom,
      'bj-card-layout__command',
      'bj-arc--player-boxes',
      TABLE_UX.fullArcBox,
    ] as const;

    for (const marker of sharedMarkers) {
      expect(full).toContain(marker);
      expect(card).toContain(marker);
    }

    expect(full).toContain(TABLE_UX.cardsAreaTable);
    expect(card).toContain(TABLE_UX.cardsAreaHero);
    expect(full).not.toContain(TABLE_UX.cardsAreaHero);
    expect(card).not.toContain(TABLE_UX.cardsAreaTable);
  });

  it('keeps actions after dealer and command after actions without overlap selectors', () => {
    const html = renderAt('card');
    const section = shellSection(html);
    const dealerIdx = zoneIndex(section, TABLE_UX.tableZoneDealer);
    const actionsIdx = zoneIndex(section, TABLE_UX.tableZoneActions);
    const commandIdx = zoneIndex(section, 'bj-card-layout__command');
    expect(dealerIdx).toBeLessThan(actionsIdx);
    expect(actionsIdx).toBeLessThan(commandIdx);

    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--dealer,\s*\n\s*\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--dealer[\s\S]*overflow:\s*visible/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--actions,\s*\n\s*\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--actions[\s\S]*margin-top:\s*var\(--bj-mobile-zone-command-top-gap\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__status\s*\{[\s\S]*?white-space:\s*normal[\s\S]*?\}/,
    );
  });

  it('uses the same player box classes in mobile Full Table and Card View', () => {
    const fullBoxes = extractBoxClasses(renderAt('full'));
    const cardBoxes = extractBoxClasses(renderAt('card'));
    expect(fullBoxes.length).toBeGreaterThan(0);
    expect(cardBoxes.length).toBe(fullBoxes.length);
    for (const cls of fullBoxes) {
      expect(cls).toContain(TABLE_UX.fullArcBox);
      expect(cls).not.toContain('mini-hand--card-compact');
    }
    expect(cardBoxes).toEqual(fullBoxes);
  });

  it('neutralizes legacy card-layout and phone-view composition CSS', () => {
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-phone-view__mini-row[\s\S]*display:\s*none\s*!important/);
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-card-layout[\s\S]*display:\s*contents/);
    expect(CARD_LAYOUT_CSS).not.toMatch(/\.bj-card-layout__boxes\s*\{/);
    expect(CARD_LAYOUT_CSS).not.toMatch(/\.bj-card-layout__actions\s*\{/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand--card-compact[\s\S]*display:\s*none\s*!important/);
  });
});
