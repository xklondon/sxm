/** Hand key helpers for split hands: `playerId:handIndex`. */
export function blackjackHandKey(playerId, handIndex = 0) {
    return `${playerId}:${handIndex}`;
}
export function parseBlackjackHandKey(key) {
    const colon = key.lastIndexOf(':');
    if (colon === -1) {
        return { playerId: key, handIndex: 0 };
    }
    return {
        playerId: key.slice(0, colon),
        handIndex: Number.parseInt(key.slice(colon + 1), 10) || 0,
    };
}
export function listHandKeysForPlayer(playerHands, playerId) {
    return Object.keys(playerHands)
        .filter((k) => parseBlackjackHandKey(k).playerId === playerId)
        .sort((a, b) => parseBlackjackHandKey(a).handIndex - parseBlackjackHandKey(b).handIndex);
}
export function countSplitsForPlayer(playerHands, playerId) {
    return listHandKeysForPlayer(playerHands, playerId).length - 1;
}
