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
    expect(src).toContain('watchdog snap');
    expect(src).toContain('REVEAL_WATCHDOG_MAX_STUCK_STEPS');
  });

  it('useBlackjackTableFlow gates banking on cardRevealComplete', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/useBlackjackTableFlow.ts'), 'utf8');
    expect(src).not.toContain('getCardDealDelayMs');
    expect(src).toContain('cardRevealComplete');
    const earlyGate = src.match(
      /if \(!cardRevealComplete \|\| bankDrawInFlightRef\.current\) \{[\s\S]*?\n {4}\}/,
    )?.[0];
    expect(earlyGate).toBeTruthy();
    expect(earlyGate).not.toContain('completeBankingOnState');
    expect(src).toMatch(/round\?\.status !== 'banking' \|\| !cardRevealComplete/);
  });

  it('watchdog timeout requires stuck steps before snap', () => {
    const src = readFileSync(join(process.cwd(), 'src/hooks/useSequentialCardReveal.ts'), 'utf8');
    expect(src).toMatch(
      /stuckSteps >= REVEAL_WATCHDOG_MAX_STUCK_STEPS[\s\S]*watchdog-timeout/,
    );
  });
});
