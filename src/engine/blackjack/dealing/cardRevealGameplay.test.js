import { describe, expect, it } from 'vitest';
import { hasPendingCardReveal, nextGameplayRevealStep, } from './cardRevealDisplay';
describe('gameplay card reveal steps', () => {
    it('reveals one player card at a time after initial deal', () => {
        const visible = { dealer: 2, hands: { 'p:0': 2 } };
        const target = { dealer: 2, hands: { 'p:0': 3 } };
        expect(hasPendingCardReveal(visible, target)).toBe(true);
        expect(nextGameplayRevealStep(visible, target)).toEqual({
            dealer: 2,
            hands: { 'p:0': 3 },
        });
    });
    it('reveals dealer cards before player cards when dealer pending', () => {
        const visible = { dealer: 1, hands: { 'p:0': 2 } };
        const target = { dealer: 2, hands: { 'p:0': 2 } };
        expect(nextGameplayRevealStep(visible, target)).toEqual({
            dealer: 2,
            hands: { 'p:0': 2 },
        });
    });
});
