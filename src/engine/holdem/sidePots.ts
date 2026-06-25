export type HoldemContribution = {
  seatId: string;
  amount: number;
  isFolded?: boolean;
};

export type BuiltSidePot = {
  id: string;
  amount: number;
  eligibleSeatIds: string[];
  threshold: number;
};

/**
 * Build side pots from per-seat hand contributions.
 * Folded players contribute chips but are not eligible to win.
 */
export function buildHoldemSidePots(contributions: HoldemContribution[]): BuiltSidePot[] {
  const positive = contributions.filter((c) => c.amount > 0);
  if (positive.length === 0) {
    return [];
  }

  const thresholds = [...new Set(positive.map((c) => c.amount))].sort((a, b) => a - b);
  const pots: BuiltSidePot[] = [];
  let prevThreshold = 0;
  let potIndex = 1;

  for (const threshold of thresholds) {
    const slice = threshold - prevThreshold;
    if (slice <= 0) {
      continue;
    }

    const contributorsAtLevel = positive.filter((c) => c.amount >= threshold);
    const amount = slice * contributorsAtLevel.length;
    const eligibleSeatIds = positive
      .filter((c) => !c.isFolded && c.amount >= threshold)
      .map((c) => c.seatId);

    pots.push({
      id: `pot-${potIndex}`,
      amount,
      eligibleSeatIds,
      threshold,
    });

    potIndex += 1;
    prevThreshold = threshold;
  }

  return pots;
}
