import { describe, expect, it } from 'vitest';
import { poker0SeatGridArea } from './poker0SeatLayout';

describe('poker0SeatGridArea', () => {
  it('places 2 players opposite (bottom + top)', () => {
    expect(poker0SeatGridArea(0, 2)).toBe('3 / 6 / 5 / 7');
    expect(poker0SeatGridArea(1, 2)).toBe('3 / 1 / 5 / 2');
  });

  it('places 4 players in symmetric quadrants', () => {
    const areas = [0, 1, 2, 3].map((i) => poker0SeatGridArea(i, 4));
    expect(new Set(areas).size).toBe(4);
  });

  it('places 6 and 9 distinct grid cells', () => {
    const six = [0, 1, 2, 3, 4, 5].map((i) => poker0SeatGridArea(i, 6));
    const nine = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => poker0SeatGridArea(i, 9));
    expect(new Set(six).size).toBe(6);
    expect(new Set(nine).size).toBe(9);
  });
});
