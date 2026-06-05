import { getBlackjackHandValue, cardsFromIds } from './hand';
import { orderedHandKeys } from './helpers';
import { parseBlackjackHandKey } from './handKeys';
/** Deterministic virtual player: hit under 16, stand on 16+. */
export function getVirtualBlackjackAction(round, handKey, deck) {
    const hand = round.playerHands[handKey];
    if (!hand || hand.actionStatus !== 'acting') {
        return 'stand';
    }
    const cards = cardsFromIds(deck, hand.cardIds);
    const { value } = getBlackjackHandValue(cards);
    return value < 16 ? 'hit' : 'stand';
}
export function isVirtualPlayer(players, playerId) {
    return players[playerId]?.playerType === 'virtual';
}
export function findNextActingHand(session, round, afterHandKey) {
    const keys = orderedHandKeys(session, round);
    const startIndex = afterHandKey ? keys.indexOf(afterHandKey) + 1 : 0;
    for (let i = startIndex; i < keys.length; i += 1) {
        const key = keys[i];
        if (round.playerHands[key]?.actionStatus === 'acting') {
            return key;
        }
    }
    return null;
}
export function activePlayerIdFromRound(round) {
    if (!round.activeHandKey) {
        return null;
    }
    return parseBlackjackHandKey(round.activeHandKey).playerId;
}
