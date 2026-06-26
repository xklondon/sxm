// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { applyHoldemTableStakeSetup, createNewHoldemTable, updatePokerBlindsOnState } from '../../../engine/session';
import * as sessionEngine from '../../../engine/session';
import { shuffleGameDeck } from '../../../engine/deck';
import { appendLedgerEntry } from '../../../engine/ledger';
import { applyHoldemChallengeEndToState } from '../../../engine/holdem/challengeWinner';
import { ensureHoldemChallengeParticipantSnapshot } from '../../../engine/holdem/challengeParticipants';
import type { GameState } from '../../../types';
import { PokerPanel } from './PokerPanel';
import * as pokerHoldemDispatch from '../state/pokerHoldemDispatch';
import { mapPokerTableViewModel } from '../state/mapPokerTableViewModel';

vi.mock('../../../storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Alex', email: 'alex@example.com' }),
}));

vi.mock('../hooks/usePokerTableChat', () => ({
  usePokerTableChat: () => ({
    messages: [{ id: '1', author: 'Alex', body: 'Hello', timestamp: Date.now() }],
    unreadCount: 0,
    sending: false,
    sendMessage: vi.fn(),
  }),
}));

function practiceTableWithDeck() {
  let state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
    stakeDescription: 'Practice',
    seatChips: 500,
    bankChips: 500,
    bankerMode: 'self',
    bankerName: 'Alex',
    controllerName: 'Alex',
    controllerEmail: 'alex@example.com',
    protocolId: 'texas-holdem',
    naturalDealing: false,
    dealSpeedPreset: 'normal',
    cardTimerPreset: 0,
    bankDrawAuto: true,
    tableMode: 'practice',
    smallBlind: 5,
    bigBlind: 10,
    virtualPlayerCount: 1,
  });
  state = shuffleGameDeck(state);
  for (const playerId of state.session.playerIds) {
    const result = appendLedgerEntry(state.session, state.ledger, {
      playerId,
      entryType: 'buy-in',
      amount: 500,
      description: 'Test buy-in',
      roundNumber: state.session.currentRound,
    });
    state = { ...state, session: result.session, ledger: result.ledger };
  }
  return state;
}

function challengeTableResolved(): GameState {
  let state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
    stakeDescription: '$100 dinner',
    seatChips: 500,
    bankChips: 500,
    bankerMode: 'self',
    bankerName: 'Alex',
    controllerName: 'Alex',
    controllerEmail: 'alex@example.com',
    protocolId: 'texas-holdem',
    naturalDealing: false,
    dealSpeedPreset: 'normal',
    cardTimerPreset: 0,
    bankDrawAuto: true,
    tableMode: 'challenge',
    smallBlind: 5,
    bigBlind: 10,
    totalChallengeValue: 100,
    currency: '$',
  });
  const hostId = state.session.playerIds[0]!;
  const result = appendLedgerEntry(state.session, state.ledger, {
    playerId: hostId,
    entryType: 'buy-in',
    amount: 900,
    description: 'Test buy-in',
    roundNumber: state.session.currentRound,
  });
  state = { ...state, session: result.session, ledger: result.ledger };
  const p0 = hostId;
  return {
    ...state,
    holdem: {
      status: 'resolved' as const,
      bettingStreet: 'preflop' as const,
      smallBlind: 5,
      bigBlind: 10,
      communityCardIds: [],
      pot: 0,
      currentBet: 0,
      dealerButtonPlayerId: p0,
      smallBlindPlayerId: p0,
      bigBlindPlayerId: p0,
      activePlayerId: null,
      playerStates: {},
      actionLog: [],
      winners: [p0],
      resultSummary: 'Alex wins the pot',
      lastRaiseSize: 10,
    },
  };
}

function activePreflopState(base: GameState): GameState {
  const p0 = base.session.playerIds[0]!;
  const p1 = base.session.playerIds[1] ?? p0;
  return {
    ...base,
    holdem: {
      status: 'preflop' as const,
      bettingStreet: 'preflop' as const,
      smallBlind: 5,
      bigBlind: 10,
      communityCardIds: [],
      pot: 15,
      currentBet: 10,
      dealerButtonPlayerId: p0,
      smallBlindPlayerId: p0,
      bigBlindPlayerId: p1,
      activePlayerId: p0,
      playerStates: {
        [p0]: {
          holeCardIds: ['c1', 'c2'],
          actionStatus: 'active',
          playerBetsThisStreet: 0,
          playerTotalCommitted: 0,
          hasActedThisStreet: false,
        },
        [p1]: {
          holeCardIds: ['c3', 'c4'],
          actionStatus: 'acted',
          playerBetsThisStreet: 10,
          playerTotalCommitted: 10,
          hasActedThisStreet: true,
        },
      },
      actionLog: [],
      winners: [],
      resultSummary: '',
      lastRaiseSize: 10,
    },
  };
}

describe('PokerPanel holdem dispatch', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('dispatches server table action when online', async () => {
    const state = practiceTableWithDeck();
    const onlineDispatch = vi.fn().mockResolvedValue({});
    render(
      <PokerPanel
        gameState={state}
        onGameStateChange={vi.fn()}
        onlineTableId="online-table-1"
        onlineDispatch={onlineDispatch}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Deal Cards/i }));
    await Promise.resolve();
    expect(onlineDispatch).toHaveBeenCalledWith(
      'startHoldemHand',
      expect.any(Object),
    );
  });

  it('offline path still uses local wrapper', () => {
    const state = practiceTableWithDeck();
    const onGameStateChange = vi.fn();
    const runSpy = vi.spyOn(pokerHoldemDispatch, 'runPokerHoldemAction').mockReturnValue({
      ok: true,
      state: { ...state, session: { ...state.session, currentRound: state.session.currentRound + 1 } },
    });

    render(<PokerPanel gameState={state} onGameStateChange={onGameStateChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Deal Cards/i }));

    expect(runSpy).toHaveBeenCalledWith(
      state,
      expect.objectContaining({ type: 'start-hand' }),
    );
    expect(onGameStateChange).toHaveBeenCalledTimes(1);
  });

  it('uses runPokerHoldemAction for fold offline', () => {
    const state = practiceTableWithDeck();
    const activeState = {
      ...state,
      holdem: {
        status: 'preflop' as const,
        bettingStreet: 'preflop' as const,
        smallBlind: 5,
        bigBlind: 10,
        communityCardIds: [],
        pot: 15,
        currentBet: 10,
        dealerButtonPlayerId: state.session.playerIds[0]!,
        smallBlindPlayerId: state.session.playerIds[0]!,
        bigBlindPlayerId: state.session.playerIds[1] ?? state.session.playerIds[0]!,
        activePlayerId: state.session.playerIds[0]!,
        playerStates: {},
        actionLog: [],
        winners: [],
        resultSummary: '',
        lastRaiseSize: 10,
      },
    };
    const onGameStateChange = vi.fn();
    const runSpy = vi.spyOn(pokerHoldemDispatch, 'runPokerHoldemAction').mockReturnValue({
      ok: true,
      state: activeState,
    });

    render(<PokerPanel gameState={activeState} onGameStateChange={onGameStateChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Fold$/i }));

    expect(runSpy).toHaveBeenCalledWith(
      activeState,
      expect.objectContaining({ type: 'fold' }),
    );
  });

  it('does not mutate state when wrapper returns failure', () => {
    const state = practiceTableWithDeck();
    const onGameStateChange = vi.fn();
    vi.spyOn(pokerHoldemDispatch, 'runPokerHoldemAction').mockReturnValue({
      ok: false,
      state,
      error: 'Hand already in progress',
    });

    render(<PokerPanel gameState={state} onGameStateChange={onGameStateChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Deal Cards/i }));

    expect(onGameStateChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Hand already in progress/i);
  });

  it('surfaces all-in server errors in panel error area', async () => {
    const state = activePreflopState(practiceTableWithDeck());
    const onlineDispatch = vi.fn().mockRejectedValue(new Error('Not your turn'));

    render(
      <PokerPanel
        gameState={state}
        onGameStateChange={vi.fn()}
        onlineTableId="online-table-1"
        onlineDispatch={onlineDispatch}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /All In/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/Not your turn/i);
    });
    expect(onlineDispatch).toHaveBeenCalledWith('holdemAllIn', {});
  });

  it('offline all-in uses local wrapper', () => {
    const state = activePreflopState(practiceTableWithDeck());
    const onGameStateChange = vi.fn();
    const runSpy = vi.spyOn(pokerHoldemDispatch, 'runPokerHoldemAction').mockReturnValue({
      ok: true,
      state: {
        ...state,
        holdem: state.holdem
          ? {
              ...state.holdem,
              playerStates: {
                ...state.holdem.playerStates,
                [state.session.playerIds[0]!]: {
                  ...state.holdem.playerStates[state.session.playerIds[0]!]!,
                  actionStatus: 'all-in' as const,
                },
              },
            }
          : null,
      },
    });

    render(<PokerPanel gameState={state} onGameStateChange={onGameStateChange} />);
    fireEvent.click(screen.getByRole('button', { name: /All In/i }));

    expect(runSpy).toHaveBeenCalledWith(
      state,
      expect.objectContaining({ type: 'all-in' }),
    );
    runSpy.mockRestore();
  });

  it('seat displays all-in status in view model', () => {
    const state = activePreflopState(practiceTableWithDeck());
    const playerId = state.session.playerIds[0]!;
    const withAllIn = {
      ...state,
      holdem: {
        ...state.holdem!,
        playerStates: {
          ...state.holdem!.playerStates,
          [playerId]: {
            ...state.holdem!.playerStates[playerId]!,
            actionStatus: 'all-in' as const,
          },
        },
      },
    };
    const vm = mapPokerTableViewModel(withAllIn, playerId);
    const seat = vm.seats.find((s) => s.playerId === playerId);
    expect(seat?.isAllIn).toBe(true);
    expect(seat?.actionStatus).toBe('all-in');
  });

  it('clears error after a successful action', () => {
    const state = practiceTableWithDeck();
    const onGameStateChange = vi.fn();
    const runSpy = vi
      .spyOn(pokerHoldemDispatch, 'runPokerHoldemAction')
      .mockReturnValueOnce({
        ok: false,
        state,
        error: 'Hand already in progress',
      })
      .mockReturnValueOnce({
        ok: true,
        state: { ...state, session: { ...state.session, currentRound: 2 } },
      });

    render(<PokerPanel gameState={state} onGameStateChange={onGameStateChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Deal Cards/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/Hand already in progress/i);

    fireEvent.click(screen.getByRole('button', { name: /Deal Cards/i }));
    expect(onGameStateChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    runSpy.mockRestore();
  });

  it('does not render permanent table chat rail — chat opens in This Table panel', () => {
    const state = practiceTableWithDeck();
    render(<PokerPanel gameState={state} onGameStateChange={() => {}} />);
    expect(screen.queryByTestId('poker-chat-dock')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'This Table' })[0]!);
    expect(screen.getByText('Chat')).toBeTruthy();
  });

  it('hides blind edit when hand is in progress', () => {
    const state = practiceTableWithDeck();
    const activeState = {
      ...state,
      holdem: {
        status: 'preflop' as const,
        bettingStreet: 'preflop' as const,
        smallBlind: 5,
        bigBlind: 10,
        communityCardIds: [],
        pot: 15,
        currentBet: 10,
        dealerButtonPlayerId: state.session.playerIds[0]!,
        smallBlindPlayerId: state.session.playerIds[0]!,
        bigBlindPlayerId: state.session.playerIds[1] ?? state.session.playerIds[0]!,
        activePlayerId: state.session.playerIds[0]!,
        playerStates: {},
        actionLog: [],
        winners: [],
        resultSummary: '',
        lastRaiseSize: 10,
      },
    };

    render(<PokerPanel gameState={activeState} onGameStateChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /Edit blinds/i })).toBeNull();
  });

  async function saveBlindsViaUi(smallBlind: string, bigBlind: string) {
    fireEvent.click(screen.getAllByRole('button', { name: 'This Table' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Edit blinds/i }));
    fireEvent.change(screen.getByLabelText(/Small blind/i), { target: { value: smallBlind } });
    fireEvent.change(screen.getByLabelText(/Big blind/i), { target: { value: bigBlind } });
    fireEvent.click(screen.getByRole('button', { name: /Save for next hand/i }));
    await Promise.resolve();
  }

  it('online dispatches updateHoldemBlinds instead of local mutation', async () => {
    const state = practiceTableWithDeck();
    const onlineDispatch = vi.fn().mockResolvedValue({});
    const onGameStateChange = vi.fn();
    const updateSpy = vi.spyOn(sessionEngine, 'updatePokerBlindsOnState');

    render(
      <PokerPanel
        gameState={state}
        onGameStateChange={onGameStateChange}
        onlineTableId="online-table-1"
        onlineDispatch={onlineDispatch}
      />,
    );

    await saveBlindsViaUi('10', '20');

    expect(onlineDispatch).toHaveBeenCalledWith('updateHoldemBlinds', {
      smallBlind: 10,
      bigBlind: 20,
    });
    expect(updateSpy).not.toHaveBeenCalled();
    expect(onGameStateChange).not.toHaveBeenCalled();
    updateSpy.mockRestore();
  });

  it('offline PokerPanel still uses local blind update', async () => {
    const state = practiceTableWithDeck();
    const onGameStateChange = vi.fn();
    const updateSpy = vi.spyOn(sessionEngine, 'updatePokerBlindsOnState').mockImplementation(
      (current, sb, bb) => ({
        ...current,
        tableMeta: {
          ...current.tableMeta,
          pokerConfig: {
            ...current.tableMeta.pokerConfig!,
            smallBlind: sb,
            bigBlind: bb,
          },
        },
      }),
    );

    render(<PokerPanel gameState={state} onGameStateChange={onGameStateChange} />);
    await saveBlindsViaUi('10', '20');

    expect(updateSpy).toHaveBeenCalledWith(state, 10, 20);
    expect(onGameStateChange).toHaveBeenCalledTimes(1);
    updateSpy.mockRestore();
  });

  it('UI reflects updated blinds after server state update', () => {
    const state = practiceTableWithDeck();
    const { rerender } = render(
      <PokerPanel
        gameState={state}
        onGameStateChange={() => {}}
        onlineTableId="online-table-1"
        onlineDispatch={vi.fn().mockResolvedValue({})}
      />,
    );

    expect(screen.getByTestId('poker-header-blinds')?.textContent).toMatch(/5\/10/);

    const updated = updatePokerBlindsOnState(state, 10, 20);
    rerender(
      <PokerPanel
        gameState={updated}
        onGameStateChange={() => {}}
        onlineTableId="online-table-1"
        onlineDispatch={vi.fn().mockResolvedValue({})}
      />,
    );

    expect(screen.getByTestId('poker-header-blinds')?.textContent).toMatch(/10\/20/);
  });

  it('surfaces server blind update errors in panel error area', async () => {
    const state = practiceTableWithDeck();
    const onlineDispatch = vi.fn().mockRejectedValue(new Error('Big blind must be greater than small blind'));

    render(
      <PokerPanel
        gameState={state}
        onGameStateChange={vi.fn()}
        onlineTableId="online-table-1"
        onlineDispatch={onlineDispatch}
      />,
    );

    await saveBlindsViaUi('10', '20');
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/Big blind must be greater/i);
    });
  });
});

describe('PokerPanel challenge winner UI', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('15. game-over overlay uses authoritative challenge winner', () => {
    const base = challengeTableResolved();
    const hostId = base.session.playerIds[0]!;
    const withGuest = ensureHoldemChallengeParticipantSnapshot({
      ...base,
      session: {
        ...base.session,
        playerIds: [hostId, 'guest'],
      },
      players: {
        ...base.players,
        guest: {
          id: 'guest',
          displayName: 'Guest',
          controllerName: 'Guest',
          playerType: 'real',
          role: 'person',
          cardIds: [],
          currentBet: 0,
          status: 'active',
          startingBalance: 500,
        },
      },
      tableMeta: {
        ...base.tableMeta,
        owner: {
          ownerName: 'Alex',
          ownerEmail: 'alex@example.com',
          createdAt: new Date().toISOString(),
        },
        setupInvitedEmails: ['guest@example.com'],
        invites: [
          {
            inviteId: 'inv-guest',
            tableId: base.session.id,
            invitedEmail: 'guest@example.com',
            invitedName: 'Guest',
            invitedBy: 'Alex',
            inviteStatus: 'pending',
            canInviteOthers: false,
            createdAt: new Date().toISOString(),
            token: 'guest',
          },
        ],
        pokerConfig: {
          ...base.tableMeta.pokerConfig!,
          challengeParticipants: undefined,
          challengeParticipantSeatIds: undefined,
          challengeParticipantPlayerIds: undefined,
        },
      },
    });
    const ended = applyHoldemChallengeEndToState(withGuest, {
      winnerSeatId: hostId,
      reason: 'chip-leader',
    });

    render(<PokerPanel gameState={ended} onGameStateChange={() => {}} />);

    expect(screen.getByRole('dialog', { name: /game over/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Challenge ended/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Send IOUs/i })).toBeTruthy();
  });

  it('16. Send IOUs blocked when challenge has no authoritative winner', async () => {
    const { sendPokerChallengeIous } = await import('../state/pokerGameOverFlow');
    const state = challengeTableResolved();
    const setFeedback = vi.fn();
    const ok = await sendPokerChallengeIous(state, null, setFeedback);
    expect(ok).toBe(false);
    expect(setFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'error' }),
    );
  });

  it('17. host sees End Challenge in This Table menu between hands', () => {
    const state = challengeTableResolved();
    render(<PokerPanel gameState={state} onGameStateChange={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'This Table' })[0]!);
    expect(screen.getByRole('button', { name: /End challenge/i })).toBeTruthy();
  });

  it('18. practice does not show End Challenge or Send IOUs', () => {
    const state = {
      ...practiceTableWithDeck(),
      holdem: {
        ...challengeTableResolved().holdem!,
      },
    };
    render(<PokerPanel gameState={state} onGameStateChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /End challenge/i })).toBeNull();
    expect(screen.queryByRole('dialog', { name: /game over/i })).toBeNull();
  });
});
