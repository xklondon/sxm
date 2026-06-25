import { describe, expect, it } from 'vitest';
import { buildHoldemSidePots } from './sidePots';
import {
  calculateSidePotPayouts,
  chipsForSidePotWinner,
  type HoldemRankedWinner,
} from './sidePotPayout';

describe('calculateSidePotPayouts', () => {
  const seatOrder = ['A', 'B', 'C'];

  it('1. one pot, one winner', () => {
    const sidePots = buildHoldemSidePots([
      { seatId: 'A', amount: 100 },
      { seatId: 'B', amount: 100 },
    ]);
    const payouts = calculateSidePotPayouts({
      sidePots,
      rankedWinners: [
        { seatId: 'A', rank: 1 },
        { seatId: 'B', rank: 2 },
      ],
      seatOrder,
    });
    expect(payouts).toHaveLength(1);
    expect(payouts[0]).toMatchObject({
      potId: 'pot-1',
      amount: 200,
      winnerSeatIds: ['A'],
      amountPerWinner: 200,
      remainder: 0,
    });
  });

  it('2. one pot, tied winners split', () => {
    const sidePots = buildHoldemSidePots([
      { seatId: 'A', amount: 100 },
      { seatId: 'B', amount: 100 },
    ]);
    const payouts = calculateSidePotPayouts({
      sidePots,
      rankedWinners: [
        { seatId: 'A', rank: 1 },
        { seatId: 'B', rank: 1 },
      ],
      seatOrder,
    });
    expect(payouts[0]?.winnerSeatIds).toEqual(['A', 'B']);
    expect(payouts[0]?.amountPerWinner).toBe(100);
    expect(payouts[0]?.remainder).toBe(0);
  });

  it('3. tied winners with remainder goes by seat order', () => {
    const sidePots = [{ id: 'pot-1', amount: 101, eligibleSeatIds: ['A', 'B'], threshold: 50 }];
    const payouts = calculateSidePotPayouts({
      sidePots,
      rankedWinners: [
        { seatId: 'A', rank: 1 },
        { seatId: 'B', rank: 1 },
      ],
      seatOrder: ['B', 'A'],
    });
    expect(payouts[0]?.amountPerWinner).toBe(50);
    expect(payouts[0]?.remainder).toBe(1);
    expect(chipsForSidePotWinner(payouts[0]!, 0)).toBe(51);
    expect(chipsForSidePotWinner(payouts[0]!, 1)).toBe(50);
  });

  it('4. short all-in can win main pot only', () => {
    const sidePots = buildHoldemSidePots([
      { seatId: 'A', amount: 50 },
      { seatId: 'B', amount: 100 },
      { seatId: 'C', amount: 100 },
    ]);
    const ranked: HoldemRankedWinner[] = [
      { seatId: 'A', rank: 1 },
      { seatId: 'B', rank: 2 },
      { seatId: 'C', rank: 3 },
    ];
    const payouts = calculateSidePotPayouts({ sidePots, rankedWinners: ranked, seatOrder });
    expect(payouts[0]?.winnerSeatIds).toEqual(['A']);
    expect(payouts[0]?.amount).toBe(150);
    expect(payouts[1]?.winnerSeatIds).not.toContain('A');
    expect(payouts[1]?.amount).toBe(100);
  });

  it('5. larger stack wins side pot only', () => {
    const sidePots = buildHoldemSidePots([
      { seatId: 'A', amount: 50 },
      { seatId: 'B', amount: 100 },
      { seatId: 'C', amount: 100 },
    ]);
    const payouts = calculateSidePotPayouts({
      sidePots,
      rankedWinners: [
        { seatId: 'A', rank: 3 },
        { seatId: 'B', rank: 1 },
        { seatId: 'C', rank: 2 },
      ],
      seatOrder,
    });
    expect(payouts[0]?.winnerSeatIds).toEqual(['B']);
    expect(payouts[1]?.winnerSeatIds).toEqual(['B']);
  });

  it('6. folded player contributed but cannot win', () => {
    const sidePots = buildHoldemSidePots([
      { seatId: 'A', amount: 100, isFolded: true },
      { seatId: 'B', amount: 100 },
      { seatId: 'C', amount: 100 },
    ]);
    const payouts = calculateSidePotPayouts({
      sidePots,
      rankedWinners: [
        { seatId: 'B', rank: 1 },
        { seatId: 'C', rank: 2 },
      ],
      seatOrder,
    });
    expect(payouts[0]?.winnerSeatIds).toEqual(['B']);
    expect(payouts[0]?.amount).toBe(300);
  });

  it('7. three-tier all-in side-pot payout', () => {
    const sidePots = buildHoldemSidePots([
      { seatId: 'A', amount: 50 },
      { seatId: 'B', amount: 120 },
      { seatId: 'C', amount: 200 },
    ]);
    const payouts = calculateSidePotPayouts({
      sidePots,
      rankedWinners: [
        { seatId: 'A', rank: 1 },
        { seatId: 'B', rank: 2 },
        { seatId: 'C', rank: 3 },
      ],
      seatOrder,
    });
    expect(payouts).toHaveLength(3);
    expect(payouts[0]?.winnerSeatIds).toEqual(['A']);
    expect(payouts[1]?.winnerSeatIds).toEqual(['B']);
    expect(payouts[2]?.winnerSeatIds).toEqual(['C']);
    const total = payouts.reduce(
      (sum, p) => sum + p.winnerSeatIds.reduce((s, _, i) => s + chipsForSidePotWinner(p, i), 0),
      0,
    );
    expect(total).toBe(370);
  });
});
