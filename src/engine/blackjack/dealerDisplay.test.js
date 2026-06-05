import { describe, expect, it } from 'vitest';
import { completeStepwiseInitialDealIfNeeded, dealCardsButtonOnState, drawBankCardOnState, } from './gameState';
import { tableWithClaimedBox, boxPlayerId, findCardId } from './sanity/fixtures';
import { addChipToBoxStake } from './stakes';
import { claimBoxSlot } from '../session/boxOps';
import { shuffleToStartOnState } from './gameState';
import { getDealerAuthoritativeHand, getDealerDisplayHand } from './dealerDisplay';
import { getVisibleDealerCardIds } from './protocolState';
import { getBankFinalMessage } from './protocol';
import { applyCardVisibility, maxVisibilityForRound } from './dealing/cardRevealDisplay';
import { createBlackjackPlayerHand, createEmptyBlackjackRound } from '../../types/blackjack';
import { blackjackHandKey } from './handKeys';
function readyOneBox() {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1);
    state = addChipToBoxStake(state, boxId, 50);
    state = shuffleToStartOnState(state);
    return state;
}
describe('dealer display hand', () => {
    it('display card ids match visible dealer ids after initial deal', () => {
        let state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(readyOneBox()));
        const display = getDealerDisplayHand(state);
        expect(display).not.toBeNull();
        expect(display.cardIds).toEqual(getVisibleDealerCardIds(state));
        expect(display.cards.map((c) => c.id)).toEqual(display.cardIds);
    });
    it('displayed dealer total matches card values', () => {
        let state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(readyOneBox()));
        const display = getDealerDisplayHand(state);
        const ranks = display.cards.map((c) => c.rank).join(',');
        expect(display.value).toBeGreaterThanOrEqual(2);
        expect(display.value).toBeLessThanOrEqual(21);
        expect(`${display.value}`).toMatch(/^\d+$/);
        expect(ranks.length).toBeGreaterThan(0);
    });
    it('bank final message total matches authoritative dealer cards', () => {
        let state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(readyOneBox()));
        const deck = state.deck;
        state = {
            ...state,
            blackjack: {
                ...state.blackjack,
                status: 'bank-turn',
                activeHandKey: null,
                dealerCardIds: [findCardId(deck, 'A'), findCardId(deck, '7')],
                dealerHoleHidden: false,
            },
        };
        const auth = getDealerAuthoritativeHand(state);
        expect(auth.value).toBe(18);
        const msg = getBankFinalMessage(state);
        expect(msg).toContain('18');
    });
    it('masked reveal state keeps dealer ids aligned with visible count', () => {
        let state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(readyOneBox()));
        const target = maxVisibilityForRound(state.blackjack);
        const masked = applyCardVisibility(state, { ...target, dealer: 1 });
        const display = getDealerDisplayHand(masked);
        expect(display?.cardIds).toHaveLength(1);
        expect(masked.blackjack.dealerCardIds.filter(Boolean)).toHaveLength(1);
        expect(display?.cardIds[0]).toBe(masked.blackjack.dealerCardIds[0]);
    });
    it('after bank draw, display hand includes new card id at correct index', () => {
        let state = tableWithClaimedBox(1);
        state = claimBoxSlot(state, 2);
        const box1 = boxPlayerId(state, 1);
        const box2 = boxPlayerId(state, 2);
        state = addChipToBoxStake(state, box1, 50);
        state = addChipToBoxStake(state, box2, 50);
        state = shuffleToStartOnState(state);
        const deck = state.deck;
        const box1Key = blackjackHandKey(box1, 0);
        const box2Key = blackjackHandKey(box2, 0);
        state = {
            ...state,
            blackjack: {
                ...createEmptyBlackjackRound(),
                status: 'bank-turn',
                dealerCardIds: [findCardId(deck, '8'), findCardId(deck, '5')],
                dealerHoleHidden: false,
                activeHandKey: null,
                playerHands: {
                    [box1Key]: { ...createBlackjackPlayerHand(box1, 0), actionStatus: 'stood', currentBet: 50 },
                    [box2Key]: { ...createBlackjackPlayerHand(box2, 0), actionStatus: 'stood', currentBet: 50 },
                },
                insuranceOfferPending: false,
                evenMoneyOfferHandKey: null,
            },
        };
        const before = getDealerDisplayHand(state);
        state = drawBankCardOnState(state);
        const after = getDealerAuthoritativeHand(state);
        expect(after.cardIds.length).toBe(before.cardIds.length + 1);
        expect(after.cardIds.slice(0, before.cardIds.length)).toEqual(before.cardIds);
    });
});
