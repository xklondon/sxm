import { describe, expect, it } from 'vitest';
import {
  createNewZilchTable,
  applyZilchTableStakeSetup,
  DEFAULT_TABLE_CHIPS,
} from '../../session';
import { setTableOwner } from '../../session/invites';
import { applyZilchActionToState } from '../../zilch';
import {
  bankTurn,
  canRollDice,
  completeDiceRoll,
  createZilchGame,
  randomiseStarter,
  rollDice,
  startTurn,
  advanceAfterZilchReveal,
} from './zilchEngine';
import { DEFAULT_ZILCH_SETTINGS } from './settings';
import {
  listPlayableZilchPlayerIds,
} from './zilchTurnAuthority';
import type { ZilchTableStakeSetupInput } from '../../session/zilchTableSetup';
import type { ZilchDie } from './zilchTypes';

const practiceSetup: ZilchTableStakeSetupInput = {
  stakeDescription: 'Practice',
  seatChips: DEFAULT_TABLE_CHIPS,
  bankChips: DEFAULT_TABLE_CHIPS,
  bankerMode: 'bot',
  bankerName: '',
  controllerName: 'Host',
  controllerEmail: 'host@example.com',
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

function practiceTable() {
  let state = setTableOwner(createNewZilchTable(), 'Host', 'host@example.com');
  state = applyZilchTableStakeSetup(state, practiceSetup);
  return state;
}

function dice(values: number[]): ZilchDie[] {
  return values.map((value, idx) => ({
    id: `d${idx}`,
    value,
    isAvailable: true,
    isKept: false,
  }));
}

describe('Zilch turn advancement', () => {
  it('bankTurn advances from player 1 to player 2', () => {
    let state = createZilchGame(['p1', 'p2', 'p3'], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, 'p1');
    state = { ...state, turnScore: 300, keptThisRoll: true };
    state = bankTurn(state);
    expect(state.currentPlayerId).toBe('p2');
    expect(state.turnScore).toBe(0);
    expect(state.dice).toHaveLength(0);
    expect(state.keptDice).toHaveLength(0);
    expect(state.availableCombinations).toHaveLength(0);
    expect(state.phase).toBe('player-turn');
    expect(canRollDice(state)).toBe(true);
  });

  it('zilch roll enters reveal then advances to next player', () => {
    let state = createZilchGame(['p1', 'p2'], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, 'p1');
    state = rollDice(state, DEFAULT_ZILCH_SETTINGS, () => 0.1, 1000);
    state = completeDiceRoll({
      ...state,
      diceAnimation: { isRolling: true, pendingValues: [2, 3, 4, 6, 2, 3] },
      dice: dice([2, 3, 4, 6, 2, 3]),
    });
    expect(state.phase).toBe('zilch-reveal');
    expect(state.currentPlayerId).toBe('p1');
    expect(state.dice.length).toBeGreaterThan(0);
    state = advanceAfterZilchReveal(state, state.zilchRevealUntil ?? Date.now());
    expect(state.currentPlayerId).toBe('p2');
    expect(state.turnScore).toBe(0);
    expect(canRollDice(state)).toBe(true);
  });

  it('last player wraps to first', () => {
    let state = createZilchGame(['p1', 'p2'], DEFAULT_ZILCH_SETTINGS);
    state = startTurn(state, 'p2');
    state = { ...state, turnScore: 200, keptThisRoll: true };
    state = bankTurn(state);
    expect(state.currentPlayerId).toBe('p1');
    expect(state.currentRound).toBe(2);
  });

  it('practice table bank advances to next virtual player', () => {
    const base = practiceTable();
    let state = applyZilchActionToState(base, 'zilchRandomiseStarter', {});
    const firstId = state.zilch!.currentPlayerId!;
    const playable = listPlayableZilchPlayerIds(state);
    expect(playable.length).toBeGreaterThanOrEqual(2);
    expect(state.players[firstId]).toBeDefined();

    state = applyZilchActionToState(
      {
        ...state,
        zilch: {
          ...state.zilch!,
          turnScore: 50,
          keptThisRoll: true,
          phase: 'player-turn',
        },
      },
      'zilchBankTurn',
      {},
    );

    expect(state.zilch!.currentPlayerId).not.toBe(firstId);
    expect(listPlayableZilchPlayerIds(state)).toContain(state.zilch!.currentPlayerId!);
    expect(canRollDice(state.zilch!)).toBe(true);
  });

  it('playable list excludes bank-role players when bank exists', () => {
    const state = practiceTable();
    const playable = listPlayableZilchPlayerIds(state);
    for (const id of playable) {
      expect(state.players[id]?.role).not.toBe('bank');
    }
  });

  it('after bank next player can roll via action dispatch', () => {
    const base = practiceTable();
    let state = applyZilchActionToState(base, 'zilchRandomiseStarter', {});
    state = applyZilchActionToState(
      {
        ...state,
        zilch: { ...state.zilch!, turnScore: 50, keptThisRoll: true, phase: 'player-turn' },
      },
      'zilchBankTurn',
      {},
    );
    state = applyZilchActionToState(state, 'zilchRollDice', {});
    expect(state.zilch!.diceAnimation.isRolling).toBe(true);
  });

  it('final-round phase allows next player to roll', () => {
    const settings = { ...DEFAULT_ZILCH_SETTINGS, targetPoints: 100 };
    let state = createZilchGame(['p1', 'p2'], settings, { tableMode: 'challenge' });
    state = startTurn(state, 'p1');
    state = {
      ...state,
      totalScoresByPlayerId: { p1: 90, p2: 0 },
      turnScore: 20,
      keptThisRoll: true,
    };
    state = bankTurn(state);
    expect(state.phase).toBe('final-round');
    expect(state.currentPlayerId).toBe('p2');
    expect(canRollDice(state)).toBe(true);
  });
});
