/**
 * Poker 0 seat ring — 7×7 CSS grid areas on the felt.
 * Hero (seat 0 after viewer rotation) sits bottom center.
 */

const RING_2 = ['3 / 6 / 5 / 7', '3 / 1 / 5 / 2'] as const;
const RING_4 = ['3 / 1 / 5 / 2', '6 / 3 / 7 / 5', '3 / 6 / 5 / 7', '1 / 3 / 2 / 5'] as const;
const RING_6 = [
  '3 / 6 / 5 / 7',
  '5 / 5 / 6 / 6',
  '5 / 2 / 6 / 3',
  '3 / 1 / 5 / 2',
  '2 / 2 / 3 / 3',
  '2 / 5 / 3 / 6',
] as const;
const RING_9 = [
  '4 / 1 / 5 / 2',
  '6 / 1 / 7 / 2',
  '7 / 3 / 8 / 4',
  '6 / 6 / 7 / 7',
  '4 / 7 / 5 / 8',
  '2 / 6 / 3 / 7',
  '1 / 3 / 2 / 4',
  '2 / 1 / 3 / 2',
  '3 / 1 / 4 / 2',
] as const;

const RING_BY_COUNT: Record<number, readonly string[]> = {
  2: RING_2,
  4: RING_4,
  6: RING_6,
  9: RING_9,
};

function pickRing(totalSeats: number): readonly string[] {
  if (RING_BY_COUNT[totalSeats]) {
    return RING_BY_COUNT[totalSeats]!;
  }
  if (totalSeats <= 2) {
    return RING_2;
  }
  if (totalSeats <= 4) {
    return RING_4.slice(0, totalSeats);
  }
  if (totalSeats <= 6) {
    return RING_6.slice(0, totalSeats);
  }
  return RING_9.slice(0, Math.min(totalSeats, 9));
}

/** CSS `grid-area` for a seat on the Poker 0 felt grid. */
export function poker0SeatGridArea(seatIndex: number, totalSeats: number): string {
  const ring = pickRing(Math.max(totalSeats, 1));
  return ring[seatIndex % ring.length] ?? ring[0]!;
}

export const POKER0_FELT_GRID_COLUMNS = 7;
export const POKER0_FELT_GRID_ROWS = 7;
export const POKER0_CENTER_GRID_AREA = '3 / 3 / 6 / 6';
