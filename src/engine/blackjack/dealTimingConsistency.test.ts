import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cardDealDelayMs,
  getBankTurnDelayMs,
  getCardDealDelayMs,
  normalizeFlowSettings,
  randomBankDrawDelayMs,
  syncDealTimingFromPreset,
} from './flowSettings';

describe('deal timing — single canonical source', () => {
  it('fast/normal/slow map to expected delay', () => {
    expect(cardDealDelayMs(normalizeFlowSettings({ dealSpeedPreset: 'fast' }))).toBe(1000);
    expect(cardDealDelayMs(normalizeFlowSettings({ dealSpeedPreset: 'normal' }))).toBe(3000);
    expect(cardDealDelayMs(normalizeFlowSettings({ dealSpeedPreset: 'slow' }))).toBe(5000);
  });

  it('syncDealTimingFromPreset aligns bank and natural delays to cardDealDelayMs', () => {
    const synced = syncDealTimingFromPreset(normalizeFlowSettings({ dealSpeedPreset: 'slow' }));
    const delay = cardDealDelayMs(synced);
    expect(synced.naturalDealDelayMs).toBe(delay);
    expect(synced.autoDealDelayMs).toBe(delay);
    expect(randomBankDrawDelayMs(synced)).toBe(delay);
    expect(synced.bankDrawMinDelayMs).toBe(delay);
    expect(synced.bankDrawMaxDelayMs).toBe(delay);
  });

  it('useSequentialCardReveal uses getCardDealDelayMs only', () => {
    const src = readFileSync(join(process.cwd(), 'src/hooks/useSequentialCardReveal.ts'), 'utf8');
    expect(src).toContain('getCardDealDelayMs');
    expect(src).not.toMatch(/cardDealDelayMs\(/);
  });

  it('useBlackjackTableFlow bank pacing uses getCardDealDelayMs', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/useBlackjackTableFlow.ts'), 'utf8');
    expect(src).toContain('getCardDealDelayMs');
    expect(src).not.toMatch(/cardDealDelayMs\(/);
  });

  it('bank-turn-start delay uses cardTimerPreset, not deal speed', () => {
    const settings = normalizeFlowSettings({ dealSpeedPreset: 'fast', cardTimerPreset: 15 });
    expect(getBankTurnDelayMs(settings)).toBe(15000);
    expect(getCardDealDelayMs({ blackjackFlowSettings: settings }, 'bank-turn-start')).toBe(15000);
    expect(getCardDealDelayMs({ blackjackFlowSettings: settings }, 'initial-deal')).toBe(1000);
  });

  it('bank card draws use deal speed, not cardTimerPreset', () => {
    const settings = normalizeFlowSettings({ dealSpeedPreset: 'slow', cardTimerPreset: 30 });
    expect(getCardDealDelayMs({ blackjackFlowSettings: settings }, 'dealer')).toBe(5000);
    expect(randomBankDrawDelayMs(settings)).toBe(5000);
  });
});
