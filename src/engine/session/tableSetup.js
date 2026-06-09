import { updateBlackjackFlowSettings } from '../blackjack';
import { setBlackjackProtocolOnState } from '../blackjack/protocolState';
import { assignBankBot, assignBankPerson, } from './boxOps';
import { ensureTableOwnerPersonBankroll } from './ownerBankroll';
import { setTableOwner } from './invites';
import { confirmTableAgreement, DEFAULT_TABLE_CHIPS, } from './table';
import { logDerivedBalances, logLedgerAfterAllocation, logTableMetaStartingChips, } from './tokens';
import { DEFAULT_PRACTICE_TABLE_NAME } from '../../types/tableFeltSkin';
export function parseTableStakeSetupPayload(payload, fallbackController) {
    const seatChips = Number(payload.seatChips);
    const bankChips = Number(payload.bankChips);
    const bankerMode = payload.bankerMode;
    return {
        stakeDescription: String(payload.stakeDescription ?? 'Friendly game'),
        tableName: typeof payload.tableName === 'string' ? payload.tableName : undefined,
        seatChips: Number.isFinite(seatChips) && seatChips > 0 ? seatChips : DEFAULT_TABLE_CHIPS,
        bankChips: Number.isFinite(bankChips) && bankChips > 0 ? bankChips : DEFAULT_TABLE_CHIPS,
        bankerMode: bankerMode === 'self' || bankerMode === 'other' ? bankerMode : 'bot',
        bankerName: String(payload.bankerName ?? ''),
        controllerName: String(payload.controllerName ?? fallbackController).trim() || fallbackController,
        controllerEmail: String(payload.controllerEmail ?? ''),
        protocolId: String(payload.protocolId ?? 'las-vegas-house'),
        naturalDealing: payload.naturalDealing === true,
        dealSpeedPreset: payload.dealSpeedPreset ?? 'fast',
        cardTimerPreset: (Number(payload.cardTimerPreset) || 0),
        bankDrawAuto: payload.bankDrawAuto !== false,
        tableMode: payload.tableMode === 'practice' || payload.tableMode === 'challenge'
            ? payload.tableMode
            : undefined,
        invitedEmails: Array.isArray(payload.invitedEmails)
            ? payload.invitedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
            : undefined,
    };
}
export function resolveTableMode(input) {
    if (input.tableMode) {
        return input.tableMode;
    }
    return input.bankerMode === 'bot' ? 'practice' : 'challenge';
}
/** First-time table setup (new table or post–stake-panel confirm). */
export function applyTableStakeSetup(state, input) {
    const seatAmount = input.seatChips;
    const bankAmount = input.bankChips;
    const tableMode = resolveTableMode(input);
    const isPractice = tableMode === 'practice';
    const stakeDescription = isPractice
        ? input.stakeDescription.trim() || 'Practice'
        : input.stakeDescription.trim() || 'Friendly wager';
    const tableClothName = isPractice
        ? input.tableName?.trim() || DEFAULT_PRACTICE_TABLE_NAME
        : input.tableName?.trim() || stakeDescription;
    let next = confirmTableAgreement(state, stakeDescription, seatAmount, bankAmount);
    next = setTableOwner(next, input.controllerName, input.controllerEmail);
    const invitedEmails = (input.invitedEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
    next = {
        ...next,
        tableMeta: {
            ...next.tableMeta,
            controllerName: input.controllerName,
            showBankerSetup: false,
            showStakeSetup: false,
            tableMode,
            setupInvitedEmails: invitedEmails.length > 0 ? invitedEmails : undefined,
            tableClothName,
            tableClothWager: isPractice ? 'Practice' : stakeDescription,
        },
    };
    if (isPractice || input.bankerMode === 'bot') {
        next = assignBankBot(next, bankAmount);
    }
    else if (input.bankerMode === 'self') {
        next = assignBankPerson(next, input.controllerName, bankAmount);
    }
    else {
        next = assignBankPerson(next, input.bankerName.trim(), bankAmount);
    }
    next = ensureTableOwnerPersonBankroll(next);
    logLedgerAfterAllocation(next, 'start-playing');
    logDerivedBalances(next, 'start-playing');
    logTableMetaStartingChips(next, 'start-playing');
    next = setBlackjackProtocolOnState(next, input.protocolId, input.controllerName);
    next = updateBlackjackFlowSettings(next, {
        initialDealMode: input.naturalDealing ? 'natural' : 'staged',
        dealSpeedPreset: input.dealSpeedPreset,
        cardTimerPreset: input.cardTimerPreset,
        countdownSeconds: input.cardTimerPreset,
        bankDrawMode: input.bankDrawAuto ? 'auto' : 'manual',
    });
    return next;
}
