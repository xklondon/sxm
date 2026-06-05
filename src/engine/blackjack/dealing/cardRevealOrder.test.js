import { describe, expect, it } from 'vitest';
import { applyRevealStep, buildInitialRevealSteps, nextGameplayRevealStep, shouldUseOrderedInitialReveal, } from './cardRevealDisplay';
import { buildInitialDealPlanFromHandKeys } from '../initialDeal';
import { tableAfterStartPlaying, boxPlayerId } from '../sanity/fixtures';
import { claimBoxSlot } from '../../session/boxOps';
import { addChipToBoxStake } from '../stakes';
import { blackjackHandKey } from '../handKeys';
import { completeStepwiseInitialDealIfNeeded, dealCardsButtonOnState, shuffleToStartOnState, } from '../gameState';
import { createBlackjackShoe, shuffleBlackjackShoe } from '../shoe';
function simulateOrderedReveal(round, roundStatus) {
    const target = {
        dealer: round.dealerCardIds.filter(Boolean).length,
        hands: Object.fromEntries(Object.entries(round.playerHands).map(([k, h]) => [
            k,
            h.cardIds.filter(Boolean).length,
        ])),
    };
    let visible = { dealer: 0, hands: {} };
    const labels = [];
    const steps = buildInitialRevealSteps(round);
    let guard = 0;
    while (guard < 30 &&
        shouldUseOrderedInitialReveal(roundStatus, visible, target)) {
        guard += 1;
        let nextVisible = null;
        for (const step of steps) {
            const after = applyRevealStep(visible, step);
            const changed = after.dealer !== visible.dealer ||
                Object.keys(after.hands).some((k) => (after.hands[k] ?? 0) !== (visible.hands[k] ?? 0));
            if (changed) {
                nextVisible = after;
                labels.push(step.type === 'dealer' ? `D${step.cardIndex}` : `${step.handKey}:${step.cardIndex}`);
                break;
            }
        }
        if (!nextVisible) {
            break;
        }
        visible = nextVisible;
    }
    return labels;
}
describe('natural reveal order', () => {
    it('does not reveal dealer cards before box cards when one card remains', () => {
        const visible = { dealer: 1, hands: { 'p:0': 2, 'p2:0': 2 } };
        const target = { dealer: 2, hands: { 'p:0': 2, 'p2:0': 2 } };
        expect(shouldUseOrderedInitialReveal('player-turns', visible, target)).toBe(true);
        const gameplay = nextGameplayRevealStep(visible, target);
        expect(gameplay?.dealer).toBe(2);
        expect(gameplay?.hands['p:0']).toBe(2);
    });
    it('three-box deal reveal matches engine plan labels', () => {
        let state = tableAfterStartPlaying(500);
        for (const slot of [1, 3, 4]) {
            state = claimBoxSlot(state, slot);
        }
        const personId = state.tableMeta.ownerPersonId;
        for (const slot of [1, 3, 4]) {
            state = addChipToBoxStake(state, boxPlayerId(state, slot), 50, personId);
        }
        state = shuffleToStartOnState(state);
        state = {
            ...state,
            deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'reveal-3box'),
            tableMeta: { ...state.tableMeta, bettingLocked: true },
            blackjackFlowSettings: { ...state.blackjackFlowSettings, initialDealMode: 'natural' },
        };
        state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
        const round = state.blackjack;
        const handKeys = Object.keys(round.playerHands).filter((k) => round.playerHands[k]?.currentBet);
        const engineLabels = buildInitialDealPlanFromHandKeys(handKeys).map((s) => s.type === 'dealer' ? `D${s.cardIndex}` : `${s.handKey}:${s.cardIndex}`);
        const revealLabels = simulateOrderedReveal(round, 'player-turns');
        expect(revealLabels).toEqual(engineLabels);
        const firstDealer = revealLabels.findIndex((l) => l.startsWith('D'));
        expect(revealLabels.slice(0, firstDealer).every((l) => l.endsWith(':0'))).toBe(true);
    });
    it('one-box reveal: box1, dealer up, box2, dealer hole', () => {
        let state = tableAfterStartPlaying(500);
        state = claimBoxSlot(state, 1);
        const boxId = boxPlayerId(state, 1);
        state = addChipToBoxStake(state, boxId, 50);
        state = shuffleToStartOnState(state);
        state = {
            ...state,
            deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'reveal-1box'),
            tableMeta: { ...state.tableMeta, bettingLocked: true },
        };
        state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
        const round = state.blackjack;
        const handKey = blackjackHandKey(boxId, 0);
        const labels = simulateOrderedReveal(round, 'player-turns');
        expect(labels).toEqual([`${handKey}:0`, 'D0', `${handKey}:1`, 'D1']);
    });
});
