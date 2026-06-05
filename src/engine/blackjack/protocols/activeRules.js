import { parseBlackjackHandKey } from '../handKeys';
import { handKeysWithConfirmedBets } from '../helpers';
import { derivePlayerBalanceFromLedger } from '../../ledger/ledger';
import { getCardById } from '../../deck/deck';
import { getBlackjackHandValue } from '../hand';
import { ranksMatchForSplit } from '../helpers';
import { evaluateDealerDraw } from '../dealerDraw';
const TEN_VALUE_RANKS = ['10', 'J', 'Q', 'K'];
export function dealerUpRankCanHaveBlackjack(upRank) {
    if (!upRank) {
        return false;
    }
    return upRank === 'A' || TEN_VALUE_RANKS.includes(upRank);
}
export function getBlackjackPayout(protocol) {
    return protocol.payouts.blackjackMultiplier;
}
export function getInsuranceRules(protocol) {
    return protocol.insurance;
}
export function getDealerPeekPolicy(protocol) {
    return {
        peekOnAce: protocol.dealer.peekOnAce,
        peekOnTen: protocol.dealer.peekOnTen,
        description: protocol.dealer.description,
    };
}
export function getDealerDrawDecision(protocol, dealerCards, settings) {
    return evaluateDealerDraw(dealerCards, settings, protocol);
}
export function isBetValidUnderProtocol(protocol, betAmount, minBet) {
    if (betAmount <= 0) {
        return { valid: false, reason: 'Bet must be greater than zero' };
    }
    if (betAmount < minBet) {
        return { valid: false, reason: `Minimum bet is ${minBet}` };
    }
    if (betAmount % minBet !== 0) {
        return { valid: false, reason: `Bet must be a multiple of ${minBet}` };
    }
    if (betAmount > protocol.defaultMaxBet) {
        return { valid: false, reason: `Maximum bet is ${protocol.defaultMaxBet}` };
    }
    return { valid: true };
}
export function formatMinBetMultipleMessage(minBet) {
    return `Bet must be a multiple of ${minBet}.`;
}
function hardTotalAllowedForDouble(protocol, cards) {
    const { value, isSoft } = getBlackjackHandValue(cards);
    if (protocol.double.allowedHardTotals === 'any') {
        return !isSoft || value <= 21;
    }
    return protocol.double.allowedHardTotals.includes(value);
}
export function canDoubleUnderProtocol(protocol, hand, context) {
    if (!protocol.double.allowed) {
        return false;
    }
    if (context.insuranceOfferPending || !context.isActiveTurn) {
        return false;
    }
    if (hand.actionStatus !== 'acting' || hand.doubled) {
        return false;
    }
    if (protocol.double.firstTwoCardsOnly && hand.cardIds.length !== 2) {
        return false;
    }
    if (hand.fromSplit && !protocol.double.allowedAfterSplit) {
        return false;
    }
    if (!hardTotalAllowedForDouble(protocol, context.cards)) {
        return false;
    }
    return context.availableChips >= hand.currentBet && context.ledgerBalance >= hand.currentBet;
}
export function canSplitUnderProtocol(protocol, hand, context) {
    if (!protocol.split.allowed) {
        return false;
    }
    if (context.insuranceOfferPending || !context.isActiveTurn) {
        return false;
    }
    if (hand.actionStatus !== 'acting' || hand.doubled || hand.cardIds.length !== 2) {
        return false;
    }
    if (context.splitCountForPlayer >= protocol.split.maxSplitsPerRound) {
        return false;
    }
    const c0 = getCardById(context.deck, hand.cardIds[0]);
    const c1 = getCardById(context.deck, hand.cardIds[1]);
    if (!c0 || !c1) {
        return false;
    }
    if (protocol.split.sameRankOnly && !ranksMatchForSplit(c0.rank, c1.rank)) {
        return false;
    }
    return context.availableChips >= hand.currentBet && context.ledgerBalance >= hand.currentBet;
}
export function canHitUnderProtocol(protocol, hand, context) {
    if (context.insuranceOfferPending || !context.isActiveTurn) {
        return false;
    }
    if (hand.naturalSettled || hand.actionStatus === 'blackjack' || hand.actionStatus === 'done') {
        return false;
    }
    if (hand.actionStatus !== 'acting' || hand.doubled) {
        return false;
    }
    return protocol.supportedActions.includes('hit');
}
export function canStandUnderProtocol(protocol, hand, context) {
    if (context.insuranceOfferPending || !context.isActiveTurn) {
        return false;
    }
    return hand.actionStatus === 'acting' && protocol.supportedActions.includes('stand');
}
/** Even-money (1:1 now) when player has natural and dealer up can have blackjack. */
export function shouldOfferEvenMoney(protocol, playerCards, dealerUpRank) {
    const { isBlackjack } = getBlackjackHandValue(playerCards);
    if (!isBlackjack) {
        return false;
    }
    if (!dealerUpRankCanHaveBlackjack(dealerUpRank)) {
        return false;
    }
    return protocol.insurance.offered && (protocol.dealer.peekOnAce || protocol.dealer.peekOnTen);
}
/** Pay natural immediately when dealer up-card cannot make dealer blackjack. */
export function shouldPayNaturalImmediately(_protocol, playerCards, dealerUpRank) {
    const { isBlackjack } = getBlackjackHandValue(playerCards);
    if (!isBlackjack) {
        return false;
    }
    return !dealerUpRankCanHaveBlackjack(dealerUpRank);
}
/** Hand may take insurance when dealer shows Ace (skip busted/natural-resolved). */
export function isHandEligibleForInsuranceOffer(protocol, hand) {
    if (!protocol.insurance.offered) {
        return false;
    }
    if (hand.currentBet <= 0) {
        return false;
    }
    if (hand.bustSettled || hand.naturalSettled) {
        return false;
    }
    if (hand.actionStatus === 'busted' || hand.actionStatus === 'done') {
        return false;
    }
    if (hand.actionStatus === 'blackjack') {
        return false;
    }
    return true;
}
/** Box player ids with a confirmed bet and an insurance-eligible hand (one per box). */
export function getInsuranceEligibleBoxIds(session, round, protocol) {
    const boxIds = [];
    const seen = new Set();
    for (const handKey of handKeysWithConfirmedBets(session, round)) {
        const boxId = parseBlackjackHandKey(handKey).playerId;
        if (seen.has(boxId)) {
            continue;
        }
        const hand = round.playerHands[handKey];
        if (!hand || !isHandEligibleForInsuranceOffer(protocol, hand)) {
            continue;
        }
        seen.add(boxId);
        boxIds.push(boxId);
    }
    return boxIds;
}
/** @deprecated Use getInsuranceEligibleBoxIds — values are box player ids, not person ids. */
export function getInsuranceEligiblePlayerIds(session, round, protocol) {
    return getInsuranceEligibleBoxIds(session, round, protocol);
}
/** True when every insurance-eligible box has accepted or declined (see insurance.ts for auto-skip). */
export function allInsuranceDecisionsResolved(session, round, protocol) {
    if (!round.insuranceOfferPending) {
        return true;
    }
    const eligible = getInsuranceEligibleBoxIds(session, round, protocol);
    if (eligible.length === 0) {
        return true;
    }
    return eligible.every((boxId) => {
        const declined = round.insuranceDeclined?.[boxId];
        const bet = round.insuranceBets?.[boxId] ?? 0;
        return Boolean(declined) || bet > 0;
    });
}
export function shouldOfferInsuranceUnderProtocol(protocol, dealerShowsAceUp) {
    return Boolean(protocol.insurance.offered && dealerShowsAceUp);
}
export function getAllowedActionsForHand(protocol, context) {
    const actions = [];
    if (context.insuranceOfferPending && protocol.insurance.offered) {
        return ['insurance'];
    }
    if (context.round.evenMoneyOfferHandKey === context.handKey) {
        return ['even-money', 'stand'];
    }
    if (canHitUnderProtocol(protocol, context.hand, context)) {
        actions.push('hit');
    }
    if (canStandUnderProtocol(protocol, context.hand, context)) {
        actions.push('stand');
    }
    if (canDoubleUnderProtocol(protocol, context.hand, context)) {
        actions.push('double');
    }
    if (canSplitUnderProtocol(protocol, context.hand, context)) {
        actions.push('split');
    }
    return actions;
}
export function buildActiveRulesHandContext(_protocol, ledger, round, handKey, deck, bankrollOwnerId, availableChips) {
    const hand = round.playerHands[handKey];
    if (!hand) {
        return null;
    }
    const cards = hand.cardIds
        .map((id) => getCardById(deck, id))
        .filter((c) => c !== undefined);
    const { playerId } = hand;
    return {
        handKey,
        hand,
        cards,
        round,
        splitCountForPlayer: round.splitCounts?.[playerId] ?? 0,
        availableChips,
        ledgerBalance: derivePlayerBalanceFromLedger(bankrollOwnerId, ledger),
        isActiveTurn: round.status === 'player-turns' && round.activeHandKey === handKey,
        insuranceOfferPending: Boolean(round.insuranceOfferPending),
    };
}
