import { cardsFromIds, getBlackjackHandValue } from './hand';
import { getVisibleDealerCardIds } from './protocolState';
/** Single source for dealer cards shown in UI and derived totals. */
export function getDealerDisplayHand(state) {
    const round = state.blackjack;
    const deck = state.deck;
    if (!round || !deck) {
        return null;
    }
    const cardIds = getVisibleDealerCardIds(state);
    if (cardIds.length === 0) {
        return null;
    }
    const cards = cardsFromIds(deck, cardIds);
    const { value, isSoft, isBlackjack } = getBlackjackHandValue(cards);
    return { cardIds, cards, value, isSoft, isBlackjack };
}
/** Authoritative dealer hand for settlement / bank-final messages (all dealt cards). */
export function getDealerAuthoritativeHand(state) {
    const round = state.blackjack;
    const deck = state.deck;
    if (!round || !deck) {
        return null;
    }
    const cardIds = round.dealerCardIds.filter(Boolean);
    if (cardIds.length === 0) {
        return null;
    }
    const cards = cardsFromIds(deck, cardIds);
    const { value, isSoft, isBlackjack } = getBlackjackHandValue(cards);
    return { cardIds, cards, value, isSoft, isBlackjack };
}
