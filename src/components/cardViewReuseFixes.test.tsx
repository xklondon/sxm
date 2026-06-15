import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { claimBoxSlot } from '../engine/session';
import { blackjackHandKey, addChipToBoxStake, confirmBoxStake } from '../engine/blackjack';
import { tableAfterStartPlaying, boxPlayerId, findCardId, withInstantInitialDeal } from '../engine/blackjack/sanity/fixtures';
import { TABLE_UX } from './tableUxContract';
import { BOX_BORDER_TURN } from './cardViewBox';

const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

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

function withView(state: GameState, view: 'full' | 'card'): GameState {
  return { ...state, tableViewMode: view };
}

function playingCardViewState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const handKey = blackjackHandKey(box1, 0);
  return withInstantInitialDeal({
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
      activeHandKey: handKey,
      activePlayerId: box1,
      dealerCardIds: [findCardId(deck, '7'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: {
        [handKey]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '6'), findCardId(deck, '7')],
          currentBet: 10,
          actionStatus: 'acting',
        },
      },
    },
  });
}

function splitEligibleCardViewState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const ownerId = state.tableMeta.ownerPersonId!;
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  state = addChipToBoxStake(state, box1, 20, ownerId);
  state = confirmBoxStake(state, box1);
  const handKey = blackjackHandKey(box1, 0);
  return withInstantInitialDeal({
    ...state,
    tableViewMode: 'card',
    selectedSeatId: box1,
    blackjackSettings: {
      ...state.blackjackSettings,
      allowSplit: true,
      allowDoubleDown: true,
    },
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      activeHandKey: handKey,
      activePlayerId: box1,
      dealerCardIds: [findCardId(deck, '7'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: {
        [handKey]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '8'), findCardId(deck, '8')],
          currentBet: 20,
          actionStatus: 'acting',
        },
      },
    },
  });
}

function renderPanel(state: GameState): string {
  return renderToStaticMarkup(
    <BlackjackPanel gameState={state} onGameStateChange={noop} />,
  );
}

describe('Card View reuse fixes', () => {
  it('desktop Card View player boxes reuse Full Table box width tokens', () => {
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-view-card-desktop \.bj-table-slot-row\.bj-arc--player-boxes > \.bj-arc__slot[\s\S]*--bj-cardview-desktop-mini-hand-width/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-slot-row\.bj-arc--player-boxes > \.bj-arc__slot[\s\S]*--bj-full-table-box-width/,
    );
  });

  it('desktop Card View applies active-turn box border on player boxes', () => {
    simulatedWidth = 1280;
    const html = renderPanel(playingCardViewState());
    expect(html).toContain('bj-view-card-desktop');
    expect(html).toContain(BOX_BORDER_TURN);
    expect(PANEL_SRC).toContain('borderState.isTurn ? BOX_BORDER_TURN :');
  });

  it('desktop Card View routes optional play overlay through cards area anchor', () => {
    expect(PANEL_SRC).toContain('isCardViewDesktop && isOptionalPlayOverlayVisible()');
    expect(PANEL_SRC).toContain('bj-optional-play-overlay-anchor');
    expect(PANEL_SRC).toContain('!isCardViewDesktop');
  });

  it('desktop Card View reuses shell BlackjackActionPanel for Hit/Stay only', () => {
    simulatedWidth = 1280;
    const html = renderPanel(playingCardViewState());
    const actionsZone =
      html.split(TABLE_UX.tableZoneActions)[1]?.split(TABLE_UX.tableZoneBoxes)[0] ?? '';
    expect(actionsZone).toContain('ds-btn--hit');
    expect(actionsZone).toContain('ds-btn--stand');
    expect(actionsZone).toContain('bj-table-actions');
  });

  it('mobile Card View hero value matches bank emphasis sizing token', () => {
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-card-view__hero-value[\s\S]*calc\(var\(--bj-seat-total-size\) \* 1\.35\)/,
    );
  });

  it('mobile Card View uses shell actions and optional play in command when split is legal', () => {
    simulatedWidth = 390;
    const html = renderPanel(splitEligibleCardViewState());
    const heroZone =
      html.split('bj-cards-area--hero')[1]?.split(TABLE_UX.tableZoneActions)[0] ?? '';
    expect(heroZone).not.toContain('bj-phone-view__side-action--hit');
    const commandZone =
      html.split(TABLE_UX.tableZoneSummary)[1]?.split(TABLE_UX.tableZoneActions)[0] ?? '';
    expect(commandZone).toContain('bj-optional-play-overlay');
    expect(html).toContain('>Split<');
    const actionsZone =
      html.split(TABLE_UX.tableZoneActions)[1]?.split(TABLE_UX.tableZoneBoxes)[0] ?? '';
    expect(actionsZone).toContain('ds-btn--hit');
    expect(actionsZone).toContain('ds-btn--stand');
  });

  it('mobile Card View shows hand value inside player box under ranks', () => {
    simulatedWidth = 390;
    const html = renderPanel(playingCardViewState());
    expect(html).toContain('bj-phone-view__mini-hand-value');
    expect(html).toContain('bj-view-card-mobile');
  });

  it('mobile portrait player boxes clip overflow without internal scroll', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc[\s\S]*overflow:\s*hidden/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-slot-row\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc[\s\S]*overflow:\s*hidden/,
    );
  });

  it('mobile Full Table still renders shared arc player boxes', () => {
    simulatedWidth = 390;
    const html = renderPanel(withView(playingCardViewState(), 'full'));
    expect(html).toContain('bj-view-full-mobile');
    expect(html).toContain(TABLE_UX.fullArcBox);
    expect(html).toContain('bj-value-chips');
  });
});
