import { getActiveBlackjackProtocol } from '../protocols';
import { cardsFromIds, getBlackjackHandValue } from '../hand';
import { getCardById } from '../../deck/deck';
import { ranksMatchForSplit } from '../helpers';
import { canDoubleBlackjackForState, canHitBlackjack, canSplitBlackjackForState, canStandBlackjack, } from '../validation';
import { lookupBasicStrategyAction, strategyActionLabel, } from './strategyLookup';
import { BLACKJACK_INTEL } from './blackjackIntel';
function rankLabel(rank) {
    const map = {
        A: 'Ace',
        K: 'King',
        Q: 'Queen',
        J: 'Jack',
    };
    return map[rank] ?? rank;
}
function dealerUpValue(dealerRank) {
    if (dealerRank === 'A') {
        return 11;
    }
    if (['K', 'Q', 'J', '10'].includes(dealerRank)) {
        return 10;
    }
    return Number.parseInt(dealerRank, 10);
}
function dealerPhrase(dealerRank) {
    if (dealerRank === 'A') {
        return 'dealer Ace';
    }
    if (['K', 'Q', 'J', '10'].includes(dealerRank)) {
        return 'dealer 10';
    }
    return `dealer ${dealerRank}`;
}
function pairDescription(c0, c1) {
    if (c0.rank === c1.rank) {
        return `Pair of ${rankLabel(c0.rank)}s`;
    }
    return `${rankLabel(c0.rank)} and ${rankLabel(c1.rank)}`;
}
function collectAvailableActionsWithDeck(round, handKey, _deck, protocol, gameState) {
    const actions = [];
    if (round.insuranceOfferPending && protocol.insurance.offered) {
        actions.push('Insure', 'Decline insurance');
        return actions;
    }
    if (round.evenMoneyOfferHandKey === handKey) {
        actions.push('Take 1:1', 'Wait for 3:2');
        return actions;
    }
    if (canHitBlackjack(round, handKey)) {
        actions.push('Hit');
    }
    if (canStandBlackjack(round, handKey)) {
        actions.push('Stay');
    }
    if (gameState && protocol.double.allowed && canDoubleBlackjackForState(gameState, handKey)) {
        actions.push('Double');
    }
    if (gameState && protocol.split.allowed && canSplitBlackjackForState(gameState, handKey)) {
        actions.push('Split');
    }
    return actions;
}
function strategyToRecommended(action) {
    switch (action) {
        case 'hit':
            return 'hit';
        case 'stand':
            return 'stand';
        case 'double':
            return 'double';
        case 'split':
            return 'split';
        default:
            return 'none';
    }
}
function buildWhy(action, cards, dealerRank, canDouble, canSplit, protocol) {
    const { value, isSoft, isBlackjack } = getBlackjackHandValue(cards);
    const d = dealerUpValue(dealerRank);
    if (isBlackjack) {
        return BLACKJACK_INTEL.warnings.find((w) => w.id === 'warn-never-hit-21').summary;
    }
    if (value === 21) {
        return 'Twenty-one is a complete hand — standing is mandatory.';
    }
    if (cards.length === 2 &&
        ranksMatchForSplit(cards[0].rank, cards[1].rank) &&
        ['10', 'J', 'Q', 'K'].includes(cards[0].rank) &&
        action === 'stand') {
        return BLACKJACK_INTEL.pairs.find((p) => p.id === 'pair-10s').summary;
    }
    if (value === 9 && d === 11 && action === 'hit') {
        return 'Hard 9 vs Ace: hit is preferred. Double may be legal but performs poorly against a strong up-card.';
    }
    if (isSoft && value === 18 && d >= 9) {
        return BLACKJACK_INTEL.softHand.find((s) => s.id === 'soft-18').summary;
    }
    if (!isSoft && value >= 13 && value <= 16 && d >= 7) {
        return BLACKJACK_INTEL.hardHand.find((h) => h.id === 'hard-13-16').summary;
    }
    if (action === 'double' && !canDouble) {
        return `Strategy suggests double, but ${protocol.double.description}`;
    }
    if (action === 'split' && !canSplit) {
        return 'Strategy suggests split, but split is unavailable or not allowed by protocol.';
    }
    return `Basic strategy for ${isSoft ? 'soft' : 'hard'} ${value} vs ${dealerPhrase(dealerRank)} favors ${strategyActionLabel(action).toLowerCase()}.`;
}
function buildRisk(action, dealerRank, value) {
    const d = dealerUpValue(dealerRank);
    if (action === 'hit' && value >= 12) {
        return 'Hitting risks busting — one high card ends the hand.';
    }
    if (action === 'stand' && value <= 16 && d >= 7) {
        return 'Standing on a stiff total vs a strong dealer card often loses — but hitting busts more often.';
    }
    if (action === 'double') {
        return 'Double doubles the stake for one card only — high reward, no second chance.';
    }
    if (action === 'split') {
        return 'Split increases total exposure — two hands must both beat the dealer.';
    }
    if (d >= 7) {
        return BLACKJACK_INTEL.dealerUpcard.find((f) => f.id === 'dealer-10-a').summary;
    }
    return BLACKJACK_INTEL.dealerUpcard.find((f) => f.id === 'dealer-2-6').summary;
}
function buildFunLine(action, cards) {
    const { value, isBlackjack } = getBlackjackHandValue(cards);
    if (isBlackjack) {
        return 'Blackjack. Genius. Let the bank pay.';
    }
    if (value === 21) {
        return 'Twenty-one — let the dealer try to catch you.';
    }
    if (cards.length === 2 &&
        ranksMatchForSplit(cards[0].rank, cards[1].rank) &&
        ['10', 'J', 'Q', 'K'].includes(cards[0].rank)) {
        return 'Twenty is a fortress — do NOT split. Make the bank sweat.';
    }
    if (action === 'split' && cards[0].rank === '8') {
        return 'Pair of 8s — split and fight your way back.';
    }
    if (action === 'double' && value === 11) {
        return 'Eleven wants one strong card — double if the book agrees.';
    }
    return 'Play it cool and stick to the book.';
}
function reasonInsuranceAdvice(protocol) {
    const ins = BLACKJACK_INTEL.insurance;
    return {
        headline: 'Dealer shows Ace — insurance offered',
        protocolName: protocol.displayName,
        recommendedAction: 'insurance-decline',
        availableActions: ['Insure', 'Decline insurance'],
        why: [
            ins.find((i) => i.id === 'ins-what').summary,
            ins.find((i) => i.id === 'ins-max').summary,
            ins.find((i) => i.id === 'ins-pay').summary,
            ins.find((i) => i.id === 'ins-basic').summary,
        ].join(' '),
        risk: ins.find((i) => i.id === 'ins-basic').summary,
        nextMove: 'Decline insurance unless the shoe is rich in tens (Hi-Lo true count well above zero).',
        funLine: 'Insurance is a side bet — the house loves habitual takers.',
    };
}
function reasonBlackjackAdvice(protocol) {
    return {
        headline: 'Natural blackjack',
        protocolName: protocol.displayName,
        recommendedAction: 'stand',
        availableActions: ['Stay'],
        why: BLACKJACK_INTEL.warnings.find((w) => w.id === 'warn-never-hit-21').summary,
        risk: 'No risk — hand is complete at natural 21.',
        nextMove: 'Stay. Never hit on 21.',
        funLine: 'Blackjack. Genius. Let the bank pay.',
    };
}
/** Local deterministic AID reasoner — protocol + intel + strategy lookup. */
export function reasonAidAdvice(input) {
    const { round, handKey, deck, flowSettings, gameState } = input;
    const protocol = input.protocol ?? getActiveBlackjackProtocol();
    if (!flowSettings.adviceEnabled) {
        return null;
    }
    if (flowSettings.adviceCostMode === 'bank-offer') {
        return {
            headline: 'Advice on offer',
            protocolName: protocol.displayName,
            recommendedAction: 'none',
            availableActions: [],
            why: 'The bank may sell tips for a chip later.',
            risk: 'Trust your gut or wait for free advice.',
            nextMove: 'Make your own call this round.',
            funLine: 'The house always has a side hustle.',
        };
    }
    if (round.insuranceOfferPending && protocol.insurance.offered) {
        return reasonInsuranceAdvice(protocol);
    }
    const hand = round.playerHands[handKey];
    if (!hand || hand.cardIds.length === 0) {
        return {
            headline: 'Waiting for cards',
            protocolName: protocol.displayName,
            recommendedAction: 'none',
            availableActions: [],
            why: 'No cards dealt to this hand yet.',
            risk: 'None until bets are locked and cards arrive.',
            nextMove: 'Place your bet and wait for the deal.',
            funLine: 'Patience — the shoe is warming up.',
        };
    }
    const cards = cardsFromIds(deck, hand.cardIds);
    const { value, isSoft, isBlackjack } = getBlackjackHandValue(cards);
    if (isBlackjack || value === 21) {
        return reasonBlackjackAdvice(protocol);
    }
    const dealerUp = round.dealerCardIds[0]
        ? getCardById(deck, round.dealerCardIds[0])
        : undefined;
    const dealerRank = dealerUp?.rank ?? '10';
    const canSplit = gameState && protocol.split.allowed
        ? canSplitBlackjackForState(gameState, handKey)
        : cards.length === 2 && ranksMatchForSplit(cards[0]?.rank ?? '2', cards[1]?.rank ?? '3');
    const canDouble = gameState && protocol.double.allowed
        ? canDoubleBlackjackForState(gameState, handKey)
        : cards.length === 2;
    const strategyAction = lookupBasicStrategyAction(cards, dealerRank, canSplit, canDouble);
    const recommendedAction = strategyToRecommended(strategyAction);
    const availableActions = collectAvailableActionsWithDeck(round, handKey, deck, protocol, gameState);
    let headline;
    if (cards.length === 2 && ranksMatchForSplit(cards[0].rank, cards[1].rank)) {
        headline = `${pairDescription(cards[0], cards[1])} vs ${dealerPhrase(dealerRank)}`;
    }
    else {
        headline = `${isSoft ? 'Soft' : 'Hard'} ${value} vs ${dealerPhrase(dealerRank)}`;
    }
    return {
        headline,
        protocolName: protocol.displayName,
        recommendedAction,
        availableActions,
        why: buildWhy(strategyAction, cards, dealerRank, canDouble, canSplit, protocol),
        risk: buildRisk(strategyAction, dealerRank, value),
        nextMove: `Recommended: ${strategyActionLabel(strategyAction)}.`,
        funLine: buildFunLine(strategyAction, cards),
    };
}
export function formatAidStructuredAdvice(advice) {
    const parts = [
        `[${advice.protocolName}] ${advice.headline}.`,
        advice.nextMove,
        advice.why,
        advice.risk,
        advice.funLine,
        advice.availableActions.length > 0
            ? `Options: ${advice.availableActions.join(', ')}.`
            : '',
    ].filter(Boolean);
    return parts.join(' ');
}
