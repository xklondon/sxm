import { describe, expect, it } from 'vitest';
import { createEmptyHoldemRound } from '../../types/holdem';
import {
  applyUncalledBetReturnsToRound,
  calculateUncalledBetReturns,
} from './uncalledBetReturn';
import { computeHoldemPot } from '../../types/holdem';

function roundWithContributions(
  entries: Record<string, { amount: number; folded?: boolean }>,
): ReturnType<typeof createEmptyHoldemRound> {
  const round = createEmptyHoldemRound('A', 'A', 'B');
  round.playerStates = Object.fromEntries(
    Object.entries(entries).map(([seatId, { amount, folded }]) => [
      seatId,
      {
        holeCardIds: [],
        actionStatus: folded ? ('folded' as const) : ('active' as const),
        playerBetsThisStreet: amount,
        playerTotalCommitted: amount,
        hasActedThisStreet: true,
      },
    ]),
  );
  return round;
}

describe('uncalled bet return', () => {
  it('8. uncalled raise returned to sole remaining player', () => {
    const returns = calculateUncalledBetReturns(
      [
        { seatId: 'A', amount: 100 },
        { seatId: 'B', amount: 50, isFolded: true },
      ],
      ['A'],
    );
    expect(returns).toEqual([{ seatId: 'A', amount: 50 }]);
  });

  it('9. folded player contribution remains in pot', () => {
    let round = roundWithContributions({
      A: { amount: 100 },
      B: { amount: 50, folded: true },
    });
    const returns = calculateUncalledBetReturns(
      [
        { seatId: 'A', amount: 100 },
        { seatId: 'B', amount: 50, isFolded: true },
      ],
      ['A'],
    );
    round = applyUncalledBetReturnsToRound(round, returns);
    expect(round.playerStates.A!.playerTotalCommitted).toBe(50);
    expect(round.playerStates.B!.playerTotalCommitted).toBe(50);
    expect(computeHoldemPot(round)).toBe(100);
  });

  it('10. returned amount reduces committed amount', () => {
    let round = roundWithContributions({ A: { amount: 100 }, B: { amount: 50, folded: true } });
    round = applyUncalledBetReturnsToRound(round, [{ seatId: 'A', amount: 50 }]);
    expect(round.playerStates.A!.playerTotalCommitted).toBe(50);
    expect(round.playerStates.A!.playerBetsThisStreet).toBe(50);
  });

  it('11. no return when highest contribution is matched', () => {
    const returns = calculateUncalledBetReturns(
      [
        { seatId: 'A', amount: 100 },
        { seatId: 'B', amount: 100 },
      ],
      ['A'],
    );
    expect(returns).toEqual([]);
  });

  it('12. no negative values after apply', () => {
    let round = roundWithContributions({ A: { amount: 100 }, B: { amount: 50, folded: true } });
    round = applyUncalledBetReturnsToRound(round, [{ seatId: 'A', amount: 50 }]);
    for (const ps of Object.values(round.playerStates)) {
      expect(ps.playerTotalCommitted).toBeGreaterThanOrEqual(0);
      expect(ps.playerBetsThisStreet).toBeGreaterThanOrEqual(0);
    }
  });

  it('B: all-in 50, raise to 100 uncalled when others fold — return 50 to raiser', () => {
    const returns = calculateUncalledBetReturns(
      [
        { seatId: 'A', amount: 50 },
        { seatId: 'B', amount: 100 },
        { seatId: 'C', amount: 20, isFolded: true },
      ],
      ['B'],
    );
    expect(returns).toEqual([{ seatId: 'B', amount: 50 }]);
  });

  it('no return at multi-way showdown', () => {
    const returns = calculateUncalledBetReturns(
      [
        { seatId: 'A', amount: 50 },
        { seatId: 'B', amount: 100 },
      ],
      ['A', 'B'],
    );
    expect(returns).toEqual([]);
  });
});
