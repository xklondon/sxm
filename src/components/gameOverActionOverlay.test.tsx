// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
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
import { buildGameOverPresentationModel } from './gameOverPresentation';
import { IOU_HANDOFF_MESSAGE_MAX_LENGTH } from './gameOverIouMessage';
import { tableWithClaimedBox } from '../engine/blackjack/sanity/fixtures';

const noop = () => {};

function samplePresentation(rounds = 4) {
  const state = endedChallengeState();
  return buildGameOverPresentationModel(
    { ...state, session: { ...state.session, currentRound: rounds } },
    'Game Over summary',
    state.tableMeta.ownerPersonId,
    'Outlook good.',
  );
}

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

async function clickStartNewGame(options: {
  saveLedger?: boolean;
  createIou?: boolean;
  iouMessage?: string;
  openMessage?: boolean;
}) {
  const overlay = screen.getByRole('dialog');
  if (options.saveLedger) {
    const ledgerToggle = within(overlay).getByRole('checkbox', {
      name: /add to ledger/i,
    }) as HTMLInputElement;
    if (!ledgerToggle.checked) {
      fireEvent.click(ledgerToggle);
    }
  }
  if (options.createIou) {
    const iouToggle = within(overlay).getByRole('checkbox', { name: /create iou/i }) as HTMLInputElement;
    if (!iouToggle.checked) {
      fireEvent.click(iouToggle);
    }
    if (options.openMessage || options.iouMessage) {
      fireEvent.click(within(overlay).getByRole('button', { name: 'Add message' }));
    }
    if (options.iouMessage) {
      fireEvent.change(within(overlay).getByPlaceholderText(/optional note for the iou handoff/i), {
        target: { value: options.iouMessage },
      });
    }
  }
  fireEvent.click(within(overlay).getByRole('button', { name: 'Start New Game' }));
}

async function clickExitTable(options?: {
  createIou?: boolean;
  iouMessage?: string;
  openMessage?: boolean;
}) {
  const overlay = screen.getByRole('dialog');
  if (options?.createIou) {
    const iouToggle = within(overlay).getByRole('checkbox', { name: /create iou/i }) as HTMLInputElement;
    if (!iouToggle.checked) {
      fireEvent.click(iouToggle);
    }
    if (options.openMessage || options.iouMessage) {
      fireEvent.click(within(overlay).getByRole('button', { name: 'Add message' }));
    }
    if (options.iouMessage) {
      fireEvent.change(within(overlay).getByPlaceholderText(/optional note for the iou handoff/i), {
        target: { value: options.iouMessage },
      });
    }
  }
  fireEvent.click(within(overlay).getByRole('button', { name: 'Exit Table' }));
}

describe('GameOverActionOverlay', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders round comment, ledger toggle/link, IOU toggle/message, and Start New Game', () => {
    const html = renderToStaticMarkup(
      <GameOverActionOverlay
        open
        presentation={samplePresentation(2)}
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou
        onOpenLedger={noop}
        onComplete={noop}
        onDismiss={noop}
      />,
    );
    expect(html).toContain('Ouch, that was a quick one.');
    expect(html).toContain('Add to Ledger');
    expect(html).toContain('Open Ledger');
    expect(html).toContain('Create IOU');
    expect(html).toContain('Add message');
    expect(html).toContain('Start New Game');
    expect(html).toContain('Exit Table');
    expect(html).not.toContain('Don&#x27;t Add');
  });

  it('does not save ledger when Add to Ledger toggle is on until Start New Game', async () => {
    const onComplete = vi.fn();
    render(
      <GameOverActionOverlay
        open
        presentation={samplePresentation()}
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou={false}
        onComplete={onComplete}
        onDismiss={noop}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /add to ledger/i }));
    expect(onComplete).not.toHaveBeenCalled();
    await clickStartNewGame({ saveLedger: true });
    expect(onComplete).toHaveBeenCalledWith({
      saveLedger: true,
      createIou: false,
      iouMessage: undefined,
      nextAction: 'new-game',
    });
  });

  it('opens ledger via Open Ledger link without completing game over', () => {
    const onOpenLedger = vi.fn();
    render(
      <GameOverActionOverlay
        open
        presentation={samplePresentation()}
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou={false}
        onOpenLedger={onOpenLedger}
        onComplete={noop}
        onDismiss={noop}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open Ledger' }));
    expect(onOpenLedger).toHaveBeenCalledTimes(1);
  });

  it('passes custom IOU message capped at 180 characters', async () => {
    const onComplete = vi.fn();
    const longMessage = 'x'.repeat(IOU_HANDOFF_MESSAGE_MAX_LENGTH + 20);
    render(
      <GameOverActionOverlay
        open
        presentation={samplePresentation()}
        canSaveToLedger={false}
        ledgerAlreadyAdded={false}
        canCreateIou
        onComplete={onComplete}
        onDismiss={noop}
      />,
    );
    await clickStartNewGame({
      createIou: true,
      openMessage: true,
      iouMessage: longMessage,
    });
    expect(onComplete).toHaveBeenCalledWith({
      saveLedger: false,
      createIou: true,
      iouMessage: 'x'.repeat(IOU_HANDOFF_MESSAGE_MAX_LENGTH),
      nextAction: 'new-game',
    });
  });

  it('uses default IOU message when custom field is empty', async () => {
    const onComplete = vi.fn();
    render(
      <GameOverActionOverlay
        open
        presentation={samplePresentation()}
        canSaveToLedger={false}
        ledgerAlreadyAdded={false}
        canCreateIou
        onComplete={onComplete}
        onDismiss={noop}
      />,
    );
    await clickStartNewGame({ createIou: true });
    expect(onComplete).toHaveBeenCalledWith({
      saveLedger: false,
      createIou: true,
      iouMessage: undefined,
      nextAction: 'new-game',
    });
  });

  it('passes exit-table action when Exit Table is clicked', async () => {
    const onComplete = vi.fn();
    render(
      <GameOverActionOverlay
        open
        presentation={samplePresentation()}
        canSaveToLedger={false}
        ledgerAlreadyAdded={false}
        canCreateIou
        onComplete={onComplete}
        onDismiss={noop}
      />,
    );
    await clickExitTable({ createIou: true, iouMessage: 'Exit note' });
    expect(onComplete).toHaveBeenCalledWith({
      saveLedger: false,
      createIou: true,
      iouMessage: 'Exit note',
      nextAction: 'exit-table',
    });
  });

  it('disables Start New Game for non-owner', () => {
    render(
      <GameOverActionOverlay
        open
        presentation={samplePresentation()}
        canSaveToLedger
        ledgerAlreadyAdded={false}
        canCreateIou={false}
        canStartNewGame={false}
        newGameDisabledReason="Only the table owner can start a new game."
        onComplete={noop}
        onDismiss={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'Start New Game' }).hasAttribute('disabled')).toBe(true);
  });

  it('does not call onComplete when dismissed', () => {
    const onComplete = vi.fn();
    render(
      <GameOverActionOverlay
        open
        presentation={samplePresentation()}
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

  it('shows IOU error, re-enables actions, and offers continue without IOU', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <GameOverActionOverlay
        open
        presentation={samplePresentation()}
        canSaveToLedger={false}
        ledgerAlreadyAdded={false}
        canCreateIou
        onComplete={onComplete}
        onDismiss={noop}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /create iou/i }));

    rerender(
      <GameOverActionOverlay
        open
        presentation={samplePresentation()}
        canSaveToLedger={false}
        ledgerAlreadyAdded={false}
        canCreateIou
        pending
        iouPending
        onComplete={onComplete}
        onDismiss={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'Creating IOU…' }).hasAttribute('disabled')).toBe(
      true,
    );

    rerender(
      <GameOverActionOverlay
        open
        presentation={samplePresentation()}
        canSaveToLedger={false}
        ledgerAlreadyAdded={false}
        canCreateIou
        pending={false}
        iouPending={false}
        iouFeedback={{ tone: 'error', message: 'Invalid partner secret' }}
        onComplete={onComplete}
        onDismiss={noop}
      />,
    );

    const startButton = screen.getByRole('button', { name: 'Start New Game' });
    expect(startButton.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText(/Invalid partner secret/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue without IOU' })).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox', { name: /create iou/i }));
    fireEvent.click(startButton);
    expect(onComplete).toHaveBeenLastCalledWith({
      saveLedger: false,
      createIou: false,
      iouMessage: undefined,
      nextAction: 'new-game',
    });
  });

  it('continues without IOU via secondary button after failure', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    render(
      <GameOverActionOverlay
        open
        presentation={samplePresentation()}
        canSaveToLedger={false}
        ledgerAlreadyAdded={false}
        canCreateIou
        iouFeedback={{ tone: 'error', message: 'Handoff rejected' }}
        onComplete={onComplete}
        onDismiss={noop}
      />,
    );

    await clickStartNewGame({ createIou: true });
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ createIou: true, nextAction: 'new-game' }),
    );

    onComplete.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Continue without IOU' }));
    expect(onComplete).toHaveBeenCalledWith({
      saveLedger: false,
      createIou: false,
      iouMessage: undefined,
      nextAction: 'new-game',
    });
  });
});
