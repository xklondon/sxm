import { resolveControllerPersonId } from '../session';
import { getAssignedSlotForPerson } from '../session/playerAssignment';
import { defaultBlackjackSeatId } from '../session/table';
export function findBoxSlot(state, boxId) {
    return state.tableMeta.boxSlots.find((s) => s.playerId === boxId);
}
function slotByNumber(state, slotNumber) {
    return state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber);
}
/**
 * Resolve chip/bet placement from a slot (and optional box hint).
 * Empty slots always return slotNumber so the server can materialize the box.
 */
export function getChipPlacementTarget(state, input) {
    const slot = slotByNumber(state, input.slotNumber);
    if (!slot) {
        throw new Error(`Invalid slot ${input.slotNumber}`);
    }
    if (slot.playerId) {
        return { kind: 'box', boxId: slot.playerId };
    }
    return { kind: 'slot', slotNumber: input.slotNumber };
}
/** Resolve a boxId hint; online mode falls back to slotNumber when the box is not on the table. */
export function getChipPlacementTargetFromBoxId(state, boxId, online) {
    const slot = findBoxSlot(state, boxId);
    if (slot?.playerId) {
        return { kind: 'box', boxId: slot.playerId };
    }
    if (online) {
        const slotNum = state.session.boxSlotNumbers?.[boxId];
        if (slotNum != null) {
            const row = slotByNumber(state, slotNum);
            if (row?.playerId) {
                return { kind: 'box', boxId: row.playerId };
            }
            if (row) {
                return { kind: 'slot', slotNumber: slotNum };
            }
        }
        throw new Error(`Box not found (boxId=${boxId})`);
    }
    return { kind: 'box', boxId };
}
/** Online/mobile: never emit a stale client boxId when the slot occupant has rotated. */
export function coercePlaceBetTarget(state, target, online) {
    if (!online) {
        return target;
    }
    if (target.kind === 'slot') {
        return getChipPlacementTarget(state, { slotNumber: target.slotNumber });
    }
    return getChipPlacementTargetFromBoxId(state, target.boxId, true);
}
export function placeBetPayloadFromTarget(target, amount) {
    if (target.kind === 'box') {
        return { boxId: target.boxId, amount };
    }
    return { slotNumber: target.slotNumber, amount };
}
function isValidBetTarget(state, target, online) {
    if (target.kind === 'box') {
        if (online) {
            return findBoxSlot(state, target.boxId) !== undefined;
        }
        return Boolean(state.players[target.boxId]);
    }
    const slot = slotByNumber(state, target.slotNumber);
    return slot !== undefined && !slot.playerId;
}
/**
 * @deprecated Legacy chip-tray resolver — Panel uses slot-only localChipTargetSelection.
 */
export function resolveChipTrayBetTarget(state, controllerName, lastTarget, online) {
    if (lastTarget && isValidBetTarget(state, lastTarget, online)) {
        return lastTarget;
    }
    const personId = resolveControllerPersonId(state, controllerName);
    if (personId) {
        const assigned = getAssignedSlotForPerson(state, personId);
        if (assigned != null) {
            return getChipPlacementTarget(state, { slotNumber: assigned });
        }
    }
    const defaultId = defaultBlackjackSeatId(state);
    if (defaultId) {
        try {
            return getChipPlacementTargetFromBoxId(state, defaultId, online);
        }
        catch {
            return null;
        }
    }
    return null;
}
export function formatPlaceBetError(err) {
    return err instanceof Error ? err.message : 'Action failed';
}
