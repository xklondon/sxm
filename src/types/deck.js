export function createEmptyDeck(id) {
    return {
        id,
        cards: [],
        drawOrder: [],
        dealtCardIds: [],
    };
}
export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS = [
    'A',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'J',
    'Q',
    'K',
];
const SUIT_LETTERS = {
    hearts: 'H',
    diamonds: 'D',
    clubs: 'C',
    spades: 'S',
};
export function cardIdFor(rank, suit) {
    return `${rank}${SUIT_LETTERS[suit]}`;
}
export function getDealingStatusFromDeck(deck) {
    if (!deck || deck.cards.length === 0) {
        return 'no-deck';
    }
    if (deck.drawOrder.length === 0) {
        return 'depleted';
    }
    return 'ready';
}
