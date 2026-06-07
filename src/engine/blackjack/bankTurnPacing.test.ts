import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  getCardDealDelayMs,
  normalizeFlowSettings,
} from './flowSettings';
import {
  resolveCardRevealDelayMs,
  type CardVisibilityCounts,
} from './dealing/cardRevealDisplay';

describe('bank turn pacing — launch timing audit', () => {
  it('Bank Timer OFF → zero delay for bank-turn-start and bank-card-draw', () => {
    const settings = normalizeFlowSettings({ cardTimerPreset: 0, dealSpeedPreset: 'slow' });
    const state = { blackjackFlowSettings: settings };
    expect(getCardDealDelayMs(state, 'bank-turn-start')).toBe(0);
    expect(getCardDealDelayMs(state, 'bank-card-draw')).toBe(0);
    expect(getCardDealDelayMs(state, 'initial-deal')).toBe(5000);
  });

  it('Bank Timer ON → configured delay for post-player bank pacing only', () => {
    const settings = normalizeFlowSettings({ cardTimerPreset: 15, dealSpeedPreset: 'fast' });
    const state = { blackjackFlowSettings: settings };
    expect(getCardDealDelayMs(state, 'bank-turn-start')).toBe(15000);
    expect(getCardDealDelayMs(state, 'bank-card-draw')).toBe(15000);
    expect(getCardDealDelayMs(state, 'initial-deal')).toBe(1000);
  });

  it('bank-turn dealer reveal uses bank-card-draw context, not initial-deal', () => {
    const settings = normalizeFlowSettings({ cardTimerPreset: 0, dealSpeedPreset: 'slow' });
    const state = { blackjackFlowSettings: settings };
    const visible: CardVisibilityCounts = { dealer: 1, hands: {} };
    const target: CardVisibilityCounts = { dealer: 2, hands: {} };
    expect(
      resolveCardRevealDelayMs(state, { status: 'bank-turn' } as never, 'bank-turn', visible, target),
    ).toBe(0);
    expect(
      resolveCardRevealDelayMs(state, { status: 'bank-turn' } as never, 'bank-turn', visible, target),
    ).not.toBe(5000);
  });

  it('initial deal reveal still uses deal speed', () => {
    const settings = normalizeFlowSettings({ cardTimerPreset: 30, dealSpeedPreset: 'slow' });
    const state = { blackjackFlowSettings: settings };
    const visible: CardVisibilityCounts = { dealer: 0, hands: { 'box-0': 0 } };
    const target: CardVisibilityCounts = { dealer: 0, hands: { 'box-0': 1 } };
    expect(
      resolveCardRevealDelayMs(state, { status: 'player-turns', playerHands: {}, dealerCardIds: [] } as never, 'player-turns', visible, target),
    ).toBe(5000);
  });

  it('useBlackjackTableFlow draws first bank card before inter-card timer', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/useBlackjackTableFlow.ts'), 'utf8');
    expect(src).toContain("getCardDealDelayMs(gameStateRef.current, 'bank-turn-start')");
    expect(src).toContain("getCardDealDelayMs(gameStateRef.current, 'bank-card-draw')");
    expect(src).toMatch(/drawBankCardOnState\(snap\)[\s\S]*bank-card-draw/);
    expect(src).not.toMatch(/bank-card-draw[\s\S]*drawBankCardOnState\(snap\)/);
  });

  it('useSequentialCardReveal uses resolveCardRevealDelayMs', () => {
    const src = readFileSync(join(process.cwd(), 'src/hooks/useSequentialCardReveal.ts'), 'utf8');
    expect(src).toContain('resolveCardRevealDelayMs');
    expect(src).not.toContain("getCardDealDelayMs(authoritative, 'initial-deal')");
  });
});
