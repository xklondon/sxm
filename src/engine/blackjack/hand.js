function rankBaseValue(rank) {
    if (rank === 'A') {
        return 11;
    }
    if (rank === 'K' || rank === 'Q' || rank === 'J') {
        return 10;
    }
    return Number.parseInt(rank, 10);
}
export function getBlackjackHandValue(cards) {
    if (cards.length === 0) {
        return { value: 0, isSoft: false, isBlackjack: false };
    }
    let value = 0;
    let aces = 0;
    for (const card of cards) {
        value += rankBaseValue(card.rank);
        if (card.rank === 'A') {
            aces += 1;
        }
    }
    while (value > 21 && aces > 0) {
        value -= 10;
        aces -= 1;
    }
    const isSoft = aces > 0 && value <= 21;
    const isBlackjack = cards.length === 2 && value === 21;
    return { value, isSoft, isBlackjack };
}
export function getBlackjackHandStatus(cards) {
    if (cards.length === 0) {
        return 'empty';
    }
    const { value, isBlackjack } = getBlackjackHandValue(cards);
    if (isBlackjack) {
        return 'blackjack';
    }
    if (value > 21) {
        return 'busted';
    }
    return 'playing';
}
export function cardsFromIds(deck, ids) {
    const byId = new Map(deck.cards.map((c) => [c.id, c]));
    return (ids ?? [])
        .map((id) => byId.get(id))
        .filter((c) => c !== undefined);
}
