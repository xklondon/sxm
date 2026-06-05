import { describe, expect, it } from 'vitest';
import { detectZilchCombinations, fourOfAKindScore, fiveOfAKindScore, isZilchRoll, threeOfAKindScore, } from './zilchScoring';
function dice(values) {
    return values.map((value, i) => ({
        id: `d${i}`,
        value,
        isAvailable: true,
        isKept: false,
    }));
}
describe('zilchScoring', () => {
    it('scores six of a kind', () => {
        const combos = detectZilchCombinations(dice([6, 6, 6, 6, 6, 6]));
        expect(combos.some((c) => c.type === 'six_of_a_kind' && c.score === 100)).toBe(true);
    });
    it('scores straight', () => {
        const combos = detectZilchCombinations(dice([1, 2, 3, 4, 5, 6]));
        expect(combos.find((c) => c.type === 'straight')?.score).toBe(30);
    });
    it('scores three pairs', () => {
        const combos = detectZilchCombinations(dice([2, 2, 4, 4, 6, 6]));
        expect(combos.find((c) => c.type === 'three_pairs')?.score).toBe(10);
    });
    it('scores three/four/five of a kind', () => {
        expect(threeOfAKindScore(1)).toBe(10);
        expect(threeOfAKindScore(2)).toBe(2);
        expect(fourOfAKindScore(3)).toBe(6);
        expect(fiveOfAKindScore(4)).toBe(16);
        const combos = detectZilchCombinations(dice([4, 4, 4, 4, 2, 3]));
        expect(combos.find((c) => c.type === 'four_of_a_kind')?.score).toBe(8);
        const five = detectZilchCombinations(dice([5, 5, 5, 5, 5, 1]));
        expect(five.find((c) => c.type === 'five_of_a_kind')?.score).toBe(20);
    });
    it('scores single 1s and 5s', () => {
        const combos = detectZilchCombinations(dice([1, 5, 2, 3, 4, 4]));
        expect(combos.filter((c) => c.type === 'single_one')).toHaveLength(1);
        expect(combos.find((c) => c.type === 'single_five')?.score).toBe(0.5);
    });
    it('detects zilch', () => {
        expect(isZilchRoll(dice([2, 3, 4, 6, 2, 3]))).toBe(true);
    });
    it('allows lower scoring option (single 1 vs three 1s)', () => {
        const combos = detectZilchCombinations(dice([1, 1, 1, 2, 3, 4]));
        const three = combos.find((c) => c.type === 'three_of_a_kind');
        const singles = combos.filter((c) => c.type === 'single_one');
        expect(three?.score).toBe(10);
        expect(singles).toHaveLength(3);
        expect(singles[0]?.score).toBe(1);
    });
});
