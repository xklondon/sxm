export function createEmptySession(id) {
    return {
        id,
        gameType: null,
        createdAt: new Date().toISOString(),
        status: 'setup',
        playerIds: [],
        bankPlayerId: null,
        dealerButtonPlayerId: null,
        currentRound: 0,
        ledgerEntryIds: [],
        deckId: null,
        dealingStatus: 'no-deck',
        boxSlotNumbers: {},
    };
}
