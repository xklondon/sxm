// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useZilchTableFlow } from './useZilchTableFlow';
import {
  createNewZilchTable,
  applyZilchTableStakeSetup,
  DEFAULT_TABLE_CHIPS,
} from '../engine/session';
import { applyZilchActionToState } from '../engine/zilch';
import type { ZilchTableStakeSetupInput } from '../engine/session/zilchTableSetup';
import { setTableOwner } from '../engine/session/invites';

const zilchSetup: ZilchTableStakeSetupInput = {
  stakeDescription: 'Practice',
  seatChips: DEFAULT_TABLE_CHIPS,
  bankChips: DEFAULT_TABLE_CHIPS,
  bankerMode: 'bot',
  bankerName: '',
  controllerName: 'Host',
  controllerEmail: '',
  protocolId: 'zilch',
  naturalDealing: false,
  dealSpeedPreset: 'normal',
  cardTimerPreset: 0,
  bankDrawAuto: true,
  tableMode: 'practice',
  virtualPlayerCount: 2,
  zilchMode: 'target_points',
  targetPoints: 100,
  roundLimit: 10,
  diceAnimationMode: 'fixed',
  diceAnimationMs: 400,
  diceAnimationRandomMinMs: 400,
  diceAnimationRandomMaxMs: 400,
};

function readyTable() {
  let state = setTableOwner(createNewZilchTable(), 'Host', 'host@example.com');
  state = applyZilchTableStakeSetup(state, zilchSetup);
  state = applyZilchActionToState(state, 'zilchRandomiseStarter', {});
  return state;
}

describe('useZilchTableFlow action errors', () => {
  it('surfaces rejected roll without unhandled rejection', async () => {
    const gameState = readyTable();
    const onGameStateChange = vi.fn();
    const onlineDispatch = vi.fn().mockRejectedValue(new Error('Not your turn'));

    const { result } = renderHook(() =>
      useZilchTableFlow({ gameState, onGameStateChange, onlineDispatch }),
    );

    await act(async () => {
      result.current.handleRollDice();
    });

    await waitFor(() => {
      expect(result.current.actionError).toBe('Not your turn');
    });
    expect(onlineDispatch).toHaveBeenCalledWith('zilchRollDice', {});
  });
});

function zilchRevealTable() {
  const base = readyTable();
  let zilch = base.zilch!;
  zilch = {
    ...zilch,
    phase: 'zilch-reveal',
    currentPlayerId: zilch.starterPlayerId ?? zilch.players[0]?.playerId ?? null,
    zilchRevealUntil: Date.now() + 3000,
    turnScore: 0,
    dice: [{ id: 'd0', value: 2, isAvailable: true, isKept: false }],
    diceAnimation: { isRolling: false },
    availableCombinations: [],
  };
  return { ...base, zilch };
}

function rollingTable() {
  const base = readyTable();
  const zilch = base.zilch!;
  return {
    ...base,
    zilch: {
      ...zilch,
      diceAnimation: { isRolling: true, durationMs: 400, startedAt: Date.now() },
    },
  };
}

describe('useZilchTableFlow online roll completion gate', () => {
  it('acting client dispatches zilchCompleteRoll after the animation', async () => {
    vi.useFakeTimers();
    const gameState = rollingTable();
    const onlineDispatch = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useZilchTableFlow({
        gameState,
        onGameStateChange: vi.fn(),
        onlineDispatch,
        canRunZilchRevealTimer: true,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onlineDispatch).toHaveBeenCalledWith('zilchCompleteRoll', {});
    vi.useRealTimers();
  });

  it('non-acting client never dispatches zilchCompleteRoll', async () => {
    vi.useFakeTimers();
    const gameState = rollingTable();
    const onlineDispatch = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useZilchTableFlow({
        gameState,
        onGameStateChange: vi.fn(),
        onlineDispatch,
        canRunZilchRevealTimer: false,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(onlineDispatch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('offline still completes the roll locally regardless of the gate', async () => {
    vi.useFakeTimers();
    const gameState = rollingTable();
    const onGameStateChange = vi.fn();

    renderHook(() =>
      useZilchTableFlow({
        gameState,
        onGameStateChange,
        canRunZilchRevealTimer: false,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onGameStateChange).toHaveBeenCalledTimes(1);
    expect(onGameStateChange.mock.calls[0]![0].zilch?.diceAnimation.isRolling).toBe(false);
    vi.useRealTimers();
  });
});

describe('useZilchTableFlow zilch reveal timer', () => {
  it('auto-advances once after reveal window and cleans up on unmount', async () => {
    vi.useFakeTimers();
    const gameState = zilchRevealTable();
    const onGameStateChange = vi.fn();

    const { unmount } = renderHook(() =>
      useZilchTableFlow({
        gameState,
        onGameStateChange,
        canRunZilchRevealTimer: true,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    expect(onGameStateChange).toHaveBeenCalledTimes(1);
    expect(onGameStateChange.mock.calls[0]![0].zilch?.currentPlayerId).not.toBe(
      gameState.zilch?.currentPlayerId,
    );

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(onGameStateChange).toHaveBeenCalledTimes(1);

    unmount();
    vi.useRealTimers();
  });

  it('does not auto-advance when canRunZilchRevealTimer is false', async () => {
    vi.useFakeTimers();
    const gameState = zilchRevealTable();
    const onGameStateChange = vi.fn();

    renderHook(() =>
      useZilchTableFlow({
        gameState,
        onGameStateChange,
        canRunZilchRevealTimer: false,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(onGameStateChange).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
