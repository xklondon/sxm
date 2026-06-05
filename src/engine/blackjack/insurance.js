import { getCallerPersonIdForBox } from '../session/playerAssignment';
import { getCardById } from '../deck/deck';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { insuranceBetMax, insuranceWinPayout } from './rules';
import { getBlackjackHandValue, cardsFromIds } from './hand';
import { handKeysWithConfirmedBets, syncPlayerBetsFromRound } from './helpers';
import { parseBlackjackHandKey } from './handKeys';
import { getAvailableChipsForBankrollOwner, resolveBankrollOwnerIdForBox, } from '../session/bankroll';
import { findNextActingHand } from './virtual';
import { syncActivePlayerId } from './helpers';
import { resolveBankrollOwnerId } from '../session/bankroll';
import { appendBoxLedgerEntry } from '../session/boxLedger';
import { appendBankLedgerEntry } from './bankLedger';
import { getInsuranceEligibleBoxIds, getInsuranceEligiblePlayerIds, isHandEligibleForInsuranceOffer, shouldOfferInsuranceUnderProtocol, } from './protocols/activeRules';
import { getBlackjackProtocolOrDefault } from './protocols';
import { canOfferInsuranceAfterInitialDeal } from './initialDealGuards';
export function dealerShowsAce(deck, round) {
    const upId = round.dealerCardIds[0];
    if (!upId) {
        return false;
    }
    const card = getCardById(deck, upId);
    return card?.rank === 'A';
}
export function shouldOfferInsurance(round, deck, settings, protocol) {
    if (protocol) {
        return shouldOfferInsuranceUnderProtocol(protocol, dealerShowsAce(deck, round));
    }
    return Boolean(settings.allowInsurance && dealerShowsAce(deck, round));
}
export function activateInsuranceOfferIfNeeded(round, deck, settings, session, protocol) {
    const resolvedProtocol = protocol ?? getBlackjackProtocolOrDefault();
    if (session && !canOfferInsuranceAfterInitialDeal(session, round)) {
        return { ...round, insuranceOfferPending: false };
    }
    if (!shouldOfferInsurance(round, deck, settings, resolvedProtocol)) {
        return { ...round, insuranceOfferPending: false };
    }
    if (session) {
        const eligible = getInsuranceEligibleBoxIds(session, round, resolvedProtocol);
        if (eligible.length === 0) {
            return { ...round, insuranceOfferPending: false };
        }
    }
    return {
        ...round,
        insuranceOfferPending: true,
        insuranceBets: { ...(round.insuranceBets ?? {}) },
        insuranceDeclined: { ...(round.insuranceDeclined ?? {}) },
    };
}
export function getInsuranceHandKeyForBox(session, round, boxId) {
    return (handKeysWithConfirmedBets(session, round).find((handKey) => parseBlackjackHandKey(handKey).playerId === boxId) ?? null);
}
export function canAffordInsuranceForBox(state, round, boxId) {
    const handKey = getInsuranceHandKeyForBox(state.session, round, boxId);
    const hand = handKey ? round.playerHands[handKey] : undefined;
    if (!hand) {
        return false;
    }
    const maxBet = insuranceBetMax(hand.currentBet);
    if (maxBet <= 0) {
        return false;
    }
    if (!getCallerPersonIdForBox(state, boxId)) {
        return false;
    }
    const bankrollOwnerId = resolveBankrollOwnerIdForBox(state, boxId);
    return getAvailableChipsForBankrollOwner(state, bankrollOwnerId) >= maxBet;
}
/** Box insurance complete: taken, declined, ineligible, no caller, or unfunded (auto-skip). */
export function isInsuranceBoxDecisionResolved(state, round, protocol, boxId) {
    if (!round.insuranceOfferPending) {
        return true;
    }
    const handKey = getInsuranceHandKeyForBox(state.session, round, boxId);
    const hand = handKey ? round.playerHands[handKey] : undefined;
    if (!hand || !isHandEligibleForInsuranceOffer(protocol, hand)) {
        return true;
    }
    if (round.insuranceDeclined?.[boxId]) {
        return true;
    }
    if ((round.insuranceBets?.[boxId] ?? 0) > 0) {
        return true;
    }
    if (!getCallerPersonIdForBox(state, boxId)) {
        return true;
    }
    if (!canAffordInsuranceForBox(state, round, boxId)) {
        return true;
    }
    return false;
}
export function allInsuranceDecisionsResolved(state, round, protocol) {
    const resolvedProtocol = protocol ?? getBlackjackProtocolOrDefault();
    if (!round.insuranceOfferPending) {
        return true;
    }
    const eligible = getInsuranceEligibleBoxIds(state.session, round, resolvedProtocol);
    if (eligible.length === 0) {
        return true;
    }
    return eligible.every((boxId) => isInsuranceBoxDecisionResolved(state, round, resolvedProtocol, boxId));
}
export function allInsuranceResolved(state, round, protocol) {
    return allInsuranceDecisionsResolved(state, round, protocol);
}
export { getInsuranceEligibleBoxIds, getInsuranceEligiblePlayerIds, isHandEligibleForInsuranceOffer };
/** Insurance offer for one box (boxId = player id on the hand). */
export function getInsuranceOfferForBox(state, round, boxId, protocol) {
    if (!round.insuranceOfferPending) {
        return null;
    }
    const resolvedProtocol = protocol ?? getBlackjackProtocolOrDefault();
    const handKey = getInsuranceHandKeyForBox(state.session, round, boxId);
    if (!handKey) {
        return null;
    }
    const hand = round.playerHands[handKey];
    if (!hand || !isHandEligibleForInsuranceOffer(resolvedProtocol, hand)) {
        return null;
    }
    const maxBet = insuranceBetMax(hand.currentBet);
    if (maxBet <= 0) {
        return null;
    }
    if (!getCallerPersonIdForBox(state, boxId)) {
        return null;
    }
    return {
        handKey,
        maxBet,
        canAfford: canAffordInsuranceForBox(state, round, boxId),
    };
}
export function takeInsuranceBet(session, players, ledger, round, playerId, bankrollCtx, protocol) {
    if (!round.insuranceOfferPending) {
        throw new Error('Insurance is not offered');
    }
    const boxId = playerId;
    const handKey = getInsuranceHandKeyForBox(session, round, boxId);
    const hand = handKey ? round.playerHands[handKey] : undefined;
    if (!hand || !isHandEligibleForInsuranceOffer(protocol ?? getBlackjackProtocolOrDefault(), hand)) {
        throw new Error('No active hand for insurance');
    }
    const maxBet = insuranceBetMax(hand.currentBet);
    if (maxBet <= 0) {
        throw new Error('Bet too small for insurance');
    }
    const bankrollOwnerId = resolveBankrollOwnerId(bankrollCtx, boxId);
    const balance = derivePlayerBalanceFromLedger(bankrollOwnerId, ledger);
    if (balance < maxBet) {
        throw new Error('Not enough chips for insurance');
    }
    const betResult = appendBoxLedgerEntry(session, ledger, bankrollCtx, playerId, 'bet-placed', -maxBet, `Insurance: ${maxBet} chips (2:1 if dealer blackjack)`);
    const nextRound = {
        ...round,
        insuranceBets: {
            ...(round.insuranceBets ?? {}),
            [playerId]: maxBet,
        },
        insuranceDeclined: {
            ...(round.insuranceDeclined ?? {}),
            [playerId]: false,
        },
    };
    return {
        session: betResult.session,
        players,
        ledger: betResult.ledger,
        round: nextRound,
    };
}
export function declineInsurance(round, playerId) {
    return {
        ...round,
        insuranceDeclined: {
            ...(round.insuranceDeclined ?? {}),
            [playerId]: true,
        },
    };
}
export function closeInsuranceOffer(session, players, round) {
    const firstActingHand = findNextActingHand(session, round);
    const nextRound = syncActivePlayerId({
        ...round,
        insuranceOfferPending: false,
        activeHandKey: firstActingHand,
        status: firstActingHand ? 'player-turns' : 'bank-turn',
        dealerHoleHidden: firstActingHand !== null,
    });
    return {
        session,
        players: syncPlayerBetsFromRound(players, nextRound),
        round: nextRound,
    };
}
/** Close insurance when all eligible boxes decided (or none eligible). Returns closed=true when advanced. */
export function advanceInsurancePhaseIfComplete(state, round = state.blackjack, protocol = getBlackjackProtocolOrDefault()) {
    const { session, players } = state;
    if (!round.insuranceOfferPending) {
        return { session, players, round, closed: false };
    }
    const resolvedProtocol = protocol;
    if (!allInsuranceDecisionsResolved(state, round, resolvedProtocol)) {
        return { session, players, round, closed: false };
    }
    const closed = closeInsuranceOffer(session, players, round);
    return { ...closed, closed: true };
}
export function getInsuranceOfferForPlayer(state, round, boxId, protocol) {
    return getInsuranceOfferForBox(state, round, boxId, protocol);
}
/** Pay or lose insurance bets when dealer blackjack is known. */
export function settleInsuranceBets(session, players, ledger, deck, round, bankrollCtx) {
    const dealerCards = cardsFromIds(deck, round.dealerCardIds.filter(Boolean));
    const dealerBj = getBlackjackHandValue(dealerCards).isBlackjack;
    let nextSession = session;
    let nextLedger = ledger;
    const bankId = session.bankPlayerId;
    for (const [playerId, insBet] of Object.entries(round.insuranceBets ?? {})) {
        if (insBet <= 0) {
            continue;
        }
        if (dealerBj) {
            const payout = insuranceWinPayout(insBet);
            const result = appendBoxLedgerEntry(nextSession, nextLedger, bankrollCtx, playerId, 'win-paid', payout, `Insurance wins 2:1 (+${payout} chips)`, session.currentRound);
            nextSession = result.session;
            nextLedger = result.ledger;
            if (bankId) {
                const winnings = payout - insBet;
                const bankResult = appendBankLedgerEntry(nextSession, nextLedger, bankId, -winnings, `Insurance payout ${winnings} chips`, session.currentRound);
                nextSession = bankResult.session;
                nextLedger = bankResult.ledger;
            }
        }
        else if (bankId) {
            const bankResult = appendBankLedgerEntry(nextSession, nextLedger, bankId, insBet, `Insurance lost — house collected ${insBet} chips`, session.currentRound);
            nextSession = bankResult.session;
            nextLedger = bankResult.ledger;
        }
    }
    return { session: nextSession, players, ledger: nextLedger };
}
