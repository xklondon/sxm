import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cardDealDelayMs,
  dealDelayMsForPreset,
  getNextCardDelay,
  normalizeFlowSettings,
  syncDealTimingFromPreset,
} from './flowSettings';

describe('deal timing — single canonical source', () => {
  it('presets map to 1/2/3/5 sec', () => {
    expect(dealDelayMsForPreset('fast')).toBe(1000);
    expect(dealDelayMsForPreset('medium')).toBe(2000);
    expect(dealDelayMsForPreset('normal')).toBe(3000);
    expect(dealDelayMsForPreset('slow')).toBe(5000);
  });

  it('default preset is normal (3000ms)', () => {
    expect(normalizeFlowSettings().dealSpeedPreset).toBe('normal');
    expect(cardDealDelayMs(normalizeFlowSettings())).toBe(3000);
  });

  it('syncDealTimingFromPreset aligns legacy fields to getNextCardDelay', () => {
    const synced = syncDealTimingFromPreset(normalizeFlowSettings({ dealSpeedPreset: 'slow' }));
    const delay = getNextCardDelay({ blackjackFlowSettings: synced });
    expect(delay).toBe(5000);
    expect(synced.naturalDealDelayMs).toBe(5000);
    expect(synced.bankDrawMinDelayMs).toBe(5000);
  });

  it('useSequentialCardReveal uses scheduleNextCardReveal', () => {
    const src = readFileSync(join(process.cwd(), 'src/hooks/useSequentialCardReveal.ts'), 'utf8');
    expect(src).toContain('scheduleNextCardReveal');
    expect(src).not.toContain('resolveCardRevealDelayMs');
  });

  it('useBlackjackTableFlow does not pace bank draws locally', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/useBlackjackTableFlow.ts'), 'utf8');
    expect(src).not.toContain('getCardDealDelayMs');
    expect(src).toContain('cardRevealComplete');
  });
});
