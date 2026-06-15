import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../types';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { InsuranceDecisionOverlay } from './InsuranceDecisionOverlay';
import { GameOverActionOverlay } from './GameOverActionOverlay';
import { buildGameOverPresentationModel } from './gameOverPresentation';
import {
  BET_BOX_PULSE,
  BOX_BORDER_SELECTED,
  BOX_BORDER_TURN,
  getBoxActivePulseClassName,
  getBoxBorderVisualClasses,
  resolveBoxBorderVisualState,
} from './cardViewBox';
import {
  tableAfterStartPlaying,
  boxPlayerId,
  findCardId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import {
  blackjackHandKey,
  declineInsuranceForPersonOnState,
  takeInsuranceForPersonOnState,
} from '../engine/blackjack';
import { insuranceWinPayout } from '../engine/blackjack/rules';
import { getBlackjackProtocolPhase } from '../engine/blackjack/protocol';

const noop = () => {};

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_AREA_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
const GAME_OVER_CSS = readFileSync(join(process.cwd(), 'src/components/GameOverActionOverlay.css'), 'utf8');
const GAME_OVER_SRC = readFileSync(join(process.cwd(), 'src/components/GameOverActionOverlay.tsx'), 'utf8');
const TABLE_SRC = readFileSync(join(process.cwd(), 'src/screens/TableScreen.tsx'), 'utf8');
const INSURANCE_SRC = readFileSync(join(process.cwd(), 'src/components/InsuranceDecisionOverlay.tsx'), 'utf8');

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
  const box1 = boxPlayerId(state, 1)!;
  const box2 = boxPlayerId(state, 2)!;
  const k1 = blackjackHandKey(box1, 0);
  const k2 = blackjackHandKey(box2, 0);
  return {
    ...state,
    tableViewMode: 'full',
    selectedSeatId: box2,
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
    },
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
          cardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
          currentBet: 10,
          actionStatus: 'done',
        },
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

function settledMobileFullTableState(): GameState {
  let state = playingState();
  const deck = state.deck!;
  const box2 = boxPlayerId(state, 2)!;
  const k2 = blackjackHandKey(box2, 0);
  state = {
    ...state,
    tableMeta: { ...state.tableMeta, awaitingNextRound: true },
    blackjack: {
      ...state.blackjack!,
      status: 'resolved',
      isSettled: true,
      dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
      playerHands: {
        [k2]: {
          ...createBlackjackPlayerHand(box2, 0),
          cardIds: [findCardId(deck, '6'), findCardId(deck, '7')],
          currentBet: 10,
        },
      },
      outcomes: { [k2]: 'loss' },
    },
  };
  return state;
}

function insuranceState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  return {
    ...state,
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      insuranceOfferPending: true,
      insuranceBets: {},
      insuranceDeclined: {},
      dealerCardIds: [findCardId(deck, 'A'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: {
        [k1]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
          currentBet: 100,
          actionStatus: 'acting',
        },
      },
    },
  };
}

describe('blackjack polish regression', () => {
  it('highlights only the active-turn player box with existing turn border on Full Table', () => {
    const state = playingState();
    const box2 = boxPlayerId(state, 2)!;
    const box1 = boxPlayerId(state, 1)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId!;
    const active = resolveBoxBorderVisualState({
      state,
      boxPlayerId: box2,
      viewerPersonId: personId,
      activeBoxId: box2,
      playerPhase: true,
    });
    const inactive = resolveBoxBorderVisualState({
      state,
      boxPlayerId: box1,
      viewerPersonId: personId,
      activeBoxId: box2,
      playerPhase: true,
    });
    expect(active.isTurn).toBe(true);
    expect(inactive.isTurn).toBe(false);
    expect(PANEL_SRC).toContain("borderState.isTurn && viewMode === 'full' ? BOX_BORDER_TURN : ''");
  });

  it('keeps selected betting pulse separate from active-turn box border', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 3);
    const freeBox = boxPlayerId(state, 3)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId!;
    const betting = resolveBoxBorderVisualState({
      state,
      boxPlayerId: freeBox,
      viewerPersonId: personId,
      selectedBettingBoxId: freeBox,
      bettingStage: true,
      openStake: 10,
    });
    expect(getBoxBorderVisualClasses(betting)).toContain(BOX_BORDER_SELECTED);
    expect(getBoxActivePulseClassName(betting)).toBe(BET_BOX_PULSE);
    expect(getBoxBorderVisualClasses(betting)).not.toContain(BOX_BORDER_TURN);

    const playState = playingState();
    const playBox2 = boxPlayerId(playState, 2)!;
    const play = resolveBoxBorderVisualState({
      state: playState,
      boxPlayerId: playBox2,
      viewerPersonId: personId,
      activeBoxId: playBox2,
      playerPhase: true,
    });
    expect(getBoxBorderVisualClasses(play)).not.toContain(BOX_BORDER_TURN);
    expect(PANEL_SRC).toContain("borderState.isTurn && viewMode === 'full' ? BOX_BORDER_TURN : ''");
    expect(getBoxActivePulseClassName(play)).toBe('');
  });

  it('mobile Full Table end-state still renders numeric hand values in card columns', () => {
    simulatedWidth = 390;
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, {
        gameState: settledMobileFullTableState(),
        onGameStateChange: noop,
      }),
    );
    const cardsStart = html.indexOf('bj-cards-area--table');
    const cardsZone = html.slice(cardsStart, html.indexOf('bj-table-zone--actions', cardsStart));
    expect(cardsZone).toContain('bj-phone-view__box-value--card-column-below');
    expect(cardsZone).toMatch(/bj-phone-view__box-value--card-column-below[^>]*>13</);
  });

  it('desktop Full Table card area has +10px downward offset only on desktop', () => {
    expect(CARD_AREA_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-view-full-desktop[\s\S]*translateY\(10px\)/,
    );
    expect(CARD_AREA_CSS).not.toMatch(
      /@media \(max-width: 720px\)[\s\S]*translateY\(10px\)/,
    );
  });

  it('active value frame keeps fixed band height with inset padding', () => {
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-phone-view__box-value--active-turn[\s\S]*padding:\s*0\.1rem 0\.22rem/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-phone-view__box-value--active-turn[\s\S]*height:\s*var\(--bj-box-value-band-height\)/,
    );
  });

  it('insurance overlay disables duplicate submit and engine pays 2:1', () => {
    expect(PANEL_SRC).toContain('insuranceDecisionPending');
    expect(PANEL_SRC).toContain('pending={insuranceBusy}');
    expect(INSURANCE_SRC).toContain('pending = false');
    expect(INSURANCE_SRC).toMatch(/disabled=\{!canAfford \|\| disabled\}/);

    const html = renderToStaticMarkup(
      createElement(InsuranceDecisionOverlay, {
        boxLabel: 'Box 1',
        maxBet: 50,
        canAfford: true,
        pending: true,
        onInsurance: noop,
        onDecline: noop,
      }),
    );
    expect(html).toContain('disabled');

    let state = insuranceState();
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId!;
    state = takeInsuranceForPersonOnState(state, personId);
    expect(getBlackjackProtocolPhase(state)).not.toBe('insurance');
    expect(insuranceWinPayout(50)).toBe(150);
  });

  it('insurance decline advances when all required decisions are made', () => {
    let state = insuranceState();
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId!;
    state = declineInsuranceForPersonOnState(state, personId);
    expect(state.blackjack?.insuranceOfferPending).toBe(false);
    expect(getBlackjackProtocolPhase(state)).not.toBe('insurance');
  });

  it('Start New Game routes to same-table NewTableOverlay reset flow with compact game-over shell', () => {
    expect(PANEL_SRC).toContain("onBeginTableReset('newGame')");
    expect(TABLE_SRC).toMatch(/onBeginTableReset=\{\(variant[\s\S]*setResetSetupOpen\(true\)/);
    expect(TABLE_SRC).toMatch(/resetSetupVariant === 'newGame'[\s\S]*New Game/);
    expect(GAME_OVER_SRC).not.toContain('invite-modal--table-panel');
    expect(GAME_OVER_CSS).toMatch(/\.bj-game-over\s*\{[\s\S]*width:\s*min\(92vw,\s*24rem\)/);
    expect(GAME_OVER_CSS).toMatch(/\.bj-game-over\s*\{[\s\S]*background:/);

    const presentation = buildGameOverPresentationModel(
      tableAfterStartPlaying(500),
      'Game over',
      null,
      null,
    );
    const ownerHtml = renderToStaticMarkup(
      createElement(GameOverActionOverlay, {
        open: true,
        presentation,
        canSaveToLedger: false,
        ledgerAlreadyAdded: false,
        canCreateIou: false,
        canStartNewGame: true,
        onComplete: noop,
        onDismiss: noop,
      }),
    );
    const guestHtml = renderToStaticMarkup(
      createElement(GameOverActionOverlay, {
        open: true,
        presentation,
        canSaveToLedger: false,
        ledgerAlreadyAdded: false,
        canCreateIou: false,
        canStartNewGame: false,
        newGameDisabledReason: 'Only the table owner can start a new game.',
        onComplete: noop,
        onDismiss: noop,
      }),
    );
    expect(ownerHtml).not.toContain('invite-modal--table-panel');
    expect(guestHtml).toContain('disabled');
  });
});
