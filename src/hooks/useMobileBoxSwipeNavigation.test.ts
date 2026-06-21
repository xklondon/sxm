import { describe, expect, it } from 'vitest';
import { resolveMobileBoxSwipeTarget } from './useMobileBoxSwipeNavigation';

describe('resolveMobileBoxSwipeTarget', () => {
  const slots = [
    { slotNumber: 1, playerId: 'a' },
    { slotNumber: 2, playerId: 'b' },
  ];

  it('swipes left to the next occupied slot', () => {
    expect(resolveMobileBoxSwipeTarget(slots, 1, -80, 5)).toBe(2);
  });

  it('swipes right to the previous occupied slot', () => {
    expect(resolveMobileBoxSwipeTarget(slots, 2, 80, 5)).toBe(1);
  });

  it('ignores vertical drags', () => {
    expect(resolveMobileBoxSwipeTarget(slots, 1, 10, -100)).toBeNull();
  });
});
