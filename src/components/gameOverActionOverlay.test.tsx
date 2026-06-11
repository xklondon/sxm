// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';

vi.mock('../storage/profileStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage/profileStorage')>();
  return {
    ...actual,
    loadProfile: () => ({ name: 'Alice', email: 'alice@example.com' }),
  };
});

import type { GameState } from '../types';
import { GameOverActionOverlay } from './GameOverActionOverlay';
import { BlackjackPanel } from './BlackjackPanel';
import * as iouHandoffApi from '../api/iouHandoff';
import { tableWithClaimedBox } from '../engine/blackjack/sanity/fixtures';
import {
  addGameToPersonalLedger,
  hasPersonalLedgerEntryForTable,
} from '../engine/scoreLedger/scoreLedger';
import { saveScoreLedgerEntries } from '../storage/scoreLedgerStorage';

const noop = () => {};

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
      invites: [
        {
          inviteId: 'inv-1',
          tableId: base.session.id,
          invitedEmail: 'bob@example.com',
          invitedName: 'Bob',
          invitedBy: 'alice@example.com',
          inviteStatus: 'accepted',
          canInviteOthers: false,
          createdAt: new Date().toISOString(),
          token: 'token-1',
        },
      ],
    },
    session: { ...base.session, currentRound: 4 },
  };
}

function installLocalStorageMock(): void {
  if (typeof globalThis.localStorage !== 'undefined') {
    return;
  }
  const bag: Record<string, string> = {};
  (globalThis as { localStorage: Storage }).localStorage = {
    getItem: (key: string) => bag[key] ?? null,
    setItem: (key: string, value: string) => {
      bag[key] = value;
    },
    removeItem: (key: string) => {
      delete bag[key];
    },
    clear: () => {
      for (const key of Object.keys(bag)) {
        delete bag[key];
      }
    },
    key: (index: number) => Object.keys(bag)[index] ?? null,
    length: 0,
  } as Storage;
}

async function confirmIouFromOverlay(saveLedger: boolean) {
  const overlay = screen.getByRole('dialog');
  fireEvent.click(within(overlay).getByRole('checkbox', { name: /create iou/i }));
  fireEvent.click(
    within(overlay).getByRole('button', {
      name: saveLedger ? 'Add to Ledger' : "Don't Add",
    }),
  );
  const confirmOverlay = screen.getByRole('dialog');
  fireEvent.click(within(confirmOverlay).getByRole('button', { name: 'Create IOU' }));
}

describe('GameOverActionOverlay', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders summary, ledger actions, and Create IOU toggle', () => {
    const html = renderToStaticMarkup(
      <GameOverActionOverlay
        open
        summaryMessage="Game Over, congrats Alice, you won in 4 rounds."
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou
        onConfirm={noop}
        onDismiss={noop}
      />,
    );
    expect(html).toContain('Game Over');
    expect(html).toContain('Add to Ledger');
    expect(html).toContain('Create IOU');
  });

  it('shows SXM-side IOU confirmation before calling onConfirm', () => {
    const onConfirm = vi.fn();
    render(
      <GameOverActionOverlay
        open
        summaryMessage="Game over."
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou
        onConfirm={onConfirm}
        onDismiss={noop}
      />,
    );
    const overlay = screen.getByRole('dialog');
    fireEvent.click(within(overlay).getByRole('checkbox', { name: /create iou/i }));
    fireEvent.click(within(overlay).getByRole('button', { name: "Don't Add" }));
    expect(screen.getByText(/Create IOU in IOU Wallet for this wager/i)).toBeTruthy();
    fireEvent.click(within(overlay).getByRole('button', { name: 'Create IOU' }));
    expect(onConfirm).toHaveBeenCalledWith({ saveLedger: false, createIou: true });
  });

  it('disables Create IOU toggle when no valid counterparty email', () => {
    const html = renderToStaticMarkup(
      <GameOverActionOverlay
        open
        summaryMessage="Game over."
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou={false}
        iouDisabledReason="Add a counterparty email to create an IOU handoff."
        onConfirm={noop}
        onDismiss={noop}
      />,
    );
    expect(html).toContain('disabled');
    expect(html).toContain('Add a counterparty email');
  });
});

describe('GameOverActionOverlay — panel integration', () => {
  beforeEach(() => {
    installLocalStorageMock();
    saveScoreLedgerEntries([]);
    vi.spyOn(iouHandoffApi, 'createIouHandoff').mockResolvedValue({
      ok: true,
      iouId: 'iou-123',
      status: 'pending',
      message: 'IOU created and sent.',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows overlay at game end without floating table buttons', () => {
    const state = endedChallengeState();
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={state} onGameStateChange={noop} />,
    );
    expect(html).toContain('bj-game-over-overlay');
    expect(html).toContain('Add to Ledger');
    expect(html).not.toContain('bj-game-end-actions');
  });

  it('add to ledger from overlay is idempotent', () => {
    const state = endedChallengeState();
    render(<BlackjackPanel gameState={state} onGameStateChange={noop} />);
    const overlay = screen.getByRole('dialog');
    fireEvent.click(within(overlay).getByRole('button', { name: 'Add to Ledger' }));
    expect(hasPersonalLedgerEntryForTable(state.session.id)).toBe(true);
    const entries = addGameToPersonalLedger(state, { savedByEmail: 'alice@example.com' });
    expect(entries?.id).toBeTruthy();
  });

  it('calls backend IOU create without saving ledger when toggled', async () => {
    const state = endedChallengeState();
    render(<BlackjackPanel gameState={state} onGameStateChange={noop} />);
    await confirmIouFromOverlay(false);
    await waitFor(() => {
      expect(iouHandoffApi.createIouHandoff).toHaveBeenCalledTimes(1);
    });
    expect(hasPersonalLedgerEntryForTable(state.session.id)).toBe(false);
    expect(screen.getByText(/IOU created/i)).toBeTruthy();
  });
});
