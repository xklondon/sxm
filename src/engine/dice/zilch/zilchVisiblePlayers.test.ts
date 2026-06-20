import { describe, expect, it } from 'vitest';
import {
  applyZilchTableStakeSetup,
  createNewZilchTable,
  DEFAULT_TABLE_CHIPS,
} from '../../session';
import { getVisibleZilchPlayers } from './zilchVisiblePlayers';

describe('getVisibleZilchPlayers', () => {
  it('returns unique playable players without duplicates', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), practiceSetup(3));
    const visible = getVisibleZilchPlayers(state);
    const ids = visible.map((p) => p.playerId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(visible.length).toBe(3);
  });

  it('excludes bank bot from visible seats', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), {
      ...practiceSetup(1),
      tableMode: 'challenge',
      bankerMode: 'bot',
      virtualPlayerCount: 0,
    });
    const visible = getVisibleZilchPlayers(state);
    const bankId = state.session.bankPlayerId;
    expect(visible.every((p) => p.playerId !== bankId)).toBe(true);
  });
});

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
