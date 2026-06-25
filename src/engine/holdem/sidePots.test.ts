import { describe, expect, it } from 'vitest';
import { buildHoldemSidePots } from './sidePots';

describe('buildHoldemSidePots', () => {
  it('A: equal stacks — one pot, all eligible', () => {
    const pots = buildHoldemSidePots([
      { seatId: 'A', amount: 100 },
      { seatId: 'B', amount: 100 },
      { seatId: 'C', amount: 100 },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0]).toMatchObject({
      id: 'pot-1',
      amount: 300,
      eligibleSeatIds: ['A', 'B', 'C'],
      threshold: 100,
    });
  });

  it('B: short all-in creates main + side pot', () => {
    const pots = buildHoldemSidePots([
      { seatId: 'A', amount: 50 },
      { seatId: 'B', amount: 100 },
      { seatId: 'C', amount: 100 },
    ]);
    expect(pots).toHaveLength(2);
    expect(pots[0]).toMatchObject({
      id: 'pot-1',
      amount: 150,
      eligibleSeatIds: ['A', 'B', 'C'],
      threshold: 50,
    });
    expect(pots[1]).toMatchObject({
      id: 'pot-2',
      amount: 100,
      eligibleSeatIds: ['B', 'C'],
      threshold: 100,
    });
  });

  it('C: multiple all-in depths', () => {
    const pots = buildHoldemSidePots([
      { seatId: 'A', amount: 50 },
      { seatId: 'B', amount: 120 },
      { seatId: 'C', amount: 200 },
    ]);
    expect(pots).toHaveLength(3);
    expect(pots[0]).toMatchObject({ id: 'pot-1', amount: 150, eligibleSeatIds: ['A', 'B', 'C'] });
    expect(pots[1]).toMatchObject({ id: 'pot-2', amount: 140, eligibleSeatIds: ['B', 'C'] });
    expect(pots[2]).toMatchObject({ id: 'pot-3', amount: 80, eligibleSeatIds: ['C'] });
  });

  it('D: folded player chips stay in pot but excluded from eligibility', () => {
    const pots = buildHoldemSidePots([
      { seatId: 'A', amount: 100, isFolded: true },
      { seatId: 'B', amount: 100 },
      { seatId: 'C', amount: 100 },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0]).toMatchObject({
      id: 'pot-1',
      amount: 300,
      eligibleSeatIds: ['B', 'C'],
    });
  });
});
