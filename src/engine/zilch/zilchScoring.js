const THREE_OF_KIND_SCORE = {
    1: 10,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
};
export function threeOfAKindScore(face) {
    return THREE_OF_KIND_SCORE[face] ?? 0;
}
export function fourOfAKindScore(face) {
    return 2 * threeOfAKindScore(face);
}
export function fiveOfAKindScore(face) {
    return 2 * fourOfAKindScore(face);
}
function availableDice(dice) {
    return dice.filter((d) => d.isAvailable && !d.isKept);
}
function diceByFace(dice) {
    const map = new Map();
    for (const die of dice) {
        const list = map.get(die.value) ?? [];
        list.push(die);
        map.set(die.value, list);
    }
    return map;
}
function makeCombination(type, label, diceIds, score, suffix) {
    return {
        id: `${type}-${suffix}-${diceIds.join('_')}`,
        label,
        diceIds,
        score,
        type,
    };
}
/** All valid scoring options on currently available (unkept) dice from this roll. */
export function detectZilchCombinations(dice) {
    const pool = availableDice(dice);
    if (pool.length === 0) {
        return [];
    }
    const combinations = [];
    const byFace = diceByFace(pool);
    const values = pool.map((d) => d.value);
    if (pool.length === 6) {
        const sorted = [...values].sort((a, b) => a - b);
        const isStraight = sorted[0] === 1 &&
            sorted[1] === 2 &&
            sorted[2] === 3 &&
            sorted[3] === 4 &&
            sorted[4] === 5 &&
            sorted[5] === 6;
        if (isStraight) {
            combinations.push(makeCombination('straight', 'Straight 1–6', pool.map((d) => d.id), 30, 'straight'));
        }
        const pairFaces = [...byFace.entries()].filter(([, list]) => list.length === 2);
        if (pairFaces.length === 3) {
            combinations.push(makeCombination('three_pairs', 'Three pairs', pool.map((d) => d.id), 10, 'three-pairs'));
        }
        for (const [face, list] of byFace.entries()) {
            if (list.length === 6) {
                combinations.push(makeCombination('six_of_a_kind', `Six ${face}s`, list.map((d) => d.id), 100, `six-${face}`));
            }
        }
    }
    for (const [face, list] of byFace.entries()) {
        const count = list.length;
        if (count === 6) {
            continue;
        }
        if (count >= 5) {
            combinations.push(makeCombination('five_of_a_kind', `Five ${face}s`, list.slice(0, 5).map((d) => d.id), fiveOfAKindScore(face), `five-${face}`));
        }
        if (count >= 4) {
            combinations.push(makeCombination('four_of_a_kind', `Four ${face}s`, list.slice(0, 4).map((d) => d.id), fourOfAKindScore(face), `four-${face}`));
        }
        if (count >= 3) {
            combinations.push(makeCombination('three_of_a_kind', `Three ${face}s`, list.slice(0, 3).map((d) => d.id), threeOfAKindScore(face), `three-${face}`));
        }
    }
    for (const die of pool) {
        if (die.value === 1) {
            combinations.push(makeCombination('single_one', 'Single 1', [die.id], 1, die.id));
        }
        if (die.value === 5) {
            combinations.push(makeCombination('single_five', 'Single 5', [die.id], 0.5, die.id));
        }
    }
    return combinations;
}
export function isZilchRoll(dice) {
    return detectZilchCombinations(dice).length === 0;
}
