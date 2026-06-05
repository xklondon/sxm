import { RANKS, SUITS, cardIdFor, } from '../../types/deck';
import { generateId } from '../utils/id';
import { createSeededRandom, fisherYatesShuffle } from './shuffle';
export function createStandardDeck(deckId) {
    const id = deckId ?? generateId();
    const cards = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            cards.push({
                id: cardIdFor(rank, suit),
                suit,
                rank,
            });
        }
    }
    const drawOrder = cards.map((_, index) => index);
    return {
        id,
        cards,
        drawOrder,
        dealtCardIds: [],
    };
}
export function shuffleDeck(deck, seed) {
    const random = seed !== undefined ? createSeededRandom(seed) : Math.random;
    const drawOrder = fisherYatesShuffle(deck.drawOrder, random);
    return {
        ...deck,
        drawOrder,
        dealtCardIds: [],
    };
}
export function getRemainingCardCount(deck) {
    return deck.drawOrder.length;
}
export function drawCard(deck) {
    if (deck.drawOrder.length === 0) {
        return { deck, card: null };
    }
    const drawOrder = [...deck.drawOrder];
    const cardIndex = drawOrder.pop();
    const card = deck.cards[cardIndex];
    return {
        deck: {
            ...deck,
            drawOrder,
            dealtCardIds: [...deck.dealtCardIds, card.id],
        },
        card,
    };
}
export function drawCards(deck, count) {
    let next = deck;
    const cards = [];
    for (let i = 0; i < count; i += 1) {
        const result = drawCard(next);
        next = result.deck;
        if (!result.card) {
            break;
        }
        cards.push(result.card);
    }
    return { deck: next, cards };
}
export function resetDeck(deck) {
    const base = deck ? createStandardDeck(deck.id) : createStandardDeck();
    return base;
}
export function getDealtCards(deck) {
    const byId = new Map(deck.cards.map((c) => [c.id, c]));
    return deck.dealtCardIds
        .map((id) => byId.get(id))
        .filter((c) => c !== undefined);
}
export function getLastDealtCard(deck) {
    const dealt = getDealtCards(deck);
    return dealt.length > 0 ? dealt[dealt.length - 1] : null;
}
export function getCardById(deck, cardId) {
    return deck.cards.find((c) => c.id === cardId);
}
