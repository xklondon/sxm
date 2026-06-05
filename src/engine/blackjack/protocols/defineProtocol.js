/** Shared builder — keeps protocolId/displayName fields aligned. */
export function defineBlackjackProtocol(base) {
    return {
        ...base,
        id: base.protocolId,
        name: base.displayName,
        summary: base.shortDescription,
        blackjackPayout: base.payouts.blackjackMultiplier,
        numberOfDecks: base.shoe.deckCount,
    };
}
