// @vitest-environment happy-dom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen, act } from '@testing-library/react';

import type { GameState } from '../types';
import { GameOverActionOverlay } from './GameOverActionOverlay';
import { buildGameOverPresentationModel } from './gameOverPresentation';
import { BlackjackPanel } from './BlackjackPanel';
import { tableWithClaimedBox } from '../engine/blackjack/sanity/fixtures';
import {
  buildGameEndIouHandoff,
  canOfferGameEndIou,
} from '../engine/scoreLedger/gameEndIou';
import { MOBILE_GAME_OVER_OVERLAY_DELAY_MS } from './roundSummaryOverlayTiming';

const noop = () => {};
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');

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

function endedChallengeState(): GameState {
  const base = tableWithClaimedBox(1);
  const bankId = base.session.bankPlayerId!;
  const ownerPersonId = base.tableMeta.ownerPersonId!;
  return {
    ...base,
    players: {
      ...base.players,
      [bankId]: { ...base.players[bankId]!, playerType: 'real', controllerName: 'Bob' },
    },
    tableMeta: {
      ...base.tableMeta,
      gameStatus: 'ended',
      winnerId: ownerPersonId,
      tableMode: 'challenge',
      agreement: {
        stakeDescription: '€20',
        defaultChips: 500,
        agreedAt: new Date().toISOString(),
      },
      owner: {
        ownerName: 'Alice',
        ownerEmail: 'alice@example.com',
        createdAt: new Date().toISOString(),
      },
      setupInvitedEmails: ['bob@example.com'],
    },
    session: { ...base.session, currentRound: 4 },
  };
}

function bankWinsChallengeState(): GameState {
  const base = endedChallengeState();
  return {
    ...base,
    tableMeta: {
      ...base.tableMeta,
      winnerId: base.session.bankPlayerId!,
      gameEndReason: 'bank-has-all-chips',
    },
  };
}

function fractionalBankBustEndedState(): GameState {
  const base = endedChallengeState();
  return {
    ...base,
    tableMeta: {
      ...base.tableMeta,
      winnerId: null,
      gameEndReason: 'bank-bust',
      settlementMode: 'fractional',
      bankBustSettlementMode: 'winner-takes-all',
    },
  };
}

function practiceEndedState(): GameState {
  const base = endedChallengeState();
  return {
    ...base,
    tableMeta: {
      ...base.tableMeta,
      tableMode: 'practice',
    },
  };
}

function instantDeal(state: GameState): GameState {
  return {
    ...state,
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
    },
  };
}

describe('challenge game end presentation', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
    simulatedWidth = 1280;
  });

  it('orders game-over sections: ledger row, IOU row, then Start New Game', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/GameOverActionOverlay.tsx'), 'utf8');
    const ledgerIdx = src.indexOf('bj-game-over__action-row');
    const iouIdx = src.indexOf('Create IOU');
    const actionsIdx = src.indexOf('bj-game-over__actions');
    expect(ledgerIdx).toBeGreaterThan(-1);
    expect(iouIdx).toBeGreaterThan(ledgerIdx);
    expect(actionsIdx).toBeGreaterThan(iouIdx);
  });

  it('renders desktop game summary when player bank wins', () => {
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={instantDeal(bankWinsChallengeState())} onGameStateChange={noop} />,
    );
    expect(html).toContain('Game Over');
    expect(html).toContain('bj-game-over--inline');
    expect(html).toContain('Add to Ledger');
  });

  it('renders desktop game summary when non-bank player wins', () => {
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={instantDeal(endedChallengeState())} onGameStateChange={noop} />,
    );
    expect(html).toContain('Game Over');
    expect(html).toContain('Add to Ledger');
  });

  it('renders desktop game summary for practice ended table', () => {
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={instantDeal(practiceEndedState())} onGameStateChange={noop} />,
    );
    expect(html).toContain('Game Over');
    expect(html).toContain('Start New Game');
  });

  it('renders desktop game summary for fractional bank-bust with null winnerId', () => {
    const state = fractionalBankBustEndedState();
    expect(canOfferGameEndIou(state, 'alice@example.com')).toBe(false);
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={instantDeal(state)} onGameStateChange={noop} />,
    );
    expect(html).toContain('Game Over');
    expect(html).toContain('Add to Ledger');
    expect(html).toContain('disabled');
  });

  it('renders practice ended game with Add to Ledger option', () => {
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={instantDeal(practiceEndedState())} onGameStateChange={noop} />,
    );
    expect(html).toContain('Add to Ledger');
  });

  it('shows mobile game-over overlay after reveal delay elapses', async () => {
    vi.useFakeTimers();
    simulatedWidth = 390;
    render(<BlackjackPanel gameState={instantDeal(endedChallengeState())} onGameStateChange={noop} />);
    expect(screen.queryByRole('dialog', { name: /Game Over/i })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MOBILE_GAME_OVER_OVERLAY_DELAY_MS);
    });
    expect(screen.getByRole('dialog', { name: /Game Over/i })).toBeTruthy();
  });

  it('enables IOU toggle only when buildGameEndIouHandoff resolves a valid handoff', () => {
    const state = endedChallengeState();
    expect(buildGameEndIouHandoff(state, 'alice@example.com')).not.toBeNull();
    expect(buildGameEndIouHandoff(fractionalBankBustEndedState(), 'alice@example.com')).toBeNull();
  });

  it('aligns desktop card columns to player boxes via shared slot row geometry', () => {
    expect(PANEL_SRC).toContain('bj-table-slot-row__lead-spacer');
    expect(PANEL_SRC).toContain('showAddBoxLead');
    expect(PANEL_SRC).toMatch(
      /displaySlots\.map\(\(slot\)[\s\S]*renderArcCardColumn\(slot\.playerId, slot\.slotNumber\)/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--cards[\s\S]*minmax\(0,\s*max-content\)/,
    );
  });

  it('renders desktop game summary after ended state with instant dealing', () => {
    let state = endedChallengeState();
    state = {
      ...state,
      blackjackFlowSettings: {
        ...state.blackjackFlowSettings,
        initialDealMode: 'instant',
      },
    };
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={state} onGameStateChange={noop} />,
    );
    expect(html).toContain('Game Over');
    expect(html).toContain('bj-game-over--inline');
    expect(html).not.toContain('bj-game-over-overlay');
    expect(html).toContain('Add to Ledger');
  });

  it('keeps mobile game-over centered overlay route after reveal delay', () => {
    simulatedWidth = 390;
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    const overlaySrc = readFileSync(join(process.cwd(), 'src/components/GameOverActionOverlay.tsx'), 'utf8');
    expect(overlaySrc).toContain('bj-game-over-overlay');
    expect(panelSrc).toContain('showGameOverOverlay');
    expect(panelSrc).toContain('MOBILE_GAME_OVER_OVERLAY_DELAY_MS');
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={endedChallengeState()} onGameStateChange={noop} />,
    );
    expect(html).not.toContain('bj-game-over-overlay');
    expect(html).not.toContain('bj-game-over--inline');
  });

  it('keeps final table cards rendered at game end on desktop', () => {
    simulatedWidth = 1280;
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={endedChallengeState()} onGameStateChange={noop} />,
    );
    expect(html).toContain('bj-casino__felt');
    expect(html).toContain('bj-arc--cards');
  });

  it('shows bank player identity in dealer bank area for challenge', () => {
    simulatedWidth = 1280;
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={endedChallengeState()} onGameStateChange={noop} />,
    );
    expect(html).toContain('Bank: Bob');
  });

  it('inline Game Over close hides panel only', () => {
    render(
      <GameOverActionOverlay
        layout="inline"
        open
        presentation={buildGameOverPresentationModel(
          endedChallengeState(),
          'Final totals',
          null,
          'Try again later.',
        )}
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou={false}
        onComplete={noop}
        onDismiss={noop}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Game Over' })).toBeTruthy();
    expect(screen.queryByRole('presentation')).toBeNull();
  });
});
