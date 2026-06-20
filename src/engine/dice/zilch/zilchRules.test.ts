import { describe, expect, it } from 'vitest';
import {
  detectZilchCombinations,
  fourOfAKindScore,
  fiveOfAKindScore,
  isZilchRoll,
  sixOfAKindScore,
  threeOfAKindScore,
  TWO_TRIPLETS_SCORE,
} from './zilchRules';
import type { ZilchDie } from './zilchTypes';

function dice(values: number[]): ZilchDie[] {
  return values.map((value, i) => ({
    id: `d${i}`,
    value,
    isAvailable: true,
    isKept: false,
  }));
}

describe('zilchRules', () => {
  it('scores single 1 and single 5', () => {
    const combos = detectZilchCombinations(dice([1, 5, 2, 3, 4, 4]));
    expect(combos.find((c) => c.type === 'single_one')?.score).toBe(100);
    expect(combos.find((c) => c.type === 'single_five')?.score).toBe(50);
  });

  it('scores triple values', () => {
    expect(threeOfAKindScore(1)).toBe(1000);
    expect(threeOfAKindScore(2)).toBe(200);
    expect(threeOfAKindScore(6)).toBe(600);
    const combos = detectZilchCombinations(dice([4, 4, 4, 2, 3, 1]));
    expect(combos.find((c) => c.type === 'three_of_a_kind')?.score).toBe(400);
  });

  it('doubles score for extra matching dice beyond three', () => {
    expect(fourOfAKindScore(2)).toBe(400);
    expect(fiveOfAKindScore(2)).toBe(800);
    expect(sixOfAKindScore(2)).toBe(1600);
    expect(fourOfAKindScore(1)).toBe(2000);
    expect(fiveOfAKindScore(1)).toBe(4000);
    expect(sixOfAKindScore(1)).toBe(8000);
    const four = detectZilchCombinations(dice([4, 4, 4, 4, 2, 3]));
    expect(four.find((c) => c.type === 'four_of_a_kind')?.score).toBe(800);
  });

  it('scores straight', () => {
    const combos = detectZilchCombinations(dice([1, 2, 3, 4, 5, 6]));
    expect(combos.find((c) => c.type === 'straight')?.score).toBe(2000);
  });

  it('scores three pairs', () => {
    const combos = detectZilchCombinations(dice([2, 2, 4, 4, 6, 6]));
    expect(combos.find((c) => c.type === 'three_pairs')?.score).toBe(1500);
  });

  it('scores two triplets', () => {
    const combos = detectZilchCombinations(dice([1, 1, 1, 2, 2, 2]));
    expect(combos.find((c) => c.type === 'two_triplets')?.score).toBe(TWO_TRIPLETS_SCORE);
  });

  it('detects zilch (no scoring roll)', () => {
    expect(isZilchRoll(dice([2, 3, 4, 6, 2, 3]))).toBe(true);
  });

  it('allows lower scoring option (single 1 vs three 1s)', () => {
    const combos = detectZilchCombinations(dice([1, 1, 1, 2, 3, 4]));
    const three = combos.find((c) => c.type === 'three_of_a_kind');
    const singles = combos.filter((c) => c.type === 'single_one');
    expect(three?.score).toBe(1000);
    expect(singles).toHaveLength(3);
    expect(singles[0]?.score).toBe(100);
  });
});
