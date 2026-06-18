import type { BoxSlotState } from '../types/table';
import { MAX_TABLE_BOXES } from '../types/table';

/** Initial visible player boxes in the arc (layout only — engine still supports MAX_TABLE_BOXES). */
export const DEFAULT_VISIBLE_TABLE_BOXES = 4;

const ARC_ROTATIONS_BY_COUNT: Record<number, readonly number[]> = {
  4: [-14, -5, 5, 14],
  5: [-16, -8, 0, 8, 16],
  6: [-17, -10, -3, 3, 10, 17],
  7: [-18, -12, -6, 0, 6, 12, 18],
};

const MOBILE_ARC_ROTATIONS_BY_COUNT: Record<number, readonly number[]> = {
  4: [-8, -3, 3, 8],
  5: [-10, -5, 0, 5, 10],
  6: [-10, -6, -2, 2, 6, 10],
  7: [-8, -5, -2, 0, 2, 5, 8],
};

export function arcRotationsForVisibleCount(
  visibleCount: number,
  options?: { mobile?: boolean },
): readonly number[] {
  const table = options?.mobile ? MOBILE_ARC_ROTATIONS_BY_COUNT : ARC_ROTATIONS_BY_COUNT;
  return table[visibleCount] ?? table[7]!;
}

export function arcVisualIndex(slotNumber: number, visibleCount: number): number {
  return visibleCount - slotNumber;
}

export function arcSlotRotation(
  slotNumber: number,
  visibleCount: number,
  options?: { mobile?: boolean },
): number {
  const rotations = arcRotationsForVisibleCount(visibleCount, options);
  const idx = arcVisualIndex(slotNumber, visibleCount);
  return rotations[idx] ?? 0;
}

/** Split companion tile — visually between parent box and the next seat to the left. */
export function arcSplitCompanionRotation(
  parentSlotNumber: number,
  visibleCount: number,
  options?: { mobile?: boolean },
): number {
  const parentRot = arcSlotRotation(parentSlotNumber, visibleCount, options);
  const leftNeighborSlot = parentSlotNumber + 1;
  if (leftNeighborSlot > visibleCount) {
    return parentRot + (options?.mobile ? 5 : 7);
  }
  const neighborRot = arcSlotRotation(leftNeighborSlot, visibleCount, options);
  return (parentRot + neighborRot) / 2;
}

/** User-expanded count only — occupancy must not auto-expand the visible row. */
export function resolveEffectiveVisibleBoxCount(
  _boxSlots: readonly BoxSlotState[],
  expandedCount: number,
): number {
  return Math.min(
    MAX_TABLE_BOXES,
    Math.max(DEFAULT_VISIBLE_TABLE_BOXES, expandedCount),
  );
}

export function filterVisibleBoxSlots<T extends Pick<BoxSlotState, 'slotNumber'>>(
  slots: readonly T[],
  visibleCount: number,
): T[] {
  return slots.filter((slot) => slot.slotNumber <= visibleCount).sort((a, b) => b.slotNumber - a.slotNumber);
}

export function visibleBoxArcClass(visibleCount: number): string {
  return `bj-arc--visible-${Math.min(MAX_TABLE_BOXES, Math.max(1, visibleCount))}`;
}
