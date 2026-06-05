import { describe, expect, it } from 'vitest';
import { tableAfterStartPlaying, boxPlayerId, findCardId, actingRound } from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { addChipToBoxStake } from './stakes';
import { createBlackjackShoe, shuffleBlackjackShoe } from './shoe';
import { blackjackHandKey } from './handKeys';
import { cardsFromIds, getBlackjackHandValue } from './hand';
import { doubleDownBlackjackPlayer } from './round';
import { bankrollContextFromState } from '../session/bankroll';
import { getBlackjackProtocolForState } from './protocolState';
import { applyBlackjackActionToState } from './applyBlackjackAction';
import { doubleDownBlackjackOnState, hitBlackjackOnState, startBlackjackRound } from './gameState';
import { canDoubleBlackjackForState } from './validation';
import { applyCardVisibility, maxVisibilityForRound } from './dealing/cardRevealDisplay';
import { isNaturalInitialDeal } from './dealing/dealingModes';
const actor = { personId: 'host', payload: {}, resolveBankAuto: false };
function baseTable() {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1);
    state = addChipToBoxStake(state, boxId, 50);
    state = startBlackjackRound(state);
    const deck = shuffleBlackjackShoe(createBlackjackShoe(6), 'double-action-seed');
    return { ...state, deck };
}
function playerTurn(state, ranks, bet = 25) {
    const boxId = boxPlayerId(state, 1);
    const deck = state.deck;
    const handKey = blackjackHandKey(boxId, 0);
    const round = actingRound(state, boxId, [findCardId(deck, ranks[0]), findCardId(deck, ranks[1])], bet);
    return {
        handKey,
        state: {
            ...state,
            blackjack: {
                ...round,
                status: 'player-turns',
                activeHandKey: handKey,
                activePlayerId: boxId,
            },
        },
    };
}
describe('double down action', () => {
    it('double on two-card hard 9 deals exactly one card and stands', () => {
        const { state, handKey } = playerTurn(baseTable(), ['5', '4']);
        const hand = state.blackjack.playerHands[handKey];
        const beforeCards = hand.cardIds.filter(Boolean);
        expect(beforeCards).toHaveLength(2);
        expect(getBlackjackHandValue(cardsFromIds(state.deck, beforeCards)).value).toBe(9);
        expect(canDoubleBlackjackForState(state, handKey)).toBe(true);
        const betBefore = hand.currentBet;
        const result = doubleDownBlackjackPlayer(state.session, state.players, state.ledger, state.deck, state.blackjack, handKey, bankrollContextFromState(state), state.blackjackSettings, getBlackjackProtocolForState(state));
        const doubled = result.round.playerHands[handKey];
        expect(doubled.cardIds.filter(Boolean)).toHaveLength(3);
        expect(doubled.doubled).toBe(true);
        expect(doubled.currentBet).toBe(betBefore * 2);
        expect(doubled.actionStatus).toBe('stood');
        expect(result.round.activeHandKey).not.toBe(handKey);
    });
    it('rejects double after hit', () => {
        const { state, handKey } = playerTurn(baseTable(), ['5', '6']);
        const afterHit = hitBlackjackOnState(state, handKey);
        expect(canDoubleBlackjackForState(afterHit, handKey)).toBe(false);
    });
    it('online and offline double produce the same hand state', () => {
        const { state, handKey } = playerTurn(baseTable(), ['5', '4']);
        const offline = doubleDownBlackjackOnState(state, handKey);
        const online = applyBlackjackActionToState(state, 'double', actor);
        expect(online.blackjack.playerHands[handKey].cardIds).toEqual(offline.blackjack.playerHands[handKey].cardIds);
        expect(online.blackjack.playerHands[handKey].actionStatus).toBe(offline.blackjack.playerHands[handKey].actionStatus);
        expect(online.blackjack.playerHands[handKey].doubled).toBe(true);
    });
    it('natural dealing keeps full authoritative hand while masking display', () => {
        const { state, handKey } = playerTurn(baseTable(), ['5', '4']);
        const withNatural = {
            ...state,
            blackjackFlowSettings: {
                ...state.blackjackFlowSettings,
                initialDealMode: 'natural',
                dealSpeedPreset: 'fast',
            },
        };
        expect(isNaturalInitialDeal(withNatural.blackjackFlowSettings.initialDealMode)).toBe(true);
        const authoritative = doubleDownBlackjackOnState(withNatural, handKey);
        const target = maxVisibilityForRound(authoritative.blackjack);
        const masked = applyCardVisibility(authoritative, {
            ...target,
            hands: { [handKey]: 2 },
        });
        expect(masked.blackjack.playerHands[handKey].cardIds).toHaveLength(2);
        expect(authoritative.blackjack.playerHands[handKey].cardIds).toHaveLength(3);
    });
});
