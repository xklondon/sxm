/**
 * Canonical Zilch protocol — single source for scoring, selection, and keep validation.
 * Engine, UI, server reducer, and tests must use these helpers only.
 *
 * Display scale: single 1 = 100, single 5 = 50 (×100 from fractional rules).
 */
import type { ZilchCombination, ZilchDie, ZilchGameState } from './zilchTypes';
import {
  detectZilchCombinations,
  findCombinationForExactDiceIds,
  isDieScoringSelectable as rulesIsDieScoringSelectable,
  isZilchRoll,
  SINGLE_FIVE_SCORE,
  SINGLE_ONE_SCORE,
} from './zilchRules';

export {
  detectZilchCombinations,
  findCombinationForExactDiceIds,
  isZilchRoll,
  SINGLE_FIVE_SCORE,
  SINGLE_ONE_SCORE,
  STRAIGHT_SCORE,
  THREE_PAIRS_SCORE,
  threeOfAKindScore,
  fourOfAKindScore,
  fiveOfAKindScore,
  sixOfAKindScore,
} from './zilchRules';

/** Dice available on the current roll (not kept from prior rolls). */
export function currentRollDice(dice: ZilchDie[]): ZilchDie[] {
  return dice.filter((d) => d.isAvailable && !d.isKept);
}

/** Alias for protocol docs. */
export function detectZilch(dice: ZilchDie[]): boolean {
  return isZilchRoll(currentRollDice(dice));
}

export function getValidKeeps(dice: ZilchDie[]): ZilchCombination[] {
  return detectZilchCombinations(dice);
}

/** Dice the player may toggle during selection (scoring, unkept, current roll). */
export function getSelectableDice(dice: ZilchDie[], combinations: ZilchCombination[]): ZilchDie[] {
  return currentRollDice(dice).filter((die) => rulesIsDieScoringSelectable(die, combinations));
}

/** Canonical ids of dice the player may select on the current roll. */
export function getSelectableDiceIds(state: ZilchGameState): string[] {
  return getSelectableDice(state.dice, state.availableCombinations).map((die) => die.id);
}

function scoreSinglesCombination(selected: ZilchDie[]): ZilchCombination | null {
  if (selected.length === 0) {
    return null;
  }
  if (!selected.every((d) => d.value === 1 || d.value === 5)) {
    return null;
  }
  const score = selected.reduce(
    (sum, d) => sum + (d.value === 1 ? SINGLE_ONE_SCORE : SINGLE_FIVE_SCORE),
    0,
  );
  const diceIds = selected.map((d) => d.id);
  return {
    id: `singles-${[...diceIds].sort().join('-')}`,
    label:
      selected.length === 1
        ? selected[0]!.value === 1
          ? 'Single 1'
          : 'Single 5'
        : `${selected.length} scoring singles`,
    diceIds,
    score,
    type: selected.every((d) => d.value === 1) ? 'single_one' : 'single_five',
  };
}

/** Resolve a valid keep for the selected die ids (exact combo or multiple singles). */
export function resolveKeepForSelectedDice(
  dice: ZilchDie[],
  selectedDiceIds: string[],
): ZilchCombination | null {
  if (selectedDiceIds.length === 0) {
    return null;
  }
  const pool = currentRollDice(dice);
  const dieMap = new Map(pool.map((d) => [d.id, d]));
  const selected = selectedDiceIds.map((id) => dieMap.get(id)).filter((d): d is ZilchDie => Boolean(d));
  if (selected.length !== selectedDiceIds.length) {
    return null;
  }

  const combos = detectZilchCombinations(dice);
  const exact = findCombinationForExactDiceIds(combos, selectedDiceIds);
  if (exact) {
    return exact;
  }

  const singlesOnly = scoreSinglesCombination(selected);
  if (!singlesOnly) {
    return null;
  }
  const eachSelectable = selected.every((die) => rulesIsDieScoringSelectable(die, combos));
  return eachSelectable ? singlesOnly : null;
}

export function isValidKeep(dice: ZilchDie[], selectedDiceIds: string[]): boolean {
  return resolveKeepForSelectedDice(dice, selectedDiceIds) !== null;
}

export function scoreSelectedDice(dice: ZilchDie[], selectedDiceIds: string[]): number {
  return resolveKeepForSelectedDice(dice, selectedDiceIds)?.score ?? 0;
}
