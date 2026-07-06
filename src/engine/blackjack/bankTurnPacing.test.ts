import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getNextCardDelay,
  normalizeFlowSettings,
} from './flowSettings';
import { resolveCardRevealDelayMs } from './dealing/cardRevealDisplay';

describe('bank turn pacing — unified card timing engine', () => {
  it('dealer initial, draw, player hit/double all use getNextCardDelay', () => {
    const settings = normalizeFlowSettings({ dealSpeedPreset: 'normal', cardTimerPreset: 5 });
    const state = { blackjackFlowSettings: settings };
    const delay = getNextCardDelay(state);
    expect(delay).toBe(3000);
    expect(resolveCardRevealDelayMs(state, null, undefined, { dealer: 0, hands: {} }, { dealer: 1, hands: {} })).toBe(3000);
    expect(resolveCardRevealDelayMs(state, { status: 'bank-turn' } as never, 'bank-turn', { dealer: 1, hands: {} }, { dealer: 2, hands: {} })).toBe(3000);
    expect(resolveCardRevealDelayMs(state, { status: 'player-turns', playerHands: {}, dealerCardIds: [] } as never, 'player-turns', { dealer: 1, hands: { k: 2 } }, { dealer: 1, hands: { k: 3 } })).toBe(3000);
  });

  it('legacy cardTimerPreset does not change dealer pacing', () => {
    const settings = normalizeFlowSettings({ cardTimerPreset: 0, dealSpeedPreset: 'slow' });
    expect(getNextCardDelay({ blackjackFlowSettings: settings })).toBe(5000);
  });

  it('useSequentialCardReveal uses scheduleNextCardReveal', () => {
    const src = readFileSync(join(process.cwd(), 'src/hooks/useSequentialCardReveal.ts'), 'utf8');
    expect(src).toContain('scheduleNextCardReveal');
    expect(src).not.toContain('getCardDealDelayMs');
  });
});
