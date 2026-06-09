import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState, TableViewMode } from '../types';
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

const noop = () => {};

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

function renderPanelAt(width: number, state: GameState, height = 844): string {
  simulatedViewport = { width, height };
  return renderToStaticMarkup(<BlackjackPanel gameState={state} onGameStateChange={noop} />);
}

function withView(state: GameState, mode: TableViewMode): GameState {
  return { ...state, tableViewMode: mode };
}

function bettingStateWithSelection(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, 2);
  const ownerPersonId = state.tableMeta.ownerPersonId!;
  const box2 = boxPlayerId(state, 2)!;
  state = addChipToBoxStake(state, box2, 10, ownerPersonId);
  return { ...state, selectedSeatId: box2 };
}

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

const CANONICAL_SHELL_ZONES = [
  TABLE_UX.tableLayoutShell,
  TABLE_UX.tableZoneDealer,
  TABLE_UX.tableZoneSummary,
  TABLE_UX.tableZoneActions,
  TABLE_UX.cardsAreaHero,
  TABLE_UX.tableZoneBoxes,
  TABLE_UX.tableZoneBottom,
] as const;

describe('mobile Card View composition contract', () => {
  const sharedCss = () => readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
  const panelCss = () => readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
  const layoutCss = () => readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');

  it('uses BlackjackTableLayoutShell with canonical zone order', () => {
    const html = renderPanelAt(390, withView(bettingStateWithSelection(), 'card'));
    expect(html).toContain('data-device-view="mobile"');
    expect(html).toContain('bj-view-card-mobile');
    for (const zone of CANONICAL_SHELL_ZONES) {
      expect(html).toContain(zone);
    }
    const shellIdx = html.indexOf(TABLE_UX.tableLayoutShell);
    const dealerIdx = html.indexOf(TABLE_UX.tableZoneDealer);
    const summaryIdx = html.indexOf(TABLE_UX.tableZoneSummary);
    const actionsIdx = html.indexOf(TABLE_UX.tableZoneActions);
    const cardsIdx = html.indexOf(TABLE_UX.cardsAreaHero);
    const boxesIdx = html.indexOf(TABLE_UX.tableZoneBoxes);
    const trayIdx = html.indexOf(TABLE_UX.tableZoneBottom);
    expect(dealerIdx).toBeGreaterThan(shellIdx);
    expect(actionsIdx).toBeGreaterThan(dealerIdx);
    expect(summaryIdx).toBeGreaterThan(actionsIdx);
    expect(cardsIdx).toBeGreaterThan(summaryIdx);
    expect(boxesIdx).toBeGreaterThan(cardsIdx);
    expect(trayIdx).toBeGreaterThan(boxesIdx);
  });

  it('does not mount legacy mini-row or card-layout box grid wrappers', () => {
    const html = renderPanelAt(390, withView(bettingStateWithSelection(), 'card'));
    expect(html).not.toContain('bj-phone-view__mini-row');
    expect(html).not.toContain('bj-card-layout__boxes');
    expect(html).not.toContain('bj-card-layout__hero');
    expect(html).not.toContain('bj-phone-view__betting-stage--row');
  });

  it('shares full-arc player box classes with mobile Full Table', () => {
    const card = renderPanelAt(390, withView(bettingStateWithSelection(), 'card'));
    const full = renderPanelAt(390, withView(bettingStateWithSelection(), 'full'));
    expect(card).toContain(TABLE_UX.fullArcBox);
    expect(full).toContain(TABLE_UX.fullArcBox);
    expect(card).toContain('bj-arc--player-boxes');
    expect(full).toContain('bj-arc--player-boxes');
    expect(card).not.toContain('bj-phone-view__mini-hand--card-compact');
  });

  it('owned box uses one visual shell — slot chrome neutralized, pulse only on mini-hand', () => {
    const css = sharedCss();
    expect(css).toMatch(
      /\.bj-arc--player-boxes \.bj-arc__slot--owned[\s\S]*background:\s*none[\s\S]*padding:\s*0/,
    );
    expect(css).toMatch(
      /\.bj-view-card-mobile \.bj-arc__slot--owned[\s\S]*background:\s*none/,
    );
    expect(panelCss()).not.toMatch(
      /\.bj-arc__slot--owned\s*\{[\s\S]*background:\s*rgb\(0 0 0/,
    );

    const html = renderPanelAt(390, withView(playingState(), 'card'));
    const ownedSlot = html.match(
      /bj-arc__slot--owned[\s\S]{0,700}?bj-phone-view__bet-chip--pulse/,
    );
    expect(ownedSlot).toBeTruthy();
    const slotChunk = ownedSlot![0];
    expect(slotChunk).not.toMatch(/bj-arc__play-zone/);
    expect(slotChunk).toContain(TABLE_UX.fullArcBox);
    expect(slotChunk).not.toContain('bj-box--selected');
  });

  it('prevents horizontal overflow at common phone widths and keeps tray visible', () => {
    expect(panelCss()).toMatch(/\.bj-view-card-mobile[\s\S]*overflow-x:\s*hidden/);
    expect(sharedCss()).toMatch(
      /\.bj-view-full-mobile \.bj-casino__tray-wrap,\s*\n\s*\.bj-view-card-mobile \.bj-casino__tray-wrap[\s\S]*flex-shrink:\s*0/,
    );
    expect(layoutCss()).not.toMatch(
      /\.bj-view-card-mobile \.bj-card-layout__boxes/,
    );

    for (const [width, height] of [
      [390, 844],
      [844, 390],
    ] as const) {
      const html = renderPanelAt(width, withView(bettingStateWithSelection(), 'card'), height);
      expect(html).toContain('bj-casino__tray-wrap');
      expect(html).toContain(TABLE_UX.tableZoneBottom);
    }
  });

  it('betting boxes expose chip-drop targets for tray placement', () => {
    const state = bettingStateWithSelection();
    const box2 = boxPlayerId(state, 2)!;
    const html = renderPanelAt(390, withView(state, 'card'));
    expect(html).toContain(`data-chip-drop-box="${box2}"`);
    expect(html).toContain(`data-chip-drop-slot="2"`);
    expect(html).toContain('chip-tray');
  });

  it('mobile Full Table shares the same shell stretch and zone width rules', () => {
    const css = sharedCss();
    expect(css).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt-main,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt-main[\s\S]*align-items:\s*stretch/,
    );
    expect(css).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \*[\s\S]*width:\s*100%/,
    );
    const full = renderPanelAt(390, withView(bettingStateWithSelection(), 'full'));
    expect(full).toContain(TABLE_UX.tableLayoutShell);
    expect(full).toContain(TABLE_UX.tableZoneBottom);
  });

  it('classic cloth uses band height inside CardsArea and stays non-interactive', () => {
    const feltCss = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
    expect(feltCss).toContain('--bj-cloth-band-height');
    expect(feltCss).toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer__svg[\s\S]*height:\s*var\(--bj-cloth-band-height\)/,
    );
    expect(feltCss).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*pointer-events:\s*none/);
    expect(feltCss).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards > :not\(\.bj-felt-cloth-layer\)\s*\{[\s\S]*z-index:\s*1/,
    );

    const html = renderPanelAt(390, withView(bettingStateWithSelection(), 'card'));
    expect(html).toContain(TABLE_UX.feltClothLayer);
    const cardsIdx = html.indexOf(TABLE_UX.tableZoneCards);
    const clothIdx = html.indexOf(TABLE_UX.feltClothLayer);
    const boxesIdx = html.indexOf(TABLE_UX.tableZoneBoxes);
    expect(clothIdx).toBeGreaterThan(cardsIdx);
    expect(boxesIdx).toBeGreaterThan(clothIdx);
  });

  it('player boxes arc stays inside felt shell without card-layout wrappers', () => {
    const html = renderPanelAt(390, withView(bettingStateWithSelection(), 'card'));
    expect(html).toContain('bj-arc--player-boxes');
    expect(html).not.toContain('bj-card-layout__boxes');
    const ownedBox = html.match(
      /bj-arc__slot--owned[\s\S]{0,500}?bj-phone-view__mini-hand--full-arc/,
    );
    expect(ownedBox).toBeTruthy();
  });
});
