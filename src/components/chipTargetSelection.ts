import type { GameState } from '../types';
import type { PlaceBetTarget } from '../engine/blackjack/chipPlacement';
import { getAssignedSlotForPerson } from '../engine/session/playerAssignment';

/** Viewer native assigned box player id, when the slot is occupied. */
export function resolveViewerAssignedBoxPlayerId(
  state: GameState,
  viewerPersonId: string | null,
): string | null {
  if (!viewerPersonId) {
    return null;
  }
  const slotNumber = getAssignedSlotForPerson(state, viewerPersonId);
  if (slotNumber == null) {
    return null;
  }
  return state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber)?.playerId ?? null;
}

/** True when a box id still exists on the table for chip placement. */
export function isBoxChipTargetOnTable(
  state: GameState,
  boxId: string,
  online: boolean,
): boolean {
  if (online) {
    const occupiedSlot = state.tableMeta.boxSlots.find((s) => s.playerId === boxId);
    if (occupiedSlot) {
      return true;
    }
    const slotNum = state.session.boxSlotNumbers?.[boxId];
    if (slotNum != null) {
      const row = state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNum);
      // Slot row mapping alone is not enough — occupant must match (avoids stale optimistic ids).
      return row?.playerId === boxId;
    }
    return false;
  }
  return Boolean(state.players[boxId]);
}

/**
 * Resolve the tray/drop chip target from the player's explicit local selection only.
 * Never falls back to selectedSeatId, assigned box, or first box.
 */
export function resolveLocalChipTrayTarget(
  state: GameState,
  opts: {
    userPicked: boolean;
    explicit: PlaceBetTarget | null;
    online: boolean;
  },
): PlaceBetTarget | null {
  if (!opts.userPicked || !opts.explicit) {
    return null;
  }

  const { explicit, online } = opts;
  if (explicit.kind === 'slot') {
    const slot = state.tableMeta.boxSlots.find((s) => s.slotNumber === explicit.slotNumber);
    if (!slot) {
      return null;
    }
    if (slot.playerId && (!online || explicit.slotNumber === 1)) {
      return { kind: 'box', boxId: slot.playerId };
    }
    return explicit;
  }

  const slot = state.tableMeta.boxSlots.find((s) => s.playerId === explicit.boxId);
  if (slot?.playerId) {
    return { kind: 'box', boxId: slot.playerId };
  }
  if (online) {
    const slotNum = state.session.boxSlotNumbers?.[explicit.boxId];
    if (slotNum != null) {
      const row = state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNum);
      if (row?.playerId) {
        return { kind: 'box', boxId: row.playerId };
      }
      if (row) {
        return { kind: 'slot', slotNumber: slotNum };
      }
    }
  }

  if (isBoxChipTargetOnTable(state, explicit.boxId, online)) {
    return { kind: 'box', boxId: explicit.boxId };
  }
  return null;
}

/** Clear local chip target only when the slot row or box row is gone — not when slot materializes. */
export function shouldClearExplicitChipTarget(
  state: GameState,
  explicit: PlaceBetTarget,
  online: boolean,
): boolean {
  if (explicit.kind === 'slot') {
    return !state.tableMeta.boxSlots.some((s) => s.slotNumber === explicit.slotNumber);
  }
  return !isBoxChipTargetOnTable(state, explicit.boxId, online);
}
