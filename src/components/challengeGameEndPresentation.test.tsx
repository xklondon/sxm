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
  canCreateGameEndIou,
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

function gameOverMarkup(
  state: GameState,
  options?: { canCreateIou?: boolean; canStartNewGame?: boolean },
): string {
  const viewerId = state.tableMeta.ownerPersonId ?? null;
  const presentation = buildGameOverPresentationModel(state, '', viewerId, null);
  return renderToStaticMarkup(
    <GameOverActionOverlay
      open
      layout="overlay"
      presentation={presentation}
      canSaveToLedger
      ledgerAlreadyAdded={false}
      canCreateIou={options?.canCreateIou ?? canOfferGameEndIou(state, 'alice@example.com')}
      canStartNewGame={options?.canStartNewGame ?? true}
      onComplete={noop}
      onDismiss={noop}
    />,
  );
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
    const html = gameOverMarkup(bankWinsChallengeState());
    expect(html).toContain('Game Over');
    expect(html).toContain('bj-game-over-overlay');
    expect(html).toContain('Add to Ledger');
  });

  it('renders desktop game summary when non-bank player wins', () => {
    const html = gameOverMarkup(endedChallengeState());
    expect(html).toContain('Game Over');
    expect(html).toContain('Add to Ledger');
  });

  it('renders desktop game summary for practice ended table', () => {
    const html = gameOverMarkup(practiceEndedState());
    expect(html).toContain('Game Over');
    expect(html).toContain('Start New Game');
  });

  it('renders desktop game summary for fractional bank-bust with null winnerId', () => {
    const state = fractionalBankBustEndedState();
    expect(canOfferGameEndIou(state, 'alice@example.com')).toBe(false);
    const html = gameOverMarkup(state, { canCreateIou: false });
    expect(html).toContain('Game Over');
    expect(html).toContain('Add to Ledger');
    expect(html).toContain('disabled');
  });

  it('renders practice ended game with Add to Ledger option', () => {
    const html = gameOverMarkup(practiceEndedState());
    expect(html).toContain('Add to Ledger');
  });

  it('shows mobile game-over overlay after reveal delay elapses', () => {
    const html = gameOverMarkup(endedChallengeState());
    expect(html).toContain('bj-game-over-overlay');
    expect(html).toContain('role="dialog"');
    expect(PANEL_SRC).toContain('MOBILE_GAME_OVER_OVERLAY_DELAY_MS');
    expect(PANEL_SRC).toContain('setGameOverDelayReady(true)');
  });

  it('enables IOU toggle only when canonical create request resolves for viewer', () => {
    const state = endedChallengeState();
    expect(canCreateGameEndIou(state, 'alice@example.com')).toBe(true);
    expect(canOfferGameEndIou(state, 'alice@example.com')).toBe(true);
    expect(canCreateGameEndIou(fractionalBankBustEndedState(), 'alice@example.com')).toBe(false);
    expect(buildGameEndIouHandoff(state, 'alice@example.com')).not.toBeNull();
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

  it('renders canonical overlay game summary after ended state with instant dealing', () => {
    const html = gameOverMarkup(endedChallengeState());
    expect(html).toContain('Game Over');
    expect(html).toContain('bj-game-over-overlay');
    expect(html).not.toContain('bj-game-over--inline');
    expect(html).toContain('Add to Ledger');
    expect(PANEL_SRC).toContain("layout={BLACKJACK_GAME_OVER_LAYOUT}");
  });

  it('keeps mobile game-over centered overlay route after reveal delay', () => {
    simulatedWidth = 390;
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    const overlaySrc = readFileSync(join(process.cwd(), 'src/components/GameOverActionOverlay.tsx'), 'utf8');
    expect(overlaySrc).toContain('bj-game-over-overlay');
    expect(panelSrc).toContain('showGameOverModal');
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
