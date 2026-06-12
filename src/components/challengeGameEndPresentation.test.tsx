// @vitest-environment happy-dom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen } from '@testing-library/react';

import type { GameState } from '../types';
import { GameOverActionOverlay } from './GameOverActionOverlay';
import { BlackjackPanel } from './BlackjackPanel';
import { tableWithClaimedBox } from '../engine/blackjack/sanity/fixtures';

const noop = () => {};

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

describe('challenge game end presentation', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps IOU toggle below ledger action buttons', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/GameOverActionOverlay.tsx'), 'utf8');
    const actionsIdx = src.indexOf('bj-game-over__actions');
    const toggleIdx = src.indexOf('bj-game-over__iou-toggle');
    expect(actionsIdx).toBeGreaterThan(-1);
    expect(toggleIdx).toBeGreaterThan(actionsIdx);
  });

  it('renders desktop Game Summary inline in side panel without blocking overlay', () => {
    simulatedWidth = 1280;
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={endedChallengeState()} onGameStateChange={noop} />,
    );
    expect(html).toContain('Game Summary');
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

  it('inline Game Summary close hides panel only', () => {
    render(
      <GameOverActionOverlay
        layout="inline"
        open
        summaryMessage="Final totals"
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou={false}
        onConfirm={noop}
        onDismiss={noop}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Game Summary' })).toBeTruthy();
    expect(screen.queryByRole('presentation')).toBeNull();
  });
});
