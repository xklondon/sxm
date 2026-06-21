// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { GameState } from '../types';
import type { Rank } from '../types/deck';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { BlackjackPanel } from './BlackjackPanel';
import { tableAfterStartPlaying, tableWithClaimedBox, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import { createBlackjackShoe, shuffleBlackjackShoe } from '../engine/blackjack/shoe';
import { blackjackHandKey } from '../engine/blackjack';
import {
  completeStepwiseInitialDealIfNeeded,
  dealCardsButtonOnState,
  shuffleToStartOnState,
} from '../engine/blackjack/gameState';
import {
  emptyCardVisibility,
  maxVisibilityForRound,
  nextSequentialRevealStep,
  shouldUseOrderedInitialReveal,
} from '../engine/blackjack/dealing/cardRevealDisplay';
import { canOfferGameEndIou } from '../engine/scoreLedger/gameEndIou';
import { MOBILE_GAME_OVER_OVERLAY_DELAY_MS } from './roundSummaryOverlayTiming';

const noop = () => {};
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_AREA_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
const SHELL_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-blackjack-table-shell.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

vi.mock('../storage/profileStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage/profileStorage')>();
  return {
    ...actual,
    loadProfile: () => ({ name: 'Alice', email: 'alice@example.com' }),
  };
});

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
    addEventListener: noop,
    removeEventListener: noop,
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
    clearTimeout: (...args: Parameters<typeof clearTimeout>) => clearTimeout(...args),
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    },
  };
});

afterAll(() => {
  if (!hadWindow) {
    delete globalRef.window;
  }
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  simulatedWidth = 1280;
});

function deckWithRanks(seed: string, ranks: Rank[]) {
  const deck = shuffleBlackjackShoe(createBlackjackShoe(2), seed);
  const indices = ranks.map((rank) => deck.cards.findIndex((c) => c.id === findCardId(deck, rank)));
  const used = new Set(indices);
  return {
    ...deck,
    drawOrder: [...indices, ...deck.drawOrder.filter((i) => !used.has(i))],
  };
}

function readyOneBoxNatural(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const boxId = boxPlayerId(state, 1)!;
  state = addChipToBoxStake(state, boxId, 50);
  state = shuffleToStartOnState(state);
  return {
    ...state,
    deck: deckWithRanks('natural-bj-reveal', ['A', '9', '10', '8']),
    tableMeta: { ...state.tableMeta, bettingLocked: true },
    blackjackFlowSettings: { ...state.blackjackFlowSettings, initialDealMode: 'natural' },
  };
}

function simulateRevealLabels(
  round: NonNullable<GameState['blackjack']>,
  roundStatus: NonNullable<GameState['blackjack']>['status'],
): string[] {
  const target = maxVisibilityForRound(round);
  let visible = emptyCardVisibility();
  const labels: string[] = [];
  let guard = 0;
  while (guard < 20) {
    guard += 1;
    const before = JSON.stringify(visible);
    const stepped = nextSequentialRevealStep(visible, target, round, roundStatus);
    if (!stepped || JSON.stringify(stepped) === before) {
      break;
    }
    if (stepped.dealer > visible.dealer) {
      labels.push('D');
    } else {
      labels.push('P');
    }
    visible = stepped;
    if (JSON.stringify(visible) === JSON.stringify(target)) {
      break;
    }
  }
  return labels;
}

function endedPracticeState(): GameState {
  const base = tableWithClaimedBox(1);
  return {
    ...base,
    blackjackFlowSettings: { ...base.blackjackFlowSettings, initialDealMode: 'natural' },
    tableMeta: {
      ...base.tableMeta,
      gameStatus: 'ended',
      winnerId: base.tableMeta.ownerPersonId!,
      tableMode: 'practice',
    },
  };
}

function endedBankWinsState(): GameState {
  const base = endedPracticeState();
  return {
    ...base,
    tableMeta: {
      ...base.tableMeta,
      tableMode: 'challenge',
      winnerId: base.session.bankPlayerId!,
      gameEndReason: 'bank-has-all-chips',
    },
  };
}

function endedPlayerBlackjackRoundState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      gameStatus: 'ended',
      winnerId: state.tableMeta.ownerPersonId!,
    },
    blackjack: {
      ...state.blackjack!,
      status: 'resolved',
      isSettled: true,
      dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
      playerHands: {
        [k1]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds: [findCardId(deck, 'A'), findCardId(deck, 'K')],
          currentBet: 50,
          actionStatus: 'done',
          naturalSettled: true,
        },
      },
      outcomes: { [k1]: 'blackjack-win' },
    },
  };
}

function endedFractionalBankBustState(): GameState {
  const base = endedPracticeState();
  return {
    ...base,
    tableMeta: {
      ...base.tableMeta,
      tableMode: 'challenge',
      winnerId: null,
      gameEndReason: 'bank-bust',
      settlementMode: 'fractional',
      bankBustSettlementMode: 'winner-takes-all',
    },
  };
}

describe('desktop Full Table scrollbar regression', () => {
  it('avoids overflow-y auto on Full Table card zone (visible + hidden axis trap)', () => {
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*overflow:\s*hidden/,
    );
    expect(SHELL_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*overflow-y:\s*auto/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards\.bj-full-table-card-area[\s\S]*overflow:\s*visible/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*overflow:\s*hidden/,
    );
    expect(SHELL_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards[^\{]*\{[^}]*overflow-y:\s*auto/,
    );
  });
});

describe('player natural blackjack reveal order', () => {
  it('uses ordered initial reveal when round advances to bank-turn before UI catch-up', () => {
    let state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(readyOneBoxNatural()));
    const round = state.blackjack!;
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const hand = round.playerHands[handKey]!;
    expect(hand.cardIds.filter(Boolean)).toHaveLength(2);
    expect(round.dealerCardIds.filter(Boolean)).toHaveLength(2);
    expect(round.dealerHoleHidden).toBe(true);

    const target = maxVisibilityForRound(round);
    expect(
      shouldUseOrderedInitialReveal(round.status, emptyCardVisibility(), target),
    ).toBe(true);

    const labels = simulateRevealLabels(round, round.status);
    expect(labels).toEqual(['P', 'D', 'P', 'D']);
  });
});

describe('game end visibility regression', () => {
  it('opens desktop This Table game-over panel even when side rail was closed', () => {
    expect(PANEL_SRC).toContain('desktopSideRailPanel');
    expect(PANEL_SRC).toMatch(
      /showGameOverDesktopPanel \? 'thisTable' : sideRailPanel/,
    );
    expect(PANEL_SRC).toMatch(/thisTableInline && desktopSideRailPanel && renderSideRailPanel\('dock'\)/);
  });

  it('renders desktop game summary for practice ended', () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: endedPracticeState(), onGameStateChange: noop }),
    );
    expect(html).toContain('Game Over');
    expect(html).toContain('bj-game-over--inline');
  });

  it('renders desktop game summary for challenge bank wins', () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: endedBankWinsState(), onGameStateChange: noop }),
    );
    expect(html).toContain('Game Over');
    expect(html).toContain('Add to Ledger');
  });

  it('renders desktop game summary for challenge non-bank wins', () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, {
        gameState: {
          ...endedPracticeState(),
          tableMeta: {
            ...endedPracticeState().tableMeta,
            tableMode: 'challenge',
          },
        },
        onGameStateChange: noop,
      }),
    );
    expect(html).toContain('Game Over');
  });

  it('renders desktop game summary when player blackjack ends table', () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, {
        gameState: endedPlayerBlackjackRoundState(),
        onGameStateChange: noop,
      }),
    );
    expect(html).toContain('Game Over');
  });

  it('renders desktop game summary for fractional bank bust with null winner and IOU unavailable', () => {
    const state = endedFractionalBankBustState();
    expect(canOfferGameEndIou(state, 'alice@example.com')).toBe(false);
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: state, onGameStateChange: noop }),
    );
    expect(html).toContain('Game Over');
    expect(html).toContain('Add to Ledger');
  });

  it('shows mobile game-over overlay after reveal delay with natural deal mode', async () => {
    vi.useFakeTimers();
    simulatedWidth = 390;
    render(
      createElement(BlackjackPanel, {
        gameState: endedPracticeState(),
        onGameStateChange: noop,
      }),
    );
    expect(screen.queryByRole('dialog', { name: /Game Over/i })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MOBILE_GAME_OVER_OVERLAY_DELAY_MS);
    });
    expect(screen.getByRole('dialog', { name: /Game Over/i })).toBeTruthy();
  });
});
