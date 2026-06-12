// @vitest-environment happy-dom
import type React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { GameState } from '../types';
import type { LedgerEntry } from '../types/ledger';
import { tableAfterStartPlaying, tableWithClaimedBox } from '../engine/blackjack/sanity/fixtures';
import { applyCardVisibility } from '../engine/blackjack/dealing/cardRevealDisplay';
import { buildTableInfoDisplay } from './tableInfoDisplay';
import { buildGameOverSummary } from '../engine/scoreLedger/scoreLedger';
import { buildChallengeEndRankings } from '../engine/scoreLedger/challengeEndAccounting';
import { DealerBlock } from './DealerBlock';
import { BlackjackPanel } from './BlackjackPanel';
import {
  MOBILE_GAME_OVER_OVERLAY_DELAY_MS,
  ROUND_SUMMARY_OVERLAY_DELAY_MS,
} from './roundSummaryOverlayTiming';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const noop = () => {};

function renderDealerBlock(overrides: Partial<React.ComponentProps<typeof DealerBlock>> = {}) {
  return renderToStaticMarkup(
    <DealerBlock
      awaitingNextRound={false}
      gameEnded={false}
      onNextRound={noop}
      dealerCards={null}
      protocolPhase="betting"
      bankerReady
      shoeStarted
      bettingOpen
      canDeal={false}
      hasStakes
      onShuffleToStart={noop}
      shuffleAnimating={false}
      onDealCards={noop}
      onDealNextCard={noop}
      onDrawBank={noop}
      dealActionPending={false}
      nextRoundPending={false}
      engineStatus="idle"
      initialDealManual={false}
      bankDrawManual={false}
      {...overrides}
    />,
  );
}

vi.mock('../storage/profileStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage/profileStorage')>();
  return {
    ...actual,
    loadProfile: () => ({ name: 'Alice', email: 'alice@example.com' }),
  };
});

let simulatedWidth = 1280;
const globalRef = globalThis as unknown as { window?: unknown };

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

function appendTestLedgerEntry(
  state: GameState,
  entry: Omit<LedgerEntry, 'id' | 'timestamp'>,
): GameState {
  return {
    ...state,
    ledger: {
      ...state.ledger,
      entries: [
        ...state.ledger.entries,
        {
          ...entry,
          id: `test-${entry.playerId}-${entry.balanceAfter}`,
          timestamp: new Date().toISOString(),
        },
      ],
    },
  };
}

function singleHolderWinState(): GameState {
  let state = tableAfterStartPlaying(500, 500);
  const ownerId = state.tableMeta.ownerPersonId!;
  const bankId = state.session.bankPlayerId!;
  state = appendTestLedgerEntry(state, {
    roundNumber: 3,
    playerId: ownerId,
    entryType: 'win-paid',
    amount: 500,
    balanceBefore: 500,
    balanceAfter: 1000,
    description: 'test: owner wins all',
  });
  state = appendTestLedgerEntry(state, {
    roundNumber: 3,
    playerId: bankId,
    entryType: 'loss-collected',
    amount: -500,
    balanceBefore: 500,
    balanceAfter: 0,
    description: 'test: bank bust',
  });
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      gameStatus: 'ended',
      winnerId: ownerId,
      gameEndReason: 'single-holder',
      tableMode: 'challenge',
    },
    session: { ...state.session, currentRound: 3 },
  };
}

describe('blackjack five-issue fixes', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    simulatedWidth = 1280;
  });

  it('disables Deal Cards for non-host viewers', () => {
    const onDeal = vi.fn();
    const html = renderDealerBlock({ canDeal: false, onDealCards: onDeal });
    expect(html).toContain('dealer-block__action--disabled');
    expect(html).toContain('Deal Cards');
  });

  it('keeps Deal Cards enabled for table host', () => {
    expect(PANEL_SRC).toContain('const canDealCards = tableOwner && canDeal');
    expect(PANEL_SRC).toContain('canDeal: canDealCards');
    expect(PANEL_SRC).toMatch(/function handlePrimaryDealAction\(\) \{[\s\S]*if \(!tableOwner\)/);
  });

  it('does not fire deal action when non-host handler is guarded', () => {
    const onDeal = vi.fn();
    render(
      <DealerBlock
        awaitingNextRound={false}
        gameEnded={false}
        onNextRound={noop}
        dealerCards={null}
        protocolPhase="betting"
        bankerReady
        shoeStarted
        bettingOpen
        canDeal={false}
        hasStakes
        onShuffleToStart={noop}
        shuffleAnimating={false}
        onDealCards={onDeal}
        onDealNextCard={noop}
        onDrawBank={noop}
        dealActionPending={false}
        nextRoundPending={false}
        engineStatus="idle"
        initialDealManual={false}
        bankDrawManual={false}
      />,
    );
    const dealBtn = screen.getByRole('button', { name: /Deal Cards/i });
    fireEvent.click(dealBtn);
    expect(onDeal).not.toHaveBeenCalled();
  });

  it('hides bank value until visible dealer card is revealed during natural deal', () => {
    let state = tableWithClaimedBox(1);
    const deck = state.deck!;
    const dealerUp = deck.cards[0]!.id;
    const dealerHole = deck.cards[1]!.id;
    state = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        status: 'player-turns',
        dealerHoleHidden: true,
        dealerCardIds: [dealerUp, dealerHole],
      },
    };
    const masked = applyCardVisibility(state, { dealer: 0, hands: {} });
    expect(buildTableInfoDisplay(state, null).bankValue).not.toBeNull();
    expect(buildTableInfoDisplay(state, null, masked).bankValue).toBeNull();
  });

  it('shows bank value only after visible dealer card reveal', () => {
    let state = tableWithClaimedBox(1);
    const deck = state.deck!;
    const dealerUp = deck.cards[0]!.id;
    const dealerHole = deck.cards[1]!.id;
    state = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        status: 'player-turns',
        dealerHoleHidden: true,
        dealerCardIds: [dealerUp, dealerHole],
      },
    };
    const oneVisible = applyCardVisibility(state, { dealer: 1, hands: {} });
    const info = buildTableInfoDisplay(state, null, oneVisible);
    expect(info.bankValue).not.toBeNull();
    expect(info.bankValue).toBeLessThan(22);
  });

  it('renders card-area hand values below card stacks in full table', () => {
    const valueIdx = PANEL_SRC.indexOf('cardColumnValueLabel');
    const belowIdx = PANEL_SRC.indexOf('TABLE_UX.cardColumnValueBelow');
    const stackIdx = PANEL_SRC.indexOf('renderArcCardStack');
    expect(valueIdx).toBeGreaterThan(-1);
    expect(belowIdx).toBeGreaterThan(-1);
    expect(stackIdx).toBeGreaterThan(-1);
    expect(valueIdx).toBeGreaterThan(stackIdx);
  });

  it('renders Card View hero hand value below cards', () => {
    const cardsIdx = CARD_VIEW_SRC.indexOf('bj-phone-view__cards-slot');
    const metaIdx = CARD_VIEW_SRC.indexOf('bj-phone-view__hand-meta--below-cards');
    expect(cardsIdx).toBeGreaterThan(-1);
    expect(metaIdx).toBeGreaterThan(cardsIdx);
  });

  it('waits for mobile game-over overlay until reveal completes and delay elapses', () => {
    expect(PANEL_SRC).toContain('MOBILE_GAME_OVER_OVERLAY_DELAY_MS');
    expect(PANEL_SRC).toContain('gameOverDelayReady');
    expect(PANEL_SRC).toMatch(
      /showGameOverOverlay[\s\S]*cardRevealComplete[\s\S]*gameOverDelayReady/,
    );
    expect(MOBILE_GAME_OVER_OVERLAY_DELAY_MS).toBe(ROUND_SUMMARY_OVERLAY_DELAY_MS);
  });

  it('uses final chip totals in game-over summary and balances to chips in play', () => {
    const state = singleHolderWinState();
    const { message, entry } = buildGameOverSummary(state);
    expect(message).toContain('1000');
    expect(message).not.toContain('1100');
    expect(message).not.toMatch(/500 chips.*500 chips/);

    const rankings = buildChallengeEndRankings(state);
    const total = rankings.reduce((sum, row) => sum + row.endingChips, 0);
    expect(total).toBe(1000);

    const winner = entry?.participants?.find((p) => p.outcome === 'winner');
    const loser = entry?.participants?.find((p) => p.outcome === 'loser');
    expect(winner?.endingChips).toBe(1000);
    expect(loser?.endingChips).toBe(0);
  });

  it('does not show mobile game-over overlay immediately at ended state', () => {
    simulatedWidth = 390;
    const state = singleHolderWinState();
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={state} onGameStateChange={noop} />,
    );
    expect(html).not.toContain('bj-game-over-overlay');
  });
});
