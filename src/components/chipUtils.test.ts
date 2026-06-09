import { describe, expect, it } from 'vitest';
import { chipValuesForMinimumBet } from './chipUtils';

describe('chipValuesForMinimumBet', () => {
  it('min bet 1 shows all configured denominations in descending order', () => {
    expect(chipValuesForMinimumBet(1)).toEqual([50, 20, 10, 5, 2, 1]);
  });

  it('includes 20 between 50 and 10', () => {
    const values = chipValuesForMinimumBet(1);
    expect(values.indexOf(50)).toBeLessThan(values.indexOf(20));
    expect(values.indexOf(20)).toBeLessThan(values.indexOf(10));
  });

  it('min bet 5 hides 1 and 2', () => {
    expect(chipValuesForMinimumBet(5)).toEqual([50, 20, 10, 5]);
  });

  it('min bet 10 hides 1, 2, and 5', () => {
    expect(chipValuesForMinimumBet(10)).toEqual([50, 20, 10]);
  });

  it('min bet 2 hides odd denominations', () => {
    expect(chipValuesForMinimumBet(2)).toEqual([50, 20, 10, 2]);
  });
});
