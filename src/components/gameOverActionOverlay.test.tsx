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
import type { GameOverPresentationModel } from './gameOverPresentation';
import { BlackjackPanel } from './BlackjackPanel';
import * as iouHandoffApi from '../api/iouHandoff';
import { tableWithClaimedBox } from '../engine/blackjack/sanity/fixtures';
import {
  hasPersonalLedgerEntryForTable,
} from '../engine/scoreLedger/scoreLedger';
import { saveScoreLedgerEntries } from '../storage/scoreLedgerStorage';

const noop = () => {};

const samplePresentation: GameOverPresentationModel = {
  title: 'Game Over',
  visual: { id: 'happy-chips', tone: 'happy', glyph: '🎉', label: 'Victory dance' },
  winnerLine: 'Alice won.',
  resultLine: '€20 owed',
  roundsLine: '4 rounds played',
  magic8Line: 'Outlook good.',
  rawSummary: 'Game Over\nAlice won\nFinal chips: 520',
};

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

async function clickNewGame(options: {
  saveLedger?: boolean;
  createIou?: boolean;
  iouMessage?: string;
}) {
  const overlay = screen.getByRole('dialog');
  if (options.saveLedger) {
    fireEvent.click(within(overlay).getByRole('radio', { name: /add to ledger/i }));
  }
  if (options.createIou) {
    const checkbox = within(overlay).getByRole('checkbox', { name: /create iou/i }) as HTMLInputElement;
    if (!checkbox.checked) {
      fireEvent.click(checkbox);
    }
    if (options.iouMessage) {
      fireEvent.change(within(overlay).getByPlaceholderText(/optional note for the iou handoff/i), {
        target: { value: options.iouMessage },
      });
    }
  }
  fireEvent.click(within(overlay).getByRole('button', { name: 'New Game' }));
}

describe('GameOverActionOverlay', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders title, visual, summary, Magic 8, ledger choice, IOU toggle, message field, and New Game', () => {
    const html = renderToStaticMarkup(
      <GameOverActionOverlay
        open
        presentation={samplePresentation}
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou
        onComplete={noop}
        onDismiss={noop}
      />,
    );
    expect(html).toContain('Game Over');
    expect(html).toContain('Victory dance');
    expect(html).toContain('Alice won.');
    expect(html).toContain('Magic 8 Ball');
    expect(html).toContain('Outlook good.');
    expect(html).toContain('Add to Ledger');
    expect(html).toContain('Don&#x27;t Add');
    expect(html).toContain('Create IOU');
    expect(html).toContain('Add message to IOU');
    expect(html).toContain('New Game');
  });

  it('calls onComplete with ledger and IOU choices only from New Game', async () => {
    const onComplete = vi.fn();
    render(
      <GameOverActionOverlay
        open
        presentation={samplePresentation}
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou
        onComplete={onComplete}
        onDismiss={noop}
      />,
    );
    await clickNewGame({ saveLedger: true, createIou: true, iouMessage: 'Pay up soon' });
    expect(onComplete).toHaveBeenCalledWith({
      saveLedger: true,
      createIou: true,
      iouMessage: 'Pay up soon',
    });
  });

  it('does not call onComplete when dismissed', () => {
    const onComplete = vi.fn();
    render(
      <GameOverActionOverlay
        open
        presentation={samplePresentation}
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou={false}
        onComplete={onComplete}
        onDismiss={noop}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /close without saving/i }));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('disables Create IOU toggle when no valid counterparty email', () => {
    const html = renderToStaticMarkup(
      <GameOverActionOverlay
        open
        presentation={samplePresentation}
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou={false}
        iouDisabledReason="Add a counterparty email to create an IOU handoff."
        onComplete={noop}
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

  it('shows overlay at game end without floating table buttons on mobile', () => {
    const state = endedChallengeState();
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={state} onGameStateChange={noop} />,
    );
    expect(html).toContain('Add to Ledger');
    expect(html).not.toContain('bj-game-end-actions');
  });

  it('applies Add to Ledger only when New Game is clicked', async () => {
    const state = endedChallengeState();
    const onBeginTableReset = vi.fn();
    render(
      <BlackjackPanel
        gameState={state}
        onGameStateChange={noop}
        onBeginTableReset={onBeginTableReset}
      />,
    );
    expect(hasPersonalLedgerEntryForTable(state.session.id)).toBe(false);
    await clickNewGame({ saveLedger: true });
    expect(hasPersonalLedgerEntryForTable(state.session.id)).toBe(true);
    expect(onBeginTableReset).toHaveBeenCalledWith('newGame');
  });

  it('calls backend IOU create with custom message without saving ledger', async () => {
    const state = endedChallengeState();
    render(
      <BlackjackPanel
        gameState={state}
        onGameStateChange={noop}
        onBeginTableReset={vi.fn()}
      />,
    );
    await clickNewGame({ createIou: true, iouMessage: 'Custom IOU note' });
    await waitFor(() => {
      expect(iouHandoffApi.createIouHandoff).toHaveBeenCalledTimes(1);
    });
    expect(iouHandoffApi.createIouHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Custom IOU note' }),
    );
    expect(hasPersonalLedgerEntryForTable(state.session.id)).toBe(false);
  });

  it('does not save ledger or create IOU when overlay is dismissed', async () => {
    const state = endedChallengeState();
    render(<BlackjackPanel gameState={state} onGameStateChange={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /close without saving/i }));
    expect(hasPersonalLedgerEntryForTable(state.session.id)).toBe(false);
    expect(iouHandoffApi.createIouHandoff).not.toHaveBeenCalled();
  });
});
