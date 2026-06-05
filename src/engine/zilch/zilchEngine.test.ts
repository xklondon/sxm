import { describe, expect, it } from 'vitest';
import { DEFAULT_ZILCH_SETTINGS } from './settings';
import { resolveDiceAnimationDurationMs } from './settings';
import {
  bankTurn,
  completeDiceRoll,
  createInitialZilchState,
  endTurnWithZilch,
  keepCombination,
  randomiseStarter,
  rollDice,
  startTurn,
} from './zilchEngine';
import type { ZilchDie } from './zilchTypes';

const P1 = 'p1';
const P2 = 'p2';
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

function dice(values: number[]): ZilchDie[] {
  return values.map((value, idx) => ({
    id: `d${idx}`,
    value,
    isAvailable: true,
    isKept: false,
  }));
}

describe('zilchEngine', () => {
  it('turnover / Greater Glory clears kept dice for full re-roll', () => {
    let state = createInitialZilchState([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = {
      ...state,
      phase: 'awaiting-keep-selection',
      dice: dice([1, 1, 1, 5, 5, 5]),
      rollNumberInTurn: 1,
      availableCombinations: [
        {
          id: 'three-1s',
          label: 'Three 1s',
          diceIds: ['d0', 'd1', 'd2'],
          score: 10,
          type: 'three_of_a_kind',
        },
        {
          id: 'three-5s',
          label: 'Three 5s',
          diceIds: ['d3', 'd4', 'd5'],
          score: 5,
          type: 'three_of_a_kind',
        },
      ],
    };
    state = keepCombination(state, 'three-1s');
    const second = state.availableCombinations.find((c) => c.type === 'three_of_a_kind' && c.label.includes('5'));
    expect(second).toBeDefined();
    state = keepCombination(state, second!.id);
    expect(state.dice).toHaveLength(0);
    expect(state.keptDice).toHaveLength(0);
    expect(state.turnScore).toBe(15);
    expect(state.phase).toBe('player-turn');
  });

  it('zilch resets turn score only', () => {
    let state = createInitialZilchState([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = {
      ...state,
      totalScoresByPlayerId: { [P1]: 42 },
      turnScore: 7,
      phase: 'player-turn',
      dice: dice([2, 3, 4, 6, 2, 3]),
      availableCombinations: [],
    };
    state = endTurnWithZilch(state);
    expect(state.turnScore).toBe(0);
    expect(state.totalScoresByPlayerId[P1]).toBe(42);
  });

  it('target points final round after leader banks', () => {
    const settings = {
      ...DEFAULT_ZILCH_SETTINGS,
      mode: 'target_points' as const,
      targetPoints: 100,
    };
    let state = createInitialZilchState([P1, P2], settings);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, P1);
    state = {
      ...state,
      totalScoresByPlayerId: { [P1]: 95, [P2]: 50 },
      turnScore: 10,
      keptThisRoll: true,
    };
    state = bankTurn(state);
    expect(state.phase).toBe('final-round');
    expect(state.finalRoundStartedByPlayerId).toBe(P1);
    expect(state.playersRemainingFinalTurn).toEqual([P2]);
    expect(state.currentPlayerId).toBe(P2);
  });

  it('fixed rounds winner after round limit', () => {
    const settings = {
      ...DEFAULT_ZILCH_SETTINGS,
      mode: 'fixed_rounds' as const,
      roundLimit: 1,
    };
    let state = createInitialZilchState([P1, P2], settings);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, P1);
    state = {
      ...state,
      totalScoresByPlayerId: { [P1]: 20, [P2]: 30 },
      turnScore: 5,
      keptThisRoll: true,
    };
    state = bankTurn(state);
    state = startTurn(state, P2);
    state = { ...state, turnScore: 1, keptThisRoll: true };
    state = bankTurn(state);
    expect(state.phase).toBe('completed');
    expect(state.winnerPlayerId).toBe(P2);
  });

  it('dice animation duration fixed and random', () => {
    const fixed = resolveDiceAnimationDurationMs({
      diceAnimationMode: 'fixed',
      diceAnimationMs: 2500,
      diceAnimationRandomMinMs: 2000,
      diceAnimationRandomMaxMs: 8000,
    });
    expect(fixed).toBe(2500);

    const rng = seqRng([0, 0.5, 1]);
    const a = resolveDiceAnimationDurationMs(
      {
        diceAnimationMode: 'random',
        diceAnimationMs: 2500,
        diceAnimationRandomMinMs: 2000,
        diceAnimationRandomMaxMs: 8000,
      },
      rng,
    );
    const b = resolveDiceAnimationDurationMs(
      {
        diceAnimationMode: 'random',
        diceAnimationMs: 2500,
        diceAnimationRandomMinMs: 2000,
        diceAnimationRandomMaxMs: 8000,
      },
      rng,
    );
    expect(a).toBeGreaterThanOrEqual(2000);
    expect(a).toBeLessThanOrEqual(8000);
    expect(b).toBeGreaterThanOrEqual(2000);
    expect(b).toBeLessThanOrEqual(8000);
  });

  it('completeDiceRoll reveals zilch path', () => {
    let state = createInitialZilchState([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = rollDice(state, DEFAULT_ZILCH_SETTINGS, seqRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]), 1000);
    state = {
      ...state,
      diceAnimation: {
        isRolling: true,
        pendingValues: [2, 3, 4, 6, 2, 3],
      },
      dice: dice([1, 1, 1, 1, 1, 1]),
    };
    state = completeDiceRoll(state);
    expect(state.turnScore).toBe(0);
    expect(state.totalScoresByPlayerId[P1]).toBe(0);
  });
});
