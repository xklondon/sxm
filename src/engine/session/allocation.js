import { appendLedgerEntry, deriveAllBalancesFromLedger, derivePlayerBalanceFromLedger, } from '../ledger/ledger';
import { log } from '../../utils/logger';
import { mergeSessionUpdate } from './session';
import { addPlayer } from './session';
import { bankrollContextFromState, isLedgerParticipant } from './bankroll';
function isBoxPosition(ctx, playerId) {
    const p = ctx.players[playerId];
    if (p?.role === 'box') {
        return true;
    }
    return Boolean(ctx.boxSlotNumbers[playerId]);
}
function isBankParticipant(ctx, playerId) {
    return playerId === ctx.bankPlayerId || ctx.players[playerId]?.role === 'bank';
}
function descriptionForAllocation(reason, chips, note) {
    const trimmed = note?.trim();
    if (trimmed) {
        return trimmed;
    }
    switch (reason) {
        case 'initial-bank':
            return `Bank starting allocation: ${chips} chips`;
        case 'initial-player':
            return `Player starting allocation: ${chips} chips`;
        case 'owner-top-up':
            return `Top-up: ${chips} chips`;
        case 'adjustment':
            return `Adjustment: +${chips} chips`;
        default:
            return `Chip allocation: ${chips} chips`;
    }
}
function ledgerEntryTypeForReason(reason) {
    return reason === 'adjustment' ? 'manual-adjustment' : 'buy-in';
}
/** Bankroll owner must be bank or person — never a box position or controller name. */
export function assertBankrollOwnerId(state, bankrollOwnerId) {
    const ctx = bankrollContextFromState(state);
    if (isBoxPosition(ctx, bankrollOwnerId)) {
        throw new Error(`Cannot allocate chips to box position id ${bankrollOwnerId}`);
    }
    if (!state.session.playerIds.includes(bankrollOwnerId)) {
        throw new Error(`Bankroll owner ${bankrollOwnerId} is not registered in session.playerIds`);
    }
    const player = state.players[bankrollOwnerId];
    if (!player) {
        throw new Error(`Bankroll owner ${bankrollOwnerId} has no player record`);
    }
    if (isBankParticipant(ctx, bankrollOwnerId)) {
        return;
    }
    if (player.role === 'person' || !player.role) {
        return;
    }
    throw new Error(`Bankroll owner ${bankrollOwnerId} must be bank or person, got role ${player.role ?? 'unknown'}`);
}
/**
 * Canonical chip allocation — append ledger entry only; no direct balance mutation.
 * bankrollOwnerId = bank player id or person bankroll id (never box id).
 */
export function allocateChipsToBankrollOwner(state, input) {
    const { bankrollOwnerId, reason, note, source, actorId, boxId } = input;
    assertBankrollOwnerId(state, bankrollOwnerId);
    const chips = Math.floor(input.amount);
    if (chips <= 0) {
        throw new Error('Allocation amount must be a positive integer');
    }
    const balanceBefore = derivePlayerBalanceFromLedger(bankrollOwnerId, state.ledger);
    const description = descriptionForAllocation(reason, chips, note);
    const entryType = ledgerEntryTypeForReason(reason);
    const result = appendLedgerEntry(state.session, state.ledger, {
        playerId: bankrollOwnerId,
        entryType,
        amount: chips,
        description,
    });
    const balanceAfter = derivePlayerBalanceFromLedger(bankrollOwnerId, result.ledger);
    const player = state.players[bankrollOwnerId];
    log.info('allocateChipsCanonical', {
        bankrollOwnerId,
        chips,
        reason,
        source,
        actorId: actorId ?? null,
        boxId: boxId ?? null,
        description,
        balanceBefore,
        balanceAfter,
        bankPlayerId: state.session.bankPlayerId,
    });
    return {
        ...state,
        session: result.session,
        ledger: result.ledger,
        players: {
            ...state.players,
            [bankrollOwnerId]: {
                ...player,
                startingBalance: balanceAfter,
            },
        },
    };
}
/** @deprecated Use allocateChipsToBankrollOwner */
export function assertLedgerParticipant(state, participantId) {
    if (!state.session.playerIds.includes(participantId)) {
        throw new Error(`Participant ${participantId} is not registered in session.playerIds`);
    }
    if (!state.players[participantId]) {
        throw new Error(`Participant ${participantId} has no player record`);
    }
    if (!isLedgerParticipant(state, participantId)) {
        throw new Error(`Participant ${participantId} is not a ledger bankroll holder`);
    }
}
function chipReasonToAllocation(reason, state, participantId) {
    if (reason === 'adjustment') {
        return 'adjustment';
    }
    const ctx = bankrollContextFromState(state);
    if (isBankParticipant(ctx, participantId)) {
        return reason === 'starting-allocation' ? 'initial-bank' : 'owner-top-up';
    }
    return reason === 'starting-allocation' ? 'initial-player' : 'owner-top-up';
}
/** @deprecated Wraps allocateChipsToBankrollOwner — prefer canonical API directly. */
export function allocateChipsToParticipant(state, participantId, amount, reason, note, source = 'setup') {
    return allocateChipsToBankrollOwner(state, {
        bankrollOwnerId: participantId,
        amount,
        reason: chipReasonToAllocation(reason, state, participantId),
        note,
        source,
    });
}
/** Create a table participant (box/bank/person) with zero balance, then allocate via canonical API. */
export function createParticipantWithAllocation(state, input, amount, reason = 'starting-allocation', source = 'setup') {
    const spl = addPlayer(state.session, state.players, state.ledger, {
        ...input,
        startingChips: 0,
    });
    let next = mergeSessionUpdate(state, spl);
    const participantId = spl.session.playerIds[spl.session.playerIds.length - 1];
    if (amount > 0) {
        next = allocateChipsToParticipant(next, participantId, amount, reason, undefined, source);
    }
    return { state: next, participantId };
}
export function logLedgerAfterAllocation(state, context) {
    log.info('ledgerAfterAllocation', {
        context,
        entryCount: state.ledger.entries.length,
        entries: state.ledger.entries.map((e) => ({
            playerId: e.playerId,
            type: e.entryType,
            amount: e.amount,
            balanceAfter: e.balanceAfter,
            description: e.description,
        })),
    });
}
export function logDerivedBalances(state, context) {
    const balances = deriveAllBalancesFromLedger(state.session, state.ledger);
    log.info('derivedBalances', {
        context,
        bankPlayerId: state.session.bankPlayerId,
        bankBalance: state.session.bankPlayerId ? balances[state.session.bankPlayerId] : null,
        boxSlots: state.tableMeta.boxSlots
            .filter((s) => s.playerId)
            .map((s) => ({
            slotNumber: s.slotNumber,
            playerId: s.playerId,
            bankrollOwnerId: s.bankrollOwnerId,
        })),
        all: balances,
    });
}
export function logAccountPanelBalances(state, rows) {
    log.info('accountPanelBalances', {
        bankPlayerId: state.session.bankPlayerId,
        rows,
    });
}
