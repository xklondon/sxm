import { log } from '../../utils/logger';
import { addPlayer, mergeSessionUpdate } from './session';
import { listPersonBankrollOwnerIds } from './bankroll';
import { MAX_TABLE_BOXES } from '../../types/table';
function slotByNumber(state, slotNumber) {
    return state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber);
}
/** Ordered person bankroll ids — owner first, then others. */
export function getEffectivePlayerOrder(state) {
    const known = listPersonBankrollOwnerIds(state);
    const ownerId = state.tableMeta.ownerPersonId;
    const saved = state.tableMeta.playerOrder ?? [];
    const order = [];
    for (const id of saved) {
        if (known.includes(id) && !order.includes(id)) {
            order.push(id);
        }
    }
    if (ownerId && known.includes(ownerId) && !order.includes(ownerId)) {
        order.unshift(ownerId);
    }
    for (const id of known) {
        if (!order.includes(id)) {
            order.push(id);
        }
    }
    return order;
}
export function computeAssignedBoxByPersonId(playerOrder) {
    const map = {};
    playerOrder.forEach((personId, index) => {
        if (index < MAX_TABLE_BOXES) {
            map[personId] = index + 1;
        }
    });
    return map;
}
export function getAssignedSlotForPerson(state, personId) {
    return state.tableMeta.assignedBoxByPersonId?.[personId] ?? null;
}
export function getNativeAssignedPersonForSlot(state, slotNumber) {
    const slot = slotByNumber(state, slotNumber);
    return slot?.nativeAssignedPersonId ?? null;
}
function findSlotByBoxPlayerId(state, boxPlayerId) {
    return state.tableMeta.boxSlots.find((s) => s.playerId === boxPlayerId);
}
/** Ensure a box position exists at slot for person — no chip allocation. */
export function ensureBoxPositionForPerson(state, slotNumber, personId) {
    if (slotNumber < 1 || slotNumber > MAX_TABLE_BOXES) {
        return state;
    }
    const slot = slotByNumber(state, slotNumber);
    if (!slot) {
        return state;
    }
    let next = state;
    if (slot.playerId) {
        const boxSlots = next.tableMeta.boxSlots.map((s) => s.slotNumber === slotNumber
            ? { ...s, nativeAssignedPersonId: personId, bankrollOwnerId: s.bankrollOwnerId ?? personId }
            : s);
        return { ...next, tableMeta: { ...next.tableMeta, boxSlots } };
    }
    const person = next.players[personId];
    if (!person) {
        return state;
    }
    const controller = person.controllerName?.trim() || person.displayName;
    const boxSpl = addPlayer(next.session, next.players, next.ledger, {
        displayName: `Box ${slotNumber}`,
        controllerName: controller,
        role: 'box',
        bankrollOwnerId: personId,
        startingChips: 0,
    });
    next = mergeSessionUpdate(next, boxSpl);
    const boxPlayerId = boxSpl.session.playerIds[boxSpl.session.playerIds.length - 1];
    const boxSlots = next.tableMeta.boxSlots.map((s) => s.slotNumber === slotNumber
        ? {
            ...s,
            playerId: boxPlayerId,
            bankrollOwnerId: personId,
            nativeAssignedPersonId: personId,
        }
        : s);
    log.info('nativeBoxPositionEnsured', { slotNumber, personId, boxPlayerId });
    return {
        ...next,
        session: {
            ...next.session,
            boxSlotNumbers: {
                ...next.session.boxSlotNumbers,
                [boxPlayerId]: slotNumber,
            },
        },
        tableMeta: { ...next.tableMeta, boxSlots },
    };
}
/** Sync player order, assigned boxes, and native box positions. */
export function syncPlayerOrderAndAssignments(state) {
    const playerOrder = getEffectivePlayerOrder(state);
    const assignedBoxByPersonId = computeAssignedBoxByPersonId(playerOrder);
    let next = {
        ...state,
        tableMeta: {
            ...state.tableMeta,
            playerOrder,
            assignedBoxByPersonId,
        },
    };
    for (const personId of playerOrder) {
        const slotNumber = assignedBoxByPersonId[personId];
        if (slotNumber) {
            next = ensureBoxPositionForPerson(next, slotNumber, personId);
        }
    }
    return next;
}
export function movePlayerInOrder(state, personId, direction) {
    const order = getEffectivePlayerOrder(state);
    const index = order.indexOf(personId);
    if (index < 0) {
        return state;
    }
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= order.length) {
        return state;
    }
    const oldSlot = index + 1;
    const newSlot = swapIndex + 1;
    const otherPersonId = order[swapIndex];
    const oldBoxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === oldSlot)?.playerId;
    const otherBoxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === newSlot)?.playerId;
    const nextOrder = [...order];
    nextOrder[index] = otherPersonId;
    nextOrder[swapIndex] = personId;
    let next = {
        ...state,
        tableMeta: {
            ...state.tableMeta,
            playerOrder: nextOrder,
            assignedBoxByPersonId: computeAssignedBoxByPersonId(nextOrder),
        },
    };
    if (oldBoxId && otherBoxId) {
        const oldStake = state.tableMeta.boxStakes[oldBoxId];
        const otherStake = state.tableMeta.boxStakes[otherBoxId];
        const nextStakes = { ...state.tableMeta.boxStakes };
        if (oldStake) {
            nextStakes[otherBoxId] = oldStake;
        }
        else {
            delete nextStakes[otherBoxId];
        }
        if (otherStake) {
            nextStakes[oldBoxId] = otherStake;
        }
        else {
            delete nextStakes[oldBoxId];
        }
        next = { ...next, tableMeta: { ...next.tableMeta, boxStakes: nextStakes } };
    }
    next = syncPlayerOrderAndAssignments(next);
    log.info('playerOrderChanged', {
        personId,
        direction,
        playerOrder: next.tableMeta.playerOrder,
        assignedBoxByPersonId: next.tableMeta.assignedBoxByPersonId,
    });
    return next;
}
export function isSeatedPersonAtTable(state, personId) {
    return getEffectivePlayerOrder(state).includes(personId);
}
/** Decision owner for hit/stand/split/double/insurance on a box. */
export function getCallerPersonIdForBox(state, boxPlayerId) {
    const slot = findSlotByBoxPlayerId(state, boxPlayerId);
    // Native seat assignment always owns decisions on assigned boxes.
    if (slot?.nativeAssignedPersonId) {
        return slot.nativeAssignedPersonId;
    }
    // Unassigned: locked caller from deal lock, or first bettor during betting.
    if (slot?.callerPersonId) {
        return slot.callerPersonId;
    }
    const stake = state.tableMeta.boxStakes[boxPlayerId];
    if (stake?.callerPersonId) {
        return stake.callerPersonId;
    }
    // Solo play: one person may call every box on their bankroll during betting or play.
    if (isSinglePlayerTable(state) && slot?.bankrollOwnerId) {
        const hasStake = (stake?.amount ?? 0) > 0;
        const inPlay = state.blackjack?.status === 'player-turns' ||
            state.blackjack?.insuranceOfferPending === true;
        if (hasStake || inPlay) {
            return slot.bankrollOwnerId;
        }
    }
    return null;
}
export function isCallerForBox(state, boxPlayerId, personId) {
    const caller = getCallerPersonIdForBox(state, boxPlayerId);
    return caller !== null && caller === personId;
}
/** Single player at table may call every box they stake. */
export function isSinglePlayerTable(state) {
    return getEffectivePlayerOrder(state).length <= 1;
}
export function canControllerCallBox(state, boxPlayerId, controllerPersonId) {
    if (isSinglePlayerTable(state)) {
        return true;
    }
    return isCallerForBox(state, boxPlayerId, controllerPersonId);
}
function personLabelMatches(state, personId, names) {
    const person = state.players[personId];
    if (!person) {
        return false;
    }
    const label = (person.controllerName?.trim() || person.displayName || '').toLowerCase();
    return names.some((n) => n.toLowerCase() === label);
}
function collectNameCandidates(hints, state) {
    const out = [];
    for (const raw of [
        hints.profileName,
        hints.authDisplayName,
        state.tableMeta.controllerName,
    ]) {
        const t = raw?.trim();
        if (t && !out.includes(t)) {
            out.push(t);
        }
    }
    return out;
}
/**
 * Resolves the local viewer's seated person id for multiplayer action visibility.
 * Prefer stored id (invite join), then invite-email mapping, then display-name match.
 */
export function resolveViewerPersonId(state, hints) {
    const seated = new Set(getEffectivePlayerOrder(state));
    const stored = hints.storedViewerPersonId?.trim();
    if (stored && seated.has(stored)) {
        return stored;
    }
    const emails = [hints.profileEmail, hints.authEmail]
        .map((e) => e?.trim().toLowerCase())
        .filter((e) => Boolean(e));
    if (emails.length > 0) {
        const acceptedForViewer = state.tableMeta.invites.filter((inv) => inv.inviteStatus === 'accepted' &&
            emails.includes(inv.invitedEmail.trim().toLowerCase()));
        if (acceptedForViewer.length > 0) {
            for (const invite of acceptedForViewer) {
                const invitedName = invite.invitedName?.trim().toLowerCase();
                if (invitedName) {
                    for (const id of seated) {
                        const p = state.players[id];
                        const label = (p?.controllerName?.trim() || p?.displayName || '').toLowerCase();
                        if (label === invitedName) {
                            return id;
                        }
                    }
                }
            }
            const ownerId = state.tableMeta.ownerPersonId;
            const nonOwners = [...seated].filter((id) => id !== ownerId);
            if (nonOwners.length === 1) {
                return nonOwners[0];
            }
        }
    }
    const highlightId = state.tableMeta.joinHighlight?.personId;
    if (highlightId && seated.has(highlightId)) {
        const names = collectNameCandidates(hints, state);
        if (names.length === 0 || personLabelMatches(state, highlightId, names)) {
            return highlightId;
        }
    }
    const noticeId = state.tableMeta.tableNotice?.personId;
    if (noticeId && seated.has(noticeId)) {
        const names = collectNameCandidates(hints, state);
        if (names.length === 0 || personLabelMatches(state, noticeId, names)) {
            return noticeId;
        }
    }
    for (const name of collectNameCandidates(hints, state)) {
        const id = resolveControllerPersonId(state, name);
        if (id) {
            return id;
        }
    }
    if (isSinglePlayerTable(state) && state.tableMeta.ownerPersonId) {
        return state.tableMeta.ownerPersonId;
    }
    return null;
}
export function resolveControllerPersonId(state, controllerName) {
    const trimmed = controllerName.trim();
    if (!trimmed) {
        return null;
    }
    if (state.tableMeta.ownerPersonId) {
        const owner = state.players[state.tableMeta.ownerPersonId];
        const ownerLabel = owner?.controllerName?.trim() || owner?.displayName;
        if (ownerLabel?.toLowerCase() === trimmed.toLowerCase()) {
            return state.tableMeta.ownerPersonId;
        }
    }
    for (const id of listPersonBankrollOwnerIds(state)) {
        const p = state.players[id];
        const label = p?.controllerName?.trim() || p?.displayName;
        if (label?.toLowerCase() === trimmed.toLowerCase()) {
            return id;
        }
    }
    return null;
}
/** Lock caller on each eligible box when bets lock for deal. */
export function syncCallersForDeal(state, boxPlayerIds) {
    const boxSlots = state.tableMeta.boxSlots.map((slot) => {
        if (!slot.playerId || !boxPlayerIds.includes(slot.playerId)) {
            return slot;
        }
        const caller = slot.nativeAssignedPersonId ??
            state.tableMeta.boxStakes[slot.playerId]?.callerPersonId ??
            slot.bankrollOwnerId;
        return caller ? { ...slot, callerPersonId: caller } : slot;
    });
    return { ...state, tableMeta: { ...state.tableMeta, boxSlots } };
}
export function getCallerInitials(state, boxPlayerId) {
    const callerId = getCallerPersonIdForBox(state, boxPlayerId);
    if (!callerId) {
        return '';
    }
    const person = state.players[callerId];
    const name = person?.controllerName?.trim() || person?.displayName || '';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return '?';
    }
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}
