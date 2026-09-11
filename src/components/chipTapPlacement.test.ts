import { describe, expect, it } from 'vitest';
import {
  persistArmedChipDenomination,
  resolveBoxTapChipPlacement,
} from './chipTapPlacement';

describe('box tap chip placement', () => {
  it('repeated taps on the same box place while denomination stays armed', () => {
    const armed = persistArmedChipDenomination(null, 5);
    expect(armed).toBe(5);
    const first = resolveBoxTapChipPlacement({
      bettingOpen: true,
      denomination: armed,
      slotNumber: 2,
      slotOnTable: true,
    });
    const second = resolveBoxTapChipPlacement({
      bettingOpen: true,
      denomination: persistArmedChipDenomination(armed, 5),
      slotNumber: 2,
      slotOnTable: true,
    });
    expect(first).toEqual({
      place: true,
      slotNumber: 2,
      denomination: 5,
      reason: 'armed-denomination',
    });
    expect(second.place).toBe(true);
    expect(second.slotNumber).toBe(2);
    expect(persistArmedChipDenomination(5, 5)).toBe(5);
  });

  it('label/value/child taps use the same box slot decision', () => {
    const decision = resolveBoxTapChipPlacement({
      bettingOpen: true,
      denomination: 10,
      slotNumber: 3,
      slotOnTable: true,
    });
    expect(decision.place).toBe(true);
    expect(decision.slotNumber).toBe(3);
  });

  it('tapping a different box routes placement to that slot', () => {
    const box1 = resolveBoxTapChipPlacement({
      bettingOpen: true,
      denomination: 5,
      slotNumber: 1,
      slotOnTable: true,
    });
    const box4 = resolveBoxTapChipPlacement({
      bettingOpen: true,
      denomination: 5,
      slotNumber: 4,
      slotOnTable: true,
    });
    expect(box1.place && box1.slotNumber).toBe(1);
    expect(box4.place && box4.slotNumber).toBe(4);
  });

  it('one resolved tap is one placement decision', () => {
    const decision = resolveBoxTapChipPlacement({
      bettingOpen: true,
      denomination: 20,
      slotNumber: 1,
      slotOnTable: true,
    });
    expect(decision.place).toBe(true);
    expect(decision.reason).toBe('armed-denomination');
  });

  it('does not place when betting is locked', () => {
    const decision = resolveBoxTapChipPlacement({
      bettingOpen: false,
      denomination: 5,
      slotNumber: 1,
      slotOnTable: true,
    });
    expect(decision).toEqual({
      place: false,
      slotNumber: 1,
      denomination: 5,
      reason: 'betting-locked',
    });
  });

  it('does not place without an armed denomination', () => {
    const decision = resolveBoxTapChipPlacement({
      bettingOpen: true,
      denomination: null,
      slotNumber: 1,
      slotOnTable: true,
    });
    expect(decision.reason).toBe('no-denomination');
    expect(decision.place).toBe(false);
  });
});
