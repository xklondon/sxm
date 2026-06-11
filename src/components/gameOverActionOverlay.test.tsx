// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

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
import { tableWithClaimedBox } from '../engine/blackjack/sanity/fixtures';
import {
  addGameToPersonalLedger,
  hasPersonalLedgerEntryForTable,
} from '../engine/scoreLedger/scoreLedger';
import { buildGameEndIouHandoff } from '../engine/scoreLedger/gameEndIou';
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

describe('GameOverActionOverlay', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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
    expect(html).toContain('Game Over, congrats Alice, you won in 4 rounds.');
    expect(html).toContain('Add to Ledger');
    expect(html).toContain("Don&#x27;t Add");
    expect(html).toContain('Create IOU');
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

  it('fires IOU handoff on confirm even when ledger is not saved', () => {
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
    expect(onConfirm).toHaveBeenCalledWith({ saveLedger: false, createIou: true });
  });

  it('can save ledger and create IOU together', () => {
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
    fireEvent.click(within(overlay).getByRole('button', { name: 'Add to Ledger' }));
    expect(onConfirm).toHaveBeenCalledWith({ saveLedger: true, createIou: true });
  });
});

describe('GameOverActionOverlay — panel integration', () => {
  beforeEach(() => {
    installLocalStorageMock();
    saveScoreLedgerEntries([]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows overlay at game end without floating table buttons', () => {
    const state = endedChallengeState();
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={state} onGameStateChange={noop} />,
    );
    expect(html).toContain('bj-game-over-overlay');
    expect(html).toContain('Add to Ledger');
    expect(html).not.toContain('bj-game-end-actions');
    expect(html).not.toContain('Add IOU</button>');
  });

  it('add to ledger from overlay is idempotent', () => {
    const state = endedChallengeState();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<BlackjackPanel gameState={state} onGameStateChange={noop} />);
    const overlay = screen.getByRole('dialog');
    fireEvent.click(within(overlay).getByRole('button', { name: 'Add to Ledger' }));
    expect(hasPersonalLedgerEntryForTable(state.session.id)).toBe(true);
    const entries = addGameToPersonalLedger(state, { savedByEmail: 'alice@example.com' });
    expect(entries?.id).toBeTruthy();
    openSpy.mockRestore();
  });

  it('don’t add does not save ledger but can still open IOU when toggled', () => {
    const state = endedChallengeState();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const handoff = buildGameEndIouHandoff(state, 'alice@example.com');
    render(<BlackjackPanel gameState={state} onGameStateChange={noop} />);
    const overlay = screen.getByRole('dialog');
    fireEvent.click(within(overlay).getByRole('checkbox', { name: /create iou/i }));
    fireEvent.click(within(overlay).getByRole('button', { name: "Don't Add" }));
    expect(hasPersonalLedgerEntryForTable(state.session.id)).toBe(false);
    expect(openSpy).toHaveBeenCalledWith(handoff!.url, '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });
});
