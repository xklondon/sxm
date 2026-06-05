import { RANKS, SUITS, cardIdFor } from '../../types/deck';
import { generateId } from '../utils/id';
import { fisherYatesShuffle, createSeededRandom } from '../deck/shuffle';
/** Build a multi-deck shoe with unique ids per deck copy, e.g. `AS-D1`, `AS-D2`. */
export function createBlackjackShoe(deckCount, deckId) {
    if (deckCount < 1) {
        throw new Error('Shoe must contain at least 1 deck');
    }
    const id = deckId ?? generateId();
    const cards = [];
    for (let d = 1; d <= deckCount; d += 1) {
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                cards.push({
                    id: `${cardIdFor(rank, suit)}-D${d}`,
                    suit,
                    rank,
                });
            }
        }
    }
    const drawOrder = cards.map((_, index) => index);
    return {
        id,
        cards,
        drawOrder,
        dealtCardIds: [],
        deckCount,
    };
}
export function shuffleBlackjackShoe(shoe, seed) {
    const random = seed !== undefined ? createSeededRandom(seed) : Math.random;
    return {
        ...shoe,
        drawOrder: fisherYatesShuffle(shoe.drawOrder, random),
        dealtCardIds: [],
    };
}
export function getShoeDeckCount(shoe) {
    if (shoe.cards.length === 0) {
        return 0;
    }
    return Math.round(shoe.cards.length / 52);
}
