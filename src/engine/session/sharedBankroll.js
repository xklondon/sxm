import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { bankRepresentsTableOwner } from '../scoreLedger/gameEndIou';
import { getTotalCommittedExposureForPerson } from './playerCommittedExposure';

function normalizeLabel(value) {
    return value?.trim().toLowerCase() ?? '';
}

function participantLabel(state, participantId) {
    const player = state.players[participantId];
    return normalizeLabel(player?.controllerName?.trim() || player?.displayName);
}

/** True when two ledger participants represent the same human sharing one chip pot. */
export function personsShareOneChipPot(state, idA, idB) {
    if (idA === idB) {
        return true;
    }
    const labelA = participantLabel(state, idA);
    const labelB = participantLabel(state, idB);
    if (labelA && labelA === labelB) {
        return true;
    }
    const bankId = state.session.bankPlayerId;
    const ownerId = state.tableMeta.ownerPersonId;
    if (bankId && ownerId && bankRepresentsTableOwner(state, bankId)) {
        const pair = new Set([idA, idB]);
        if (pair.has(bankId) && pair.has(ownerId)) {
            return true;
        }
    }
    const setup = state.tableMeta.bankerSetup;
    if (setup.mode === 'person' && setup.playerId) {
        const setupName = normalizeLabel(setup.displayName);
        if (setupName) {
            const aMatchesSetup = setup.playerId === idA || labelA === setupName;
            const bMatchesSetup = setup.playerId === idB || labelB === setupName;
            if (aMatchesSetup && bMatchesSetup) {
                return true;
            }
        }
    }
    return false;
}

/** Ledger owner for a shared pot — bank seat holds the house stack when bank+player are one person. */
export function resolveCanonicalBankrollOwnerId(state, bankrollOwnerId) {
    const bankId = state.session.bankPlayerId;
    if (!bankId || bankId === bankrollOwnerId) {
        return bankrollOwnerId;
    }
    if (personsShareOneChipPot(state, bankrollOwnerId, bankId)) {
        return bankId;
    }
    return bankrollOwnerId;
}

/** All ledger participant ids that draw from the same shared pot. */
export function listSharedPotBankrollOwnerIds(state, bankrollOwnerId) {
    const bankId = state.session.bankPlayerId;
    if (!bankId || !personsShareOneChipPot(state, bankrollOwnerId, bankId)) {
        return [bankrollOwnerId];
    }
    const ids = new Set([bankId, bankrollOwnerId]);
    const ownerId = state.tableMeta.ownerPersonId;
    if (ownerId) {
        ids.add(ownerId);
    }
    for (const id of state.session.playerIds) {
        if (personsShareOneChipPot(state, id, bankId)) {
            ids.add(id);
        }
    }
    return [...ids];
}

/** Shared-pot ledger balance — never double-count duplicate person+bank allocations. */
export function getSharedPotLedgerBalance(state, bankrollOwnerId) {
    const canonical = resolveCanonicalBankrollOwnerId(state, bankrollOwnerId);
    return derivePlayerBalanceFromLedger(canonical, state.ledger);
}

/** Committed exposure across every box attributed to the shared pot. */
export function getSharedPotBettingExposure(state, bankrollOwnerId) {
    const linked = listSharedPotBankrollOwnerIds(state, bankrollOwnerId);
    let exposure = 0;
    for (const id of linked) {
        exposure += getTotalCommittedExposureForPerson(state, id);
    }
    return exposure;
}

/** Tray / validation available for a shared pot. */
export function getSharedPotAvailableChips(state, bankrollOwnerId) {
    return (getSharedPotLedgerBalance(state, bankrollOwnerId) -
        getSharedPotBettingExposure(state, bankrollOwnerId));
}

/** True when this participant uses the bank ledger as the single chip pot. */
export function usesSharedBankPlayerPot(state, bankrollOwnerId) {
    const bankId = state.session.bankPlayerId;
    if (!bankId) {
        return false;
    }
    return personsShareOneChipPot(state, bankrollOwnerId, bankId);
}
