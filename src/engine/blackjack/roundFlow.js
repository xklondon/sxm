import { orderedHandKeys, syncActivePlayerId } from './helpers';
import { findNextActingHand } from './virtual';
export const ALL_PLAYERS_BUST_MESSAGE = 'All players busted — bank wins this round.';
/** Hand still needs dealer comparison (stood / pending natural). */
export function handNeedsDealerComparison(hand) {
    if (!hand || hand.currentBet <= 0) {
        return false;
    }
    if (hand.bustSettled || hand.naturalSettled) {
        return false;
    }
    if (hand.actionStatus === 'busted' || hand.actionStatus === 'done') {
        return false;
    }
    if (hand.actionStatus === 'blackjack') {
        return true;
    }
    return hand.actionStatus === 'stood';
}
export function hasHandsNeedingDealerComparison(session, round) {
    for (const handKey of orderedHandKeys(session, round)) {
        const hand = round.playerHands[handKey];
        if (handNeedsDealerComparison(hand)) {
            return true;
        }
    }
    return false;
}
export function allPlayerHandsEliminated(session, round) {
    const keys = orderedHandKeys(session, round).filter((key) => {
        const hand = round.playerHands[key];
        return hand && hand.currentBet > 0;
    });
    if (keys.length === 0) {
        return false;
    }
    return keys.every((key) => {
        const hand = round.playerHands[key];
        if (hand.bustSettled || hand.actionStatus === 'busted') {
            return true;
        }
        if (hand.naturalSettled || hand.actionStatus === 'done') {
            return true;
        }
        return false;
    });
}
export function hasActingHands(session, round) {
    return orderedHandKeys(session, round).some((key) => round.playerHands[key]?.actionStatus === 'acting');
}
/** Skip bank draw when every bet is already lost or fully settled. */
export function shouldSkipBankDraw(session, round) {
    if (hasActingHands(session, round)) {
        return false;
    }
    if (round.evenMoneyOfferHandKey) {
        return false;
    }
    if (round.insuranceOfferPending) {
        return false;
    }
    if (hasHandsNeedingDealerComparison(session, round)) {
        return false;
    }
    return allPlayerHandsEliminated(session, round);
}
/** When the active hand finished but other boxes still act, advance the turn pointer. */
function repairStaleActiveHandKey(session, round) {
    if (round.status !== 'player-turns' || !round.activeHandKey) {
        return round;
    }
    const activeHand = round.playerHands[round.activeHandKey];
    if (activeHand?.actionStatus === 'acting') {
        return round;
    }
    const nextHandKey = findNextActingHand(session, round);
    if (nextHandKey) {
        return syncActivePlayerId({ ...round, activeHandKey: nextHandKey, status: 'player-turns' });
    }
    return round;
}
export function applySkipBankIfNeeded(session, round) {
    if (round.status !== 'bank-turn' && round.status !== 'player-turns') {
        return round;
    }
    round = repairStaleActiveHandKey(session, round);
    if (!shouldSkipBankDraw(session, round)) {
        if (round.status === 'player-turns' &&
            !hasActingHands(session, round) &&
            !round.evenMoneyOfferHandKey &&
            !round.insuranceOfferPending) {
            return {
                ...round,
                activeHandKey: null,
                status: 'bank-turn',
                dealerHoleHidden: false,
            };
        }
        return round;
    }
    const allBust = allPlayerHandsEliminated(session, round);
    return {
        ...round,
        activeHandKey: null,
        status: 'banking',
        dealerHoleHidden: false,
        resultMessages: allBust
            ? { ...round.resultMessages, __round__: ALL_PLAYERS_BUST_MESSAGE }
            : round.resultMessages,
    };
}
