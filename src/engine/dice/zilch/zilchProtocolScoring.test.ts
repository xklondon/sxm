import { describe, expect, it } from 'vitest';
import { DEFAULT_ZILCH_SETTINGS } from './settings';
import {
  createZilchGame,
  holdScoringDice,
  randomiseStarter,
  resolveZilch,
  startTurn,
} from './zilchEngine';
import {
  detectZilchCombinations,
  fourOfAKindScore,
  fiveOfAKindScore,
  isZilchRoll,
  sixOfAKindScore,
  SINGLE_FIVE_SCORE,
  SINGLE_ONE_SCORE,
  STRAIGHT_SCORE,
  threeOfAKindScore,
  THREE_PAIRS_SCORE,
} from './zilchProtocol';
import { scoreDieValues } from './zilchRules';
import type { ZilchDie } from './zilchTypes';

function dice(values: number[]): ZilchDie[] {
  return values.map((value, i) => ({
    id: `d${i}`,
    value,
    isAvailable: true,
    isKept: false,
  }));
}

describe('Zilch protocol scoring', () => {
  it('scores single 1 at 100 and single 5 at 50 only', () => {
    expect(SINGLE_ONE_SCORE).toBe(100);
    expect(SINGLE_FIVE_SCORE).toBe(50);

    const combos = detectZilchCombinations(dice([1, 5, 2, 3, 4, 6]));
    expect(combos.find((c) => c.type === 'single_one')?.score).toBe(100);
    expect(combos.find((c) => c.type === 'single_five')?.score).toBe(50);
    expect(combos.filter((c) => c.type.startsWith('single_'))).toHaveLength(2);
  });

  it('scores other single dice at 0', () => {
    expect(scoreDieValues([2])).toBe(0);
    expect(scoreDieValues([3])).toBe(0);
    expect(scoreDieValues([4])).toBe(0);
    expect(scoreDieValues([6])).toBe(0);
    expect(isZilchRoll(dice([2, 3, 4, 6, 2, 3]))).toBe(true);
  });

  it('scores three of a kind per face value', () => {
    expect(threeOfAKindScore(1)).toBe(1000);
    expect(threeOfAKindScore(2)).toBe(200);
    expect(threeOfAKindScore(3)).toBe(300);
    expect(threeOfAKindScore(4)).toBe(400);
    expect(threeOfAKindScore(5)).toBe(500);
    expect(threeOfAKindScore(6)).toBe(600);
  });

  it('doubles n-of-a-kind score for four, five, and six matching dice', () => {
    expect(fourOfAKindScore(2)).toBe(400);
    expect(fiveOfAKindScore(2)).toBe(800);
    expect(sixOfAKindScore(2)).toBe(1600);
  });

  it('scores three pairs at 1500', () => {
    expect(THREE_PAIRS_SCORE).toBe(1500);
    const combos = detectZilchCombinations(dice([2, 2, 4, 4, 6, 6]));
    expect(combos.find((c) => c.type === 'three_pairs')?.score).toBe(1500);
  });

  it('scores straight 1–6 at 2000', () => {
    expect(STRAIGHT_SCORE).toBe(2000);
    const combos = detectZilchCombinations(dice([1, 2, 3, 4, 5, 6]));
    expect(combos.find((c) => c.type === 'straight')?.score).toBe(2000);
  });

  it('detects combinations only from available unkept dice on the current roll', () => {
    const keptFromPriorRoll: ZilchDie = {
      id: 'kept-1',
      value: 1,
      isAvailable: false,
      isKept: true,
    };
    const freshRoll = dice([1, 1, 1, 2, 3, 4]);
    const pool = [keptFromPriorRoll, ...freshRoll];
    const combos = detectZilchCombinations(pool);
    const triple = combos.find((c) => c.type === 'three_of_a_kind');
    expect(triple?.diceIds).toHaveLength(3);
    expect(triple?.diceIds.includes('kept-1')).toBe(false);
  });
});

describe('Zilch protocol play rules', () => {
  it('free roll clears dice when all six are scored in one turn segment', () => {
    let state = createZilchGame(['p1'], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = {
      ...state,
      phase: 'awaiting-keep-selection',
      dice: dice([1, 1, 1, 5, 5, 5]),
      rollNumberInTurn: 1,
      availableCombinations: detectZilchCombinations(dice([1, 1, 1, 5, 5, 5])),
    };
    state = holdScoringDice(state, state.availableCombinations.find((c) => c.label.includes('Three 1'))!.id);
    state = holdScoringDice(state, state.availableCombinations.find((c) => c.label.includes('Three 5'))!.id);
    expect(state.dice).toHaveLength(0);
    expect(state.turnScore).toBe(1500);
    expect(state.keptThisRoll).toBe(true);
  });

  it('zilch loses accumulated turn points only', () => {
    let state = createZilchGame(['p1'], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, 'p1');
    state = {
      ...state,
      totalScoresByPlayerId: { p1: 900 },
      turnScore: 400,
      phase: 'player-turn',
      dice: dice([2, 3, 4, 6, 2, 3]),
      availableCombinations: [],
    };
    state = resolveZilch(state);
    expect(state.turnScore).toBe(0);
    expect(state.totalScoresByPlayerId.p1).toBe(900);
  });
});
