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

export function arcRotationsForVisibleCount(visibleCount: number): readonly number[] {
  return ARC_ROTATIONS_BY_COUNT[visibleCount] ?? ARC_ROTATIONS_BY_COUNT[7]!;
}

export function arcVisualIndex(slotNumber: number, visibleCount: number): number {
  return visibleCount - slotNumber;
}

export function arcSlotRotation(slotNumber: number, visibleCount: number): number {
  const rotations = arcRotationsForVisibleCount(visibleCount);
  const idx = arcVisualIndex(slotNumber, visibleCount);
  return rotations[idx] ?? 0;
}

/** Highest slot in use (occupied) or user-expanded count, floored at default visible count. */
export function resolveEffectiveVisibleBoxCount(
  boxSlots: readonly BoxSlotState[],
  expandedCount: number,
): number {
  const occupiedMax = boxSlots.reduce(
    (max, slot) => (slot.playerId ? Math.max(max, slot.slotNumber) : max),
    0,
  );
  return Math.min(
    MAX_TABLE_BOXES,
    Math.max(DEFAULT_VISIBLE_TABLE_BOXES, expandedCount, occupiedMax),
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
