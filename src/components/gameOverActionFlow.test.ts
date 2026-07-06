import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as iouHandoffApi from '../api/iouHandoff';
import { tableWithClaimedBox } from '../engine/blackjack/sanity/fixtures';
import type { GameState } from '../types';
import { runGameOverCompleteAction } from './gameOverActionFlow';

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

describe('runGameOverCompleteAction', () => {
  beforeEach(() => {
    installLocalStorageMock();
    localStorage.clear();
    vi.spyOn(iouHandoffApi, 'createIouHandoff').mockResolvedValue({
      ok: true,
      iouId: 'iou-123',
      status: 'pending',
      message: 'IOU created and sent.',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls IOU create before new game when IOU is selected', async () => {
    const state = endedChallengeState();
    const beginNewGame = vi.fn();
    await runGameOverCompleteAction(
      {
        saveLedger: false,
        createIou: true,
        iouMessage: 'Custom IOU note',
        nextAction: 'new-game',
      },
      {
        getState: () => state,
        addToPersonalLedger: vi.fn(),
        beginNewGame,
        exitTable: vi.fn(),
        setIouFeedback: vi.fn(),
        canResetTable: true,
        canExitTable: true,
      },
    );
    expect(iouHandoffApi.createIouHandoff).toHaveBeenCalledTimes(1);
    expect(iouHandoffApi.createIouHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Custom IOU note' }),
    );
    expect(beginNewGame).toHaveBeenCalledTimes(1);
  });

  it('does not call IOU endpoint when IOU is not selected', async () => {
    const beginNewGame = vi.fn();
    await runGameOverCompleteAction(
      {
        saveLedger: false,
        createIou: false,
        nextAction: 'new-game',
      },
      {
        getState: () => endedChallengeState(),
        addToPersonalLedger: vi.fn(),
        beginNewGame,
        exitTable: vi.fn(),
        setIouFeedback: vi.fn(),
        canResetTable: true,
        canExitTable: true,
      },
    );
    expect(iouHandoffApi.createIouHandoff).not.toHaveBeenCalled();
    expect(beginNewGame).toHaveBeenCalledTimes(1);
  });

  it('calls IOU endpoint before exit table when selected', async () => {
    const exitTable = vi.fn();
    await runGameOverCompleteAction(
      {
        saveLedger: false,
        createIou: true,
        iouMessage: 'On my way out',
        nextAction: 'exit-table',
      },
      {
        getState: () => endedChallengeState(),
        addToPersonalLedger: vi.fn(),
        beginNewGame: vi.fn(),
        exitTable,
        setIouFeedback: vi.fn(),
        canResetTable: true,
        canExitTable: true,
      },
    );
    expect(iouHandoffApi.createIouHandoff).toHaveBeenCalledTimes(1);
    expect(exitTable).toHaveBeenCalledTimes(1);
  });

  it('still calls IOU endpoint when localStorage has prior handoff id', async () => {
    const state = endedChallengeState();
    localStorage.setItem(`sxm-iou-handoff:${state.session.id}:${state.session.id}`, 'prior-iou');
    await runGameOverCompleteAction(
      {
        saveLedger: false,
        createIou: true,
        nextAction: 'new-game',
      },
      {
        getState: () => state,
        addToPersonalLedger: vi.fn(),
        beginNewGame: vi.fn(),
        exitTable: vi.fn(),
        setIouFeedback: vi.fn(),
        canResetTable: true,
        canExitTable: true,
      },
    );
    expect(iouHandoffApi.createIouHandoff).toHaveBeenCalledTimes(1);
  });

  it('treats alreadySubmitted IOU response as non-fatal and continues new game', async () => {
    vi.mocked(iouHandoffApi.createIouHandoff).mockResolvedValueOnce({
      ok: true,
      iouId: 'iou-existing',
      status: 'pending',
      message: 'Already there',
      alreadySubmitted: true,
    });
    const beginNewGame = vi.fn();
    const result = await runGameOverCompleteAction(
      {
        saveLedger: false,
        createIou: true,
        nextAction: 'new-game',
      },
      {
        getState: () => endedChallengeState(),
        addToPersonalLedger: vi.fn(),
        beginNewGame,
        exitTable: vi.fn(),
        setIouFeedback: vi.fn(),
        canResetTable: true,
        canExitTable: true,
      },
    );
    expect(result).toBe('completed');
    expect(beginNewGame).toHaveBeenCalledTimes(1);
  });

  it('blocks new game when IOU create fails', async () => {
    vi.mocked(iouHandoffApi.createIouHandoff).mockResolvedValueOnce({
      ok: false,
      error: 'Handoff rejected',
    });
    const beginNewGame = vi.fn();
    const setIouFeedback = vi.fn();
    const result = await runGameOverCompleteAction(
      {
        saveLedger: false,
        createIou: true,
        nextAction: 'new-game',
      },
      {
        getState: () => endedChallengeState(),
        addToPersonalLedger: vi.fn(),
        beginNewGame,
        exitTable: vi.fn(),
        setIouFeedback,
        canResetTable: true,
        canExitTable: true,
      },
    );
    expect(result).toBe('blocked');
    expect(beginNewGame).not.toHaveBeenCalled();
    expect(setIouFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'error', message: 'Handoff rejected' }),
    );
  });

  it('starts new game without IOU after prior failure when IOU is unchecked', async () => {
    vi.mocked(iouHandoffApi.createIouHandoff)
      .mockResolvedValueOnce({ ok: false, error: 'Handoff rejected' });
    const beginNewGame = vi.fn();
    const handlers = {
      getState: () => endedChallengeState(),
      addToPersonalLedger: vi.fn(),
      beginNewGame,
      exitTable: vi.fn(),
      setIouFeedback: vi.fn(),
      canResetTable: true,
      canExitTable: true,
    };

    const blocked = await runGameOverCompleteAction(
      { saveLedger: false, createIou: true, nextAction: 'new-game' },
      handlers,
    );
    expect(blocked).toBe('blocked');
    expect(beginNewGame).not.toHaveBeenCalled();

    await runGameOverCompleteAction(
      { saveLedger: false, createIou: false, nextAction: 'new-game' },
      handlers,
    );
    expect(iouHandoffApi.createIouHandoff).toHaveBeenCalledTimes(1);
    expect(beginNewGame).toHaveBeenCalledTimes(1);
  });

  it('surfaces network-style IOU errors without starting new game', async () => {
    vi.mocked(iouHandoffApi.createIouHandoff).mockResolvedValueOnce({
      ok: false,
      error: 'IOU Wallet is unavailable. Try again later.',
    });
    const beginNewGame = vi.fn();
    const setIouFeedback = vi.fn();
    const result = await runGameOverCompleteAction(
      { saveLedger: false, createIou: true, nextAction: 'new-game' },
      {
        getState: () => endedChallengeState(),
        addToPersonalLedger: vi.fn(),
        beginNewGame,
        exitTable: vi.fn(),
        setIouFeedback,
        canResetTable: true,
        canExitTable: true,
      },
    );
    expect(result).toBe('blocked');
    expect(beginNewGame).not.toHaveBeenCalled();
    expect(setIouFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'error',
        message: 'IOU Wallet is unavailable. Try again later.',
      }),
    );
  });
});
