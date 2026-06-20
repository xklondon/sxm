import { describe, expect, it } from 'vitest';
import { DEFAULT_ZILCH_SETTINGS } from './settings';
import {
  bankTurn,
  canBank,
  canKeepCombination,
  canRollDice,
  completeDiceRoll,
  createZilchGame,
  holdScoringDice,
  randomiseStarter,
  rollDice,
  startTurn,
} from './zilchEngine';
import { detectZilchCombinations, isDieScoringSelectable } from './zilchRules';
import {
  canKeepSelectedDice,
  isTurnoverRoll,
  mustKeepBeforeRoll,
} from './zilchSelectors';
import type { ZilchDie } from './zilchTypes';

const P1 = 'p1';

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

function dice(values: number[], prefix = 'd'): ZilchDie[] {
  return values.map((value, idx) => ({
    id: `${prefix}${idx}`,
    value,
    isAvailable: true,
    isKept: false,
  }));
}

function rollAndReveal(
  state: ReturnType<typeof createZilchGame>,
  values: number[],
) {
  let next = rollDice(state, DEFAULT_ZILCH_SETTINGS, seqRng(values.map((v) => (v - 1) / 6)), 1000);
  next = {
    ...next,
    diceAnimation: {
      isRolling: true,
      pendingValues: values,
    },
    dice: next.dice.length > 0 ? next.dice : dice(values),
  };
  return completeDiceRoll(next);
}

describe('Zilch keep/roll flow', () => {
  it('after first roll with a single 1, keeping it leaves 5 dice available', () => {
    let state = createZilchGame([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = rollAndReveal(state, [1, 2, 3, 4, 5, 6]);
    expect(state.phase).toBe('awaiting-keep-selection');
    expect(mustKeepBeforeRoll(state)).toBe(true);
    expect(canRollDice(state)).toBe(false);

    const singleOne = state.availableCombinations.find((c) => c.type === 'single_one');
    expect(singleOne).toBeDefined();
    expect(canKeepSelectedDice(state, singleOne!.diceIds)).toBe(true);

    state = holdScoringDice(state, singleOne!.id);
    expect(state.turnScore).toBe(100);
    expect(state.keptThisRoll).toBe(true);
    expect(state.dice.filter((d) => !d.isKept)).toHaveLength(5);
    expect(state.keptDice).toHaveLength(1);
    expect(canRollDice(state)).toBe(true);
    expect(canBank(state)).toBe(true);
  });

  it('next roll rolls only remaining unkept dice', () => {
    let state = createZilchGame([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = rollAndReveal(state, [1, 2, 3, 4, 5, 6]);
    const singleOne = state.availableCombinations.find((c) => c.type === 'single_one')!;
    state = holdScoringDice(state, singleOne.id);
    const keptId = state.dice.find((d) => d.isKept)!.id;

    state = rollDice(state, DEFAULT_ZILCH_SETTINGS, seqRng([0.1, 0.2, 0.3, 0.4, 0.5]), 2000);
    expect(state.diceAnimation.pendingValues).toHaveLength(5);
    state = completeDiceRoll({
      ...state,
      diceAnimation: { isRolling: true, pendingValues: [5, 5, 5, 2, 3] },
    });
    expect(state.dice.find((d) => d.id === keptId)?.value).toBe(1);
    expect(state.dice.filter((d) => !d.isKept)).toHaveLength(5);
    expect(detectZilchCombinations(state.dice).every((c) => !c.diceIds.includes(keptId))).toBe(true);
  });

  it('turnScore accumulates across keeps in the same turn', () => {
    let state = createZilchGame([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = rollAndReveal(state, [1, 5, 2, 3, 4, 6]);
    const one = state.availableCombinations.find((c) => c.type === 'single_one')!;
    const five = state.availableCombinations.find((c) => c.type === 'single_five')!;
    state = holdScoringDice(state, one.id);
    expect(state.turnScore).toBe(100);
    expect(canKeepCombination(state)).toBe(true);
    state = holdScoringDice(state, five!.id);
    expect(state.turnScore).toBe(150);
  });

  it('cannot roll again before keeping scoring dice', () => {
    let state = createZilchGame([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = rollAndReveal(state, [1, 2, 3, 4, 5, 6]);
    expect(canRollDice(state)).toBe(false);
    expect(mustKeepBeforeRoll(state)).toBe(true);
  });

  it('cannot keep non-scoring dice selection', () => {
    let state = createZilchGame([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = rollAndReveal(state, [1, 2, 3, 4, 6, 2]);
    const nonScoring = state.dice.find((d) => d.value === 2)!;
    expect(isDieScoringSelectable(nonScoring, state.availableCombinations)).toBe(false);
    expect(canKeepSelectedDice(state, [nonScoring.id])).toBe(false);
  });

  it('turnover after all 6 dice kept allows rolling all 6 again', () => {
    let state = createZilchGame([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = {
      ...state,
      phase: 'awaiting-keep-selection',
      dice: dice([1, 1, 1, 5, 5, 5]),
      rollNumberInTurn: 1,
      availableCombinations: detectZilchCombinations(dice([1, 1, 1, 5, 5, 5])),
    };
    state = holdScoringDice(state, state.availableCombinations.find((c) => c.label.includes('Three 1'))!.id);
    const second = state.availableCombinations.find((c) => c.label.includes('Three 5'))!;
    state = holdScoringDice(state, second.id);
    expect(isTurnoverRoll(state)).toBe(true);
    expect(state.turnScore).toBe(1500);
    state = rollDice(state, DEFAULT_ZILCH_SETTINGS, seqRng([0, 0.1, 0.2, 0.3, 0.4, 0.5]), 3000);
    expect(state.dice).toHaveLength(6);
    expect(state.diceAnimation.pendingValues).toHaveLength(6);
  });

  it('previous kept dice cannot combine with new roll dice', () => {
    let state = createZilchGame([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = rollAndReveal(state, [1, 2, 3, 4, 5, 6]);
    const singleOne = state.availableCombinations.find((c) => c.type === 'single_one')!;
    state = holdScoringDice(state, singleOne.id);
    const keptId = state.dice.find((d) => d.isKept)!.id;

    state = rollDice(state, DEFAULT_ZILCH_SETTINGS, () => 0, 4000);
    state = completeDiceRoll({
      ...state,
      diceAnimation: { isRolling: true, pendingValues: [1, 1, 1, 2, 3, 4] },
    });
    const triple = state.availableCombinations.find((c) => c.type === 'three_of_a_kind');
    expect(triple?.diceIds.includes(keptId)).toBe(false);
    expect(triple?.diceIds).toHaveLength(3);
  });

  it('zilch after a later roll resets turnScore to 0 and advances turn', () => {
    let state = createZilchGame([P1, 'p2'], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = rollAndReveal(state, [1, 2, 3, 4, 5, 6]);
    state = holdScoringDice(state, state.availableCombinations.find((c) => c.type === 'single_one')!.id);
    expect(state.turnScore).toBe(100);

    state = rollDice(state, DEFAULT_ZILCH_SETTINGS, () => 0, 5000);
    state = completeDiceRoll({
      ...state,
      diceAnimation: { isRolling: true, pendingValues: [2, 3, 4, 6, 2] },
    });
    expect(state.turnScore).toBe(0);
    expect(state.currentPlayerId).toBe('p2');
    expect(state.history.some((event) => event.type === 'zilch' && event.playerId === P1)).toBe(true);
  });

  it('banking requires at least one keep this roll cycle', () => {
    let state = createZilchGame([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, P1);
    state = { ...state, turnScore: 500, keptThisRoll: false };
    expect(() => bankTurn(state)).toThrow(/Must keep/);
  });
});
