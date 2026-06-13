import { shuffleToStartOnState, completeStepwiseInitialDealIfNeeded, dealCardsButtonOnState, hitBlackjackOnState, standBlackjackOnState, doubleDownBlackjackOnState, splitBlackjackOnState, takeInsuranceOnState, declineInsuranceOnState, takeInsuranceForPersonOnState, declineInsuranceForPersonOnState, takeEvenMoneyOnState, waitForBlackjackPayoutOnState, startNextRoundOnState, processPlayFlowAutoStands, syncBankPhaseOnState, resolveBankTurnAuto, } from './gameState';
/**
 * Canonical blackjack gameplay actions. These carry rule behavior (phase
 * transitions, dealing, hitting, auto-stand, insurance, settlement, next round)
 * and MUST resolve identically online and offline. Pure table/session ops
 * (assignBox, placeBet, retractChip, clearBet, addGameToPersonalLedger) are not
 * listed here — they mutate seating/stakes/ledger only and are applied directly.
 */
export const BLACKJACK_GAMEPLAY_ACTIONS = [
    'shuffleToStart',
    'dealCards',
    'hit',
    'stand',
    'double',
    'split',
    'takeInsurance',
    'declineInsurance',
    'takeEvenMoney',
    'waitFor3to2',
    'nextRound',
];
export function isBlackjackGameplayAction(action) {
    return BLACKJACK_GAMEPLAY_ACTIONS.includes(action);
}
/**
 * Single canonical reducer for blackjack gameplay actions, shared by the online
 * server action layer and (by construction over the same engine functions) the
 * offline local path. Player-turn actions (hit/stand/double/split) ignore any
 * client-supplied handKey and resolve against `state.blackjack.activeHandKey`.
 */
export function applyBlackjackActionToState(state, action, ctx) {
    let next;
    switch (action) {
        case 'shuffleToStart':
            next = shuffleToStartOnState(state);
            break;
        case 'dealCards': {
            next = syncBankPhaseOnState(processPlayFlowAutoStands(completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state))));
            break;
        }
        case 'hit':
            next = hitBlackjackOnState(state);
            break;
        case 'stand':
            next = standBlackjackOnState(state);
            break;
        case 'double':
            next = doubleDownBlackjackOnState(state);
            break;
        case 'split':
            next = splitBlackjackOnState(state);
            break;
        case 'takeInsurance': {
            const personId = ctx.payload.personId;
            next = personId
                ? takeInsuranceForPersonOnState(state, personId)
                : takeInsuranceOnState(state, ctx.payload.playerId);
            break;
        }
        case 'declineInsurance': {
            const personId = ctx.payload.personId;
            next = personId
                ? declineInsuranceForPersonOnState(state, personId)
                : declineInsuranceOnState(state, ctx.payload.playerId);
            break;
        }
        case 'takeEvenMoney':
            next = takeEvenMoneyOnState(state, ctx.payload.handKey);
            break;
        case 'waitFor3to2':
            next = waitForBlackjackPayoutOnState(state, ctx.payload.handKey);
            break;
        case 'nextRound':
            next = startNextRoundOnState(state);
            break;
        default: {
            const exhaustive = action;
            throw new Error(`Unhandled blackjack action: ${String(exhaustive)}`);
        }
    }
    if (ctx.resolveBankAuto) {
        next = resolveBankTurnAuto(next);
    }
    return next;
}
