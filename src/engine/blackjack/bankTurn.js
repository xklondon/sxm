import { cardsFromIds } from './hand';
import { assertRoundStatus } from './helpers';
import { drawCard } from '../deck/deck';
import { evaluateDealerDraw, logDealerDrawDecision, shouldDealerDraw, } from './dealerDraw';
import { applySkipBankIfNeeded, shouldSkipBankDraw } from './roundFlow';
export function bankNeedsAnotherCard(dealerCards, settings, protocol) {
    const decision = evaluateDealerDraw(dealerCards, settings, protocol);
    logDealerDrawDecision('bankNeedsAnotherCard', dealerCards, decision, protocol);
    return decision.shouldDraw;
}
/** Deal European-style hole card at bank turn if not yet dealt. */
export function ensureDealerHoleCardDealt(deck, round, protocol) {
    if (!protocol?.dealingRules.holeCardDealtLast) {
        return { deck, round, dealt: false };
    }
    const visible = round.dealerCardIds.filter(Boolean);
    if (visible.length !== 1) {
        return { deck, round, dealt: false };
    }
    const draw = drawCard(deck);
    if (!draw.card) {
        return { deck, round, dealt: false };
    }
    return {
        deck: draw.deck,
        round: {
            ...round,
            dealerCardIds: [...visible, draw.card.id],
            dealerHoleHidden: false,
        },
        dealt: true,
    };
}
export function drawSingleBankCard(session, players, deck, round, settings, protocol) {
    assertRoundStatus(round, ['bank-turn'], 'draw bank card');
    if (shouldSkipBankDraw(session, round)) {
        return {
            session,
            players,
            deck,
            round: applySkipBankIfNeeded(session, round),
            cardId: null,
            complete: true,
        };
    }
    let nextDeck = deck;
    let nextRound = {
        ...round,
        dealerHoleHidden: false,
    };
    const hole = ensureDealerHoleCardDealt(nextDeck, nextRound, protocol);
    nextDeck = hole.deck;
    nextRound = hole.round;
    if (hole.dealt) {
        logDealerDrawDecision('holeCardDealtLast', cardsFromIds(nextDeck, nextRound.dealerCardIds), evaluateDealerDraw(cardsFromIds(nextDeck, nextRound.dealerCardIds), settings, protocol), protocol);
    }
    const dealerCards = cardsFromIds(nextDeck, nextRound.dealerCardIds);
    const standDecision = evaluateDealerDraw(dealerCards, settings, protocol);
    logDealerDrawDecision('drawSingleBankCard:pre', dealerCards, standDecision, protocol);
    if (!shouldDealerDraw(dealerCards, settings, protocol)) {
        return {
            session,
            players,
            deck: nextDeck,
            round: { ...nextRound, status: 'banking' },
            cardId: null,
            complete: true,
        };
    }
    const draw = drawCard(nextDeck);
    if (!draw.card) {
        return {
            session,
            players,
            deck: draw.deck,
            round: { ...nextRound, status: 'banking' },
            cardId: null,
            complete: true,
        };
    }
    nextRound = {
        ...nextRound,
        dealerCardIds: [...nextRound.dealerCardIds.filter(Boolean), draw.card.id],
    };
    const afterCards = cardsFromIds(draw.deck, nextRound.dealerCardIds);
    const afterDecision = evaluateDealerDraw(afterCards, settings, protocol);
    logDealerDrawDecision('drawSingleBankCard:post', afterCards, afterDecision, protocol);
    const complete = !afterDecision.shouldDraw;
    return {
        session,
        players,
        deck: draw.deck,
        round: {
            ...nextRound,
            status: complete ? 'banking' : 'bank-turn',
        },
        cardId: draw.card.id,
        complete,
    };
}
/** If bank already stands, skip straight to banking. */
export function enterBankingIfComplete(round, deck, settings, protocol, session) {
    if (round.status !== 'bank-turn') {
        return round;
    }
    if (session && shouldSkipBankDraw(session, round)) {
        return applySkipBankIfNeeded(session, round);
    }
    let nextRound = { ...round, dealerHoleHidden: false };
    let nextDeck = deck;
    const hole = ensureDealerHoleCardDealt(nextDeck, nextRound, protocol);
    nextDeck = hole.deck;
    nextRound = hole.round;
    const dealerCards = cardsFromIds(nextDeck, nextRound.dealerCardIds);
    const decision = evaluateDealerDraw(dealerCards, settings, protocol);
    logDealerDrawDecision('enterBankingIfComplete', dealerCards, decision, protocol);
    if (!decision.shouldDraw) {
        return { ...nextRound, status: 'banking', dealerHoleHidden: false };
    }
    return { ...nextRound, dealerHoleHidden: false };
}
