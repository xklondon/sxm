import type { ZilchCombination, ZilchDie } from './zilchTypes';

/** Low-level scoring primitives. Prefer `zilchProtocol.ts` for selection/keep validation. */

export const SINGLE_ONE_SCORE = 100;
export const SINGLE_FIVE_SCORE = 50;
export const STRAIGHT_SCORE = 2000;
export const THREE_PAIRS_SCORE = 1500;
export const TWO_TRIPLETS_SCORE = 2500;

const TRIPLE_FACE_SCORE: Record<number, number> = {
  1: 1000,
  2: 200,
  3: 300,
  4: 400,
  5: 500,
  6: 600,
};

export function threeOfAKindScore(face: number): number {
  return TRIPLE_FACE_SCORE[face] ?? face * 100;
}

function nOfAKindScore(face: number, count: number): number {
  if (count < 3) {
    return 0;
  }
  let score = threeOfAKindScore(face);
  for (let n = 4; n <= count; n++) {
    score *= 2;
  }
  return score;
}

export function fourOfAKindScore(face: number): number {
  return nOfAKindScore(face, 4);
}

export function fiveOfAKindScore(face: number): number {
  return nOfAKindScore(face, 5);
}

export function sixOfAKindScore(face: number): number {
  return nOfAKindScore(face, 6);
}

function countByValue(dice: ZilchDie[]): Map<number, ZilchDie[]> {
  const map = new Map<number, ZilchDie[]>();
  for (const die of dice) {
    if (!die.isAvailable || die.isKept) {
      continue;
    }
    const list = map.get(die.value) ?? [];
    list.push(die);
    map.set(die.value, list);
  }
  return map;
}

function detectSixOfAKind(pool: ZilchDie[]): ZilchCombination | null {
  const counts = countByValue(pool);
  for (const [value, group] of counts) {
    if (group.length === 6) {
      return {
        id: `six-${value}`,
        label: `Six ${value}s`,
        diceIds: group.map((d) => d.id),
        score: sixOfAKindScore(value),
        type: 'six_of_a_kind',
      };
    }
  }
  return null;
}

function detectStraight(pool: ZilchDie[]): ZilchCombination | null {
  const available = pool.filter((d) => d.isAvailable && !d.isKept);
  if (available.length !== 6) {
    return null;
  }
  const values = new Set(available.map((d) => d.value));
  if (values.size !== 6) {
    return null;
  }
  for (let v = 1; v <= 6; v++) {
    if (!values.has(v)) {
      return null;
    }
  }
  return {
    id: 'straight',
    label: 'Straight 1–6',
    diceIds: available.map((d) => d.id),
    score: STRAIGHT_SCORE,
    type: 'straight',
  };
}

function detectThreePairs(pool: ZilchDie[]): ZilchCombination | null {
  const available = pool.filter((d) => d.isAvailable && !d.isKept);
  if (available.length !== 6) {
    return null;
  }
  const counts = countByValue(pool);
  const pairs = [...counts.values()].filter((g) => g.length === 2);
  if (pairs.length !== 3) {
    return null;
  }
  return {
    id: 'three-pairs',
    label: 'Three pairs',
    diceIds: available.map((d) => d.id),
    score: THREE_PAIRS_SCORE,
    type: 'three_pairs',
  };
}

function detectTwoTriplets(pool: ZilchDie[]): ZilchCombination | null {
  const available = pool.filter((d) => d.isAvailable && !d.isKept);
  if (available.length !== 6) {
    return null;
  }
  const counts = countByValue(pool);
  const triples = [...counts.values()].filter((g) => g.length === 3);
  if (triples.length !== 2) {
    return null;
  }
  return {
    id: 'two-triplets',
    label: 'Two triplets',
    diceIds: available.map((d) => d.id),
    score: TWO_TRIPLETS_SCORE,
    type: 'two_triplets',
  };
}

function detectNOfAKind(
  pool: ZilchDie[],
  n: 3 | 4 | 5,
  type: ZilchCombination['type'],
  scoreFn: (face: number) => number,
): ZilchCombination[] {
  const out: ZilchCombination[] = [];
  const counts = countByValue(pool);
  for (const [value, group] of counts) {
    if (group.length >= n) {
      const picked = group.slice(0, n);
      out.push({
        id: `${type}-${value}-${picked.map((d) => d.id).join('-')}`,
        label: n === 3 ? `Three ${value}s` : n === 4 ? `Four ${value}s` : `Five ${value}s`,
        diceIds: picked.map((d) => d.id),
        score: scoreFn(value),
        type,
      });
    }
  }
  return out;
}

function detectSingles(pool: ZilchDie[]): ZilchCombination[] {
  const out: ZilchCombination[] = [];
  for (const die of pool) {
    if (!die.isAvailable || die.isKept) {
      continue;
    }
    if (die.value === 1) {
      out.push({
        id: `single-1-${die.id}`,
        label: 'Single 1',
        diceIds: [die.id],
        score: SINGLE_ONE_SCORE,
        type: 'single_one',
      });
    } else if (die.value === 5) {
      out.push({
        id: `single-5-${die.id}`,
        label: 'Single 5',
        diceIds: [die.id],
        score: SINGLE_FIVE_SCORE,
        type: 'single_five',
      });
    }
  }
  return out;
}

/** All scoring combinations available on the current dice pool. */
export function detectZilchCombinations(dice: ZilchDie[]): ZilchCombination[] {
  const pool = dice.filter((d) => d.isAvailable && !d.isKept);
  if (pool.length === 0) {
    return [];
  }

  const combos: ZilchCombination[] = [];

  const six = detectSixOfAKind(pool);
  if (six) {
    combos.push(six);
  }
  const straight = detectStraight(pool);
  if (straight) {
    combos.push(straight);
  }
  const threePairs = detectThreePairs(pool);
  if (threePairs) {
    combos.push(threePairs);
  }
  const twoTriplets = detectTwoTriplets(pool);
  if (twoTriplets) {
    combos.push(twoTriplets);
  }

  combos.push(...detectNOfAKind(pool, 5, 'five_of_a_kind', fiveOfAKindScore));
  combos.push(...detectNOfAKind(pool, 4, 'four_of_a_kind', fourOfAKindScore));
  combos.push(...detectNOfAKind(pool, 3, 'three_of_a_kind', threeOfAKindScore));
  combos.push(...detectSingles(pool));

  return combos;
}

export function isZilchRoll(dice: ZilchDie[]): boolean {
  return detectZilchCombinations(dice).length === 0;
}

/** Find an available combination that uses exactly these dice (order-independent). */
export function findCombinationForExactDiceIds(
  combinations: ZilchCombination[],
  diceIds: string[],
): ZilchCombination | undefined {
  if (diceIds.length === 0) {
    return undefined;
  }
  const key = [...diceIds].sort().join(',');
  return combinations.find((combo) => [...combo.diceIds].sort().join(',') === key);
}

/** True when a die is part of at least one currently available scoring combination. */
export function isDieScoringSelectable(die: ZilchDie, combinations: ZilchCombination[]): boolean {
  if (!die.isAvailable || die.isKept) {
    return false;
  }
  return combinations.some((combo) => combo.diceIds.includes(die.id));
}

/** Score a set of die values (for unit tests). */
export function scoreDieValues(values: number[]): number {
  const dice: ZilchDie[] = values.map((value, i) => ({
    id: `t${i}`,
    value,
    isAvailable: true,
    isKept: false,
  }));
  const combos = detectZilchCombinations(dice);
  if (combos.length === 0) {
    return 0;
  }
  return Math.max(...combos.map((c) => c.score));
}
