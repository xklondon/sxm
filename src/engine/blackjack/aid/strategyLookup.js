import { getBlackjackHandValue } from '../hand';
import { ranksMatchForSplit } from '../helpers';
function dealerUpValue(dealerRank) {
    if (dealerRank === 'A') {
        return 11;
    }
    if (['K', 'Q', 'J', '10'].includes(dealerRank)) {
        return 10;
    }
    return Number.parseInt(dealerRank, 10);
}
/**
 * Multi-deck basic strategy lookup — deterministic, no external AI.
 * Respects protocol-allowed actions via canSplit/canDouble flags.
 */
export function lookupBasicStrategyAction(cards, dealerRank, canSplit, canDouble) {
    const { value, isSoft, isBlackjack } = getBlackjackHandValue(cards);
    const d = dealerUpValue(dealerRank);
    if (isBlackjack || value >= 21) {
        return 'stand';
    }
    if (cards.length === 2 && canSplit && ranksMatchForSplit(cards[0].rank, cards[1].rank)) {
        const r = cards[0].rank;
        if (r === 'A' || r === '8') {
            return 'split';
        }
        if (['10', 'J', 'Q', 'K'].includes(r)) {
            return 'stand';
        }
        if (r === '9') {
            return d === 7 || d === 10 || d === 11 ? 'stand' : 'split';
        }
        if (r === '7') {
            return d <= 7 ? 'split' : 'hit';
        }
        if (r === '6') {
            return d >= 2 && d <= 6 ? 'split' : 'hit';
        }
        if (r === '4') {
            return d === 5 || d === 6 ? 'split' : 'hit';
        }
        if (r === '3' || r === '2') {
            return d >= 2 && d <= 7 ? 'split' : 'hit';
        }
    }
    if (isSoft) {
        if (value <= 17) {
            return canDouble && d >= 3 && d <= 6 ? 'double' : 'hit';
        }
        if (value === 18) {
            if (d >= 9) {
                return 'hit';
            }
            return canDouble && d >= 3 && d <= 6 ? 'double' : 'stand';
        }
        return 'stand';
    }
    if (value <= 8) {
        return 'hit';
    }
    if (value === 9) {
        if (d === 11) {
            return 'hit';
        }
        return canDouble && d >= 3 && d <= 6 ? 'double' : 'hit';
    }
    if (value === 10) {
        return canDouble && d >= 2 && d <= 9 ? 'double' : 'hit';
    }
    if (value === 11) {
        return canDouble && d >= 2 && d <= 10 ? 'double' : 'hit';
    }
    if (value === 12) {
        return d >= 4 && d <= 6 ? 'stand' : 'hit';
    }
    if (value >= 13 && value <= 16) {
        return d >= 2 && d <= 6 ? 'stand' : 'hit';
    }
    return 'stand';
}
export function strategyActionLabel(action) {
    switch (action) {
        case 'hit':
            return 'Hit';
        case 'stand':
            return 'Stay';
        case 'double':
            return 'Double';
        case 'split':
            return 'Split';
        default:
            return action;
    }
}
