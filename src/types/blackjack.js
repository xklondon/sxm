export function createEmptyBlackjackRound() {
    return {
        status: 'betting',
        dealerCardIds: [],
        dealerHoleHidden: true,
        activeHandKey: null,
        activePlayerId: null,
        playerHands: {},
        splitCounts: {},
        outcomes: {},
        resultMessages: {},
        insuranceOfferPending: false,
        insuranceBets: {},
        insuranceDeclined: {},
    };
}
export function createBlackjackPlayerHand(playerId, handIndex = 0, fromSplit = false) {
    return {
        playerId,
        handIndex,
        cardIds: [],
        actionStatus: 'betting',
        currentBet: 0,
        doubled: false,
        fromSplit,
    };
}
