import type { BuiltSidePot } from './sidePots';

/** Lower rank is a better hand (1 = best at showdown). */
export type HoldemRankedWinner = {
  seatId: string;
  rank: number;
};

export type SidePotPayout = {
  potId: string;
  amount: number;
  winnerSeatIds: string[];
  amountPerWinner: number;
  remainder: number;
};

export function calculateSidePotPayouts(params: {
  sidePots: BuiltSidePot[];
  rankedWinners: HoldemRankedWinner[];
  seatOrder?: string[];
}): SidePotPayout[] {
  const { sidePots, rankedWinners, seatOrder = [] } = params;
  const payouts: SidePotPayout[] = [];

  for (const pot of sidePots) {
    if (pot.amount <= 0) {
      continue;
    }

    const eligible = rankedWinners.filter((w) => pot.eligibleSeatIds.includes(w.seatId));
    if (eligible.length === 0) {
      continue;
    }

    const bestRank = Math.min(...eligible.map((w) => w.rank));
    const winnerSeatIds = eligible
      .filter((w) => w.rank === bestRank)
      .map((w) => w.seatId)
      .sort((a, b) => {
        const ia = seatOrder.indexOf(a);
        const ib = seatOrder.indexOf(b);
        return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
      });

    const amountPerWinner = Math.floor(pot.amount / winnerSeatIds.length);
    const remainder = pot.amount % winnerSeatIds.length;

    payouts.push({
      potId: pot.id,
      amount: pot.amount,
      winnerSeatIds,
      amountPerWinner,
      remainder,
    });
  }

  return payouts;
}

/** Chip amount each winner receives from one SidePotPayout row. */
export function chipsForSidePotWinner(
  payout: SidePotPayout,
  winnerIndex: number,
): number {
  return payout.amountPerWinner + (winnerIndex < payout.remainder ? 1 : 0);
}
