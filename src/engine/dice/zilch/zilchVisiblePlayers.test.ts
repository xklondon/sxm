import { describe, expect, it } from 'vitest';
import {
  applyZilchTableStakeSetup,
  createNewZilchTable,
  DEFAULT_TABLE_CHIPS,
} from '../../session';
import { listPlayableZilchPlayerIds } from './zilchTurnAuthority';
import { getVisibleZilchPlayers } from './zilchVisiblePlayers';

describe('getVisibleZilchPlayers', () => {
  it('practice with 2 virtual players includes host plus virtuals without duplicates', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), practiceSetup(2));
    const visible = getVisibleZilchPlayers(state);
    const ids = visible.map((p) => p.playerId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(visible.length).toBe(3);

    const hostBox = visible.find((p) => !p.isVirtual);
    expect(hostBox).toBeTruthy();
    expect(hostBox!.name).toBe('Host');
    expect(hostBox!.boxLabel).toBe('Player 1');

    const virtualNames = visible.filter((p) => p.isVirtual).map((p) => p.name);
    expect(virtualNames).toEqual(['Virtual Player 2', 'Virtual Player 3']);
  });

  it('host box is first in playable order', () => {
    const state = applyZilchTableStakeSetup(createNewZilchTable(), practiceSetup(2));
    const playable = listPlayableZilchPlayerIds(state);
    const visible = getVisibleZilchPlayers(state);
    expect(playable[0]).toBe(visible.find((p) => !p.isVirtual)?.playerId);
  });

  it('challenge setup includes host person as playable Player 1', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), challengeSetup());
    const ownerId = state.tableMeta.ownerPersonId;
    expect(ownerId).toBeTruthy();
    const playable = listPlayableZilchPlayerIds(state);
    expect(playable).toHaveLength(1);
    expect(playable[0]).toBe(ownerId);
    const visible = getVisibleZilchPlayers(state);
    expect(visible).toHaveLength(1);
    expect(visible[0]!.name).toBe('xk');
    expect(visible[0]!.boxLabel).toBe('Player 1');
    expect(state.zilch?.phase).toBe('setup');
  });

  it('excludes bank bot and owner person shell duplicate in practice challenge-style bank', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), {
      ...practiceSetup(1),
      tableMode: 'challenge',
      bankerMode: 'bot',
      virtualPlayerCount: 0,
    });
    const visible = getVisibleZilchPlayers(state);
    const bankId = state.session.bankPlayerId;
    expect(visible.every((p) => p.playerId !== bankId)).toBe(true);
    expect(visible).toHaveLength(1);
    expect(visible[0]!.boxLabel).toBe('Player 1');
  });
});

function challengeSetup() {
  return {
    stakeDescription: 'Dinner',
    seatChips: DEFAULT_TABLE_CHIPS,
    bankChips: DEFAULT_TABLE_CHIPS,
    bankerMode: 'self' as const,
    bankerName: 'xk',
    controllerName: 'xk',
    controllerEmail: 'host@example.com',
    protocolId: 'zilch',
    naturalDealing: false,
    dealSpeedPreset: 'normal' as const,
    cardTimerPreset: 0 as const,
    bankDrawAuto: true,
    tableMode: 'challenge' as const,
    zilchMode: 'target_points' as const,
    targetPoints: 1000,
    roundLimit: 10,
    diceAnimationMode: 'fixed' as const,
    diceAnimationMs: 400,
    diceAnimationRandomMinMs: 400,
    diceAnimationRandomMaxMs: 400,
  };
}

function practiceSetup(virtualPlayerCount: number) {
  return {
    stakeDescription: 'Practice',
    seatChips: DEFAULT_TABLE_CHIPS,
    bankChips: DEFAULT_TABLE_CHIPS,
    bankerMode: 'bot' as const,
    bankerName: '',
    controllerName: 'Host',
    controllerEmail: '',
    protocolId: 'zilch',
    naturalDealing: false,
    dealSpeedPreset: 'normal' as const,
    cardTimerPreset: 0 as const,
    bankDrawAuto: true,
    tableMode: 'practice' as const,
    virtualPlayerCount,
    zilchMode: 'target_points' as const,
    targetPoints: 1000,
    roundLimit: 10,
    diceAnimationMode: 'fixed' as const,
    diceAnimationMs: 400,
    diceAnimationRandomMinMs: 400,
    diceAnimationRandomMaxMs: 400,
  };
}
