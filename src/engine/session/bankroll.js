import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { log } from '../../utils/logger';
import {
    getInRoundBetExposureForPerson,
    getOpenStakeExposureForPerson,
    getTotalCommittedExposureForPerson,
} from './playerCommittedExposure';
import { getSharedPotAvailableChips, getSharedPotBettingExposure, getSharedPotLedgerBalance, resolveCanonicalBankrollOwnerId, usesSharedBankPlayerPot, } from './sharedBankroll';
export function bankrollContextFromState(state) {
    return {
        players: state.players,
        boxSlots: state.tableMeta.boxSlots,
        bankPlayerId: state.session.bankPlayerId,
        boxSlotNumbers: state.session.boxSlotNumbers ?? {},
    };
}
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
/** Resolve ledger bankroll owner for a box position id. */
export function resolveBankrollOwnerIdForBox(state, boxPlayerId) {
    const raw = resolveBankrollOwnerId(bankrollContextFromState(state), boxPlayerId);
    return resolveCanonicalBankrollOwnerId(state, raw);
}
export function resolveBankrollOwnerId(ctx, boxPlayerId) {
    const slot = ctx.boxSlots.find((s) => s.playerId === boxPlayerId);
    if (slot?.bankrollOwnerId) {
        log.info('bankrollOwnerResolved', {
            boxPlayerId,
            bankrollOwnerId: slot.bankrollOwnerId,
            slotNumber: slot.slotNumber,
        });
        return slot.bankrollOwnerId;
    }
    const player = ctx.players[boxPlayerId];
    if (player?.bankrollOwnerId) {
        log.info('bankrollOwnerResolved', {
            boxPlayerId,
            bankrollOwnerId: player.bankrollOwnerId,
            slotNumber: ctx.boxSlotNumbers[boxPlayerId] ?? null,
        });
        return player.bankrollOwnerId;
    }
    log.info('bankrollOwnerResolved', {
        boxPlayerId,
        bankrollOwnerId: boxPlayerId,
        legacy: true,
    });
    return boxPlayerId;
}
export function findPersonPlayerIdByController(state, controllerName) {
    const needle = controllerName.trim().toLowerCase();
    if (!needle) {
        return null;
    }
    for (const id of state.session.playerIds) {
        if (id === state.session.bankPlayerId) {
            continue;
        }
        const p = state.players[id];
        if (!p) {
            continue;
        }
        if (p.role === 'box' || isBoxPosition(bankrollContextFromState(state), id)) {
            continue;
        }
        if (p.role === 'bank') {
            continue;
        }
        if (p.controllerName.trim().toLowerCase() === needle) {
            return id;
        }
    }
    return null;
}
export function getBoxIdsForBankrollOwner(state, bankrollOwnerId) {
    const ctx = bankrollContextFromState(state);
    return ctx.boxSlots
        .filter((s) => s.playerId && resolveBankrollOwnerId(ctx, s.playerId) === bankrollOwnerId)
        .map((s) => s.playerId);
}
export function getBoxSlotNumbersForBankrollOwner(state, bankrollOwnerId) {
    return getBoxIdsForBankrollOwner(state, bankrollOwnerId)
        .map((id) => state.session.boxSlotNumbers?.[id] ?? null)
        .filter((n) => n !== null)
        .sort((a, b) => a - b);
}
/** Open-table stakes across all boxes owned by one person. */
export function getTotalOpenStakesForBankrollOwner(state, bankrollOwnerId) {
    return getOpenStakeExposureForPerson(state, bankrollOwnerId);
}
/** In-round bet totals across all boxes for one person. */
export function getTotalInRoundBetsForBankrollOwner(state, bankrollOwnerId) {
    return getInRoundBetExposureForPerson(state, bankrollOwnerId);
}
export function getTotalBettingExposureForBankrollOwner(state, bankrollOwnerId) {
    if (usesSharedBankPlayerPot(state, bankrollOwnerId)) {
        return getSharedPotBettingExposure(state, bankrollOwnerId);
    }
    return getTotalCommittedExposureForPerson(state, bankrollOwnerId);
}
export function getLedgerBalanceForBankrollOwner(state, bankrollOwnerId) {
    if (usesSharedBankPlayerPot(state, bankrollOwnerId)) {
        return getSharedPotLedgerBalance(state, bankrollOwnerId);
    }
    return derivePlayerBalanceFromLedger(bankrollOwnerId, state.ledger);
}
export function getAvailableChipsForBankrollOwner(state, bankrollOwnerId) {
    if (usesSharedBankPlayerPot(state, bankrollOwnerId)) {
        return getSharedPotAvailableChips(state, bankrollOwnerId);
    }
    return (getLedgerBalanceForBankrollOwner(state, bankrollOwnerId) -
        getTotalBettingExposureForBankrollOwner(state, bankrollOwnerId));
}
/** Person + bank participants that hold ledger bankrolls. */
export function listBankrollParticipantIds(state) {
    const ctx = bankrollContextFromState(state);
    const ids = new Set();
    if (ctx.bankPlayerId) {
        ids.add(ctx.bankPlayerId);
    }
    for (const id of state.session.playerIds) {
        if (isBoxPosition(ctx, id)) {
            continue;
        }
        if (isBankParticipant(ctx, id)) {
            ids.add(id);
            continue;
        }
        if (state.players[id]?.role === 'person' || !state.players[id]?.role) {
            if (!ctx.boxSlotNumbers[id]) {
                ids.add(id);
            }
        }
    }
    for (const slot of ctx.boxSlots) {
        if (slot.bankrollOwnerId) {
            ids.add(slot.bankrollOwnerId);
        }
    }
    return [...ids];
}
export function isLedgerParticipant(state, participantId) {
    return listBankrollParticipantIds(state).includes(participantId);
}
/** Distinct person bankroll owner IDs — never box positions. */
export function listPersonBankrollOwnerIds(state) {
    const bankId = state.session.bankPlayerId;
    const ctx = bankrollContextFromState(state);
    const ids = new Set();
    const ownerPersonId = state.tableMeta.ownerPersonId;
    if (ownerPersonId && ownerPersonId !== bankId) {
        ids.add(ownerPersonId);
    }
    for (const slot of ctx.boxSlots) {
        if (slot.bankrollOwnerId && slot.bankrollOwnerId !== bankId) {
            ids.add(slot.bankrollOwnerId);
        }
    }
    for (const id of state.session.playerIds) {
        if (id === bankId) {
            continue;
        }
        const p = ctx.players[id];
        if (!p) {
            continue;
        }
        if (isBoxPosition(ctx, id)) {
            continue;
        }
        if (p.role === 'person' || !p.role) {
            ids.add(id);
        }
    }
    return [...ids];
}
export function logAccountsPanelPeopleBalances(rows) {
    log.info('accountsPanelPeopleBalances', { rows });
}
