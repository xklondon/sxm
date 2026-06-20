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
