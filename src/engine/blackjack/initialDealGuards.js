import { handKeysWithConfirmedBets } from './helpers';
/** Every active bet box has at least two dealt cards. */
export function activeBetBoxesHaveTwoCards(session, round) {
    const handKeys = handKeysWithConfirmedBets(session, round);
    if (handKeys.length === 0) {
        return false;
    }
    for (const handKey of handKeys) {
        const hand = round.playerHands[handKey];
        if (!hand) {
            return false;
        }
        if (hand.cardIds.filter(Boolean).length < 2) {
            return false;
        }
    }
    return true;
}
/** Engine initial deal finished — not mid initial-deal, dealer has up + hole, boxes have two cards. */
export function isInitialDealRoundComplete(session, round) {
    if (round.status === 'initial-deal') {
        return false;
    }
    if (round.dealerCardIds.filter(Boolean).length < 2) {
        return false;
    }
    return activeBetBoxesHaveTwoCards(session, round);
}
/** True once any hand has a third+ card or has completed a player decision (stand/bust). */
export function hasPlayerActionsStarted(round) {
    for (const hand of Object.values(round.playerHands)) {
        if (!hand) {
            continue;
        }
        if (hand.cardIds.filter(Boolean).length > 2) {
            return true;
        }
        if (hand.actionStatus === 'stood' || hand.actionStatus === 'busted') {
            return true;
        }
    }
    return false;
}
/** Insurance may only open after the full initial deal, before the first player action. */
export function canOfferInsuranceAfterInitialDeal(session, round) {
    return (isInitialDealRoundComplete(session, round) &&
        !hasPlayerActionsStarted(round) &&
        round.status === 'player-turns');
}
