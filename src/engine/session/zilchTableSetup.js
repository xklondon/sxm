import { DEFAULT_ZILCH_DICE_ANIMATION } from '../zilch/settings';
import { startZilchGameOnState } from '../zilch/applyZilchAction';
import { assignBankBot, assignBankPerson, } from './boxOps';
import { ensureTableOwnerPersonBankroll } from './ownerBankroll';
import { setTableOwner } from './invites';
import { confirmTableAgreement, DEFAULT_TABLE_CHIPS, } from './table';
import { logDerivedBalances, logLedgerAfterAllocation, logTableMetaStartingChips, } from './tokens';
import { ensureZilchTableIdentity } from './tableKind';
export function parseZilchTableStakePayload(payload, fallbackController) {
    const base = {
        stakeDescription: String(payload.stakeDescription ?? 'Friendly game'),
        seatChips: Number(payload.seatChips) || DEFAULT_TABLE_CHIPS,
        bankChips: Number(payload.bankChips) || DEFAULT_TABLE_CHIPS,
        bankerMode: payload.bankerMode ?? 'bot',
        bankerName: String(payload.bankerName ?? ''),
        controllerName: String(payload.controllerName ?? fallbackController).trim() || fallbackController,
        controllerEmail: String(payload.controllerEmail ?? ''),
        protocolId: 'zilch',
        naturalDealing: false,
        dealSpeedPreset: 'normal',
        cardTimerPreset: 0,
        bankDrawAuto: true,
    };
    const mode = payload.zilchMode === 'fixed_rounds' ? 'fixed_rounds' : 'target_points';
    return {
        ...base,
        zilchMode: mode,
        targetPoints: Number(payload.targetPoints) || 100,
        roundLimit: Number(payload.roundLimit) || 10,
        diceAnimationMode: payload.diceAnimationMode === 'random' ? 'random' : 'fixed',
        diceAnimationMs: Number(payload.diceAnimationMs) || DEFAULT_ZILCH_DICE_ANIMATION.diceAnimationMs,
        diceAnimationRandomMinMs: Number(payload.diceAnimationRandomMinMs) || DEFAULT_ZILCH_DICE_ANIMATION.diceAnimationRandomMinMs,
        diceAnimationRandomMaxMs: Number(payload.diceAnimationRandomMaxMs) || DEFAULT_ZILCH_DICE_ANIMATION.diceAnimationRandomMaxMs,
    };
}
export function applyZilchTableStakeSetup(state, input) {
    const seatAmount = input.seatChips;
    const bankAmount = input.bankChips;
    const showPlayingFor = input.bankerMode === 'bot';
    const stakeDescription = showPlayingFor
        ? input.stakeDescription.trim() || 'Friendly wager'
        : 'Table session';
    let next = confirmTableAgreement(state, stakeDescription, seatAmount, bankAmount);
    next = setTableOwner(next, input.controllerName, input.controllerEmail);
    next = {
        ...next,
        tableMeta: {
            ...next.tableMeta,
            controllerName: input.controllerName,
            showBankerSetup: false,
            showStakeSetup: false,
            gameCategory: 'dice',
            diceGame: 'zilch',
        },
        zilchSettings: {
            mode: input.zilchMode,
            targetPoints: input.targetPoints,
            roundLimit: input.roundLimit,
            diceAnimation: {
                diceAnimationMode: input.diceAnimationMode,
                diceAnimationMs: input.diceAnimationMs,
                diceAnimationRandomMinMs: input.diceAnimationRandomMinMs,
                diceAnimationRandomMaxMs: input.diceAnimationRandomMaxMs,
            },
        },
    };
    if (input.bankerMode === 'bot') {
        next = assignBankBot(next, bankAmount);
    }
    else if (input.bankerMode === 'self') {
        next = assignBankPerson(next, input.controllerName, bankAmount);
    }
    else {
        next = assignBankPerson(next, input.bankerName.trim(), bankAmount);
    }
    next = ensureTableOwnerPersonBankroll(next);
    logLedgerAfterAllocation(next, 'zilch-start');
    logDerivedBalances(next, 'zilch-start');
    logTableMetaStartingChips(next, 'zilch-start');
    return ensureZilchTableIdentity(next);
}
export function beginZilchPlay(state) {
    if (state.session.gameType !== 'zilch' && state.tableGame !== 'zilch') {
        throw new Error('Not a Zilch table');
    }
    const playerIds = state.session.playerIds.length > 0
        ? state.session.playerIds
        : state.tableMeta.boxSlots
            .map((s) => s.playerId)
            .filter((id) => Boolean(id));
    if (playerIds.length === 0) {
        throw new Error('Add at least one player before starting Zilch');
    }
    if (state.zilch && state.zilch.phase !== 'setup') {
        return state;
    }
    return startZilchGameOnState(state, playerIds, state.zilchSettings);
}
