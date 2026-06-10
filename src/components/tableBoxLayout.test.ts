import { describe, expect, it } from 'vitest';
import type { BoxSlotState } from '../types/table';
import {
  DEFAULT_VISIBLE_TABLE_BOXES,
  arcSlotRotation,
  filterVisibleBoxSlots,
  resolveEffectiveVisibleBoxCount,
  visibleBoxArcClass,
} from './tableBoxLayout';

function slot(n: number, playerId: string | null = null): BoxSlotState {
  return {
    slotNumber: n,
    playerId,
    bankrollOwnerId: null,
    nativeAssignedPersonId: null,
    callerPersonId: null,
    passiveNames: [],
  };
}

describe('tableBoxLayout — visible box count and arc sizing', () => {
  it('defaults to 4 visible player boxes', () => {
    expect(DEFAULT_VISIBLE_TABLE_BOXES).toBe(4);
    const slots = [1, 2, 3, 4, 5, 6, 7].map((n) => slot(n));
    expect(resolveEffectiveVisibleBoxCount(slots, DEFAULT_VISIBLE_TABLE_BOXES)).toBe(4);
    expect(filterVisibleBoxSlots(slots, 4)).toHaveLength(4);
  });

  it('expands visible count when user adds boxes', () => {
    const slots = [1, 2, 3, 4, 5, 6, 7].map((n) => slot(n));
    expect(resolveEffectiveVisibleBoxCount(slots, 5)).toBe(5);
    expect(filterVisibleBoxSlots(slots, 5)).toHaveLength(5);
  });

  it('grows to highest occupied slot when a player joins a higher box', () => {
    const slots = [
      slot(1, 'p1'),
      slot(2),
      slot(3),
      slot(4),
      slot(5, 'p2'),
      slot(6),
      slot(7),
    ];
    expect(resolveEffectiveVisibleBoxCount(slots, 4)).toBe(5);
  });

  it('maps visible count to adaptive arc CSS class', () => {
    expect(visibleBoxArcClass(4)).toBe('bj-arc--visible-4');
    expect(visibleBoxArcClass(7)).toBe('bj-arc--visible-7');
  });

  it('uses lower mobile arc rotation than desktop at 7 boxes', () => {
    expect(Math.abs(arcSlotRotation(1, 7, { mobile: true }))).toBeLessThan(
      Math.abs(arcSlotRotation(1, 7)),
    );
  });
});
