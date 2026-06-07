import type { GameState } from '../types';
import type { PlaceBetTarget } from '../engine/blackjack/chipPlacement';

/** True when a box id still exists on the table for chip placement. */
export function isBoxChipTargetOnTable(
  state: GameState,
  boxId: string,
  online: boolean,
): boolean {
  if (online) {
    return state.tableMeta.boxSlots.some((s) => s.playerId === boxId);
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
    if (slot.playerId) {
      return { kind: 'box', boxId: slot.playerId };
    }
    return explicit;
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
