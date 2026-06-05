export function createEmptyHoldemRound(dealerButtonPlayerId, smallBlindPlayerId, bigBlindPlayerId, options) {
    const smallBlind = options?.smallBlind ?? 5;
    const bigBlind = options?.bigBlind ?? 10;
    return {
        status: 'setup',
        bettingStreet: null,
        smallBlind,
        bigBlind,
        communityCardIds: [],
        pot: 0,
        currentBet: 0,
        dealerButtonPlayerId,
        smallBlindPlayerId,
        bigBlindPlayerId,
        activePlayerId: null,
        playerStates: {},
        actionLog: [],
        winners: [],
        resultSummary: '',
        lastRaiseSize: bigBlind,
    };
}
export const BETTING_STREETS = ['preflop', 'flop', 'turn', 'river'];
export function nextBettingStreet(street) {
    if (!street) {
        return 'preflop';
    }
    const index = BETTING_STREETS.indexOf(street);
    if (index === -1 || index === BETTING_STREETS.length - 1) {
        return 'showdown';
    }
    return BETTING_STREETS[index + 1];
}
export function computeHoldemPot(round) {
    return Object.values(round.playerStates).reduce((sum, ps) => sum + ps.playerTotalCommitted, 0);
}
