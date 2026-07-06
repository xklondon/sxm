import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getNextCardDelay,
  getCardDealDelayMs,
  normalizeFlowSettings,
} from './flowSettings';
import {
  resolveCardRevealDelayMs as revealDelayFromDisplay,
  waitForInitialDealerHoleHoldMs,
} from './dealing/cardRevealDisplay';
import { scheduleNextCardReveal, waitForDealPaceMs, waitForResultHoldMs } from './dealPacing';

const FLOW_SRC = readFileSync(join(process.cwd(), 'src/engine/blackjack/flowSettings.ts'), 'utf8');
const REVEAL_HOOK_SRC = readFileSync(
  join(process.cwd(), 'src/hooks/useSequentialCardReveal.ts'),
  'utf8',
);
const TABLE_FLOW_SRC = readFileSync(
  join(process.cwd(), 'src/components/useBlackjackTableFlow.ts'),
  'utf8',
);
const FLOW_SETTINGS_UI_SRC = readFileSync(
  join(process.cwd(), 'src/components/BlackjackFlowSettings.tsx'),
  'utf8',
);

function stateWithSettings(settings: ReturnType<typeof normalizeFlowSettings>) {
  return { blackjackFlowSettings: settings };
}

describe('card timing engine — getNextCardDelay', () => {
  it('default preset is 3000ms', () => {
    const settings = normalizeFlowSettings();
    expect(getNextCardDelay(stateWithSettings(settings))).toBe(3000);
  });

  it('presets map to 1/2/3/5 sec', () => {
    expect(getNextCardDelay(stateWithSettings(normalizeFlowSettings({ dealSpeedPreset: 'fast' })))).toBe(1000);
    expect(getNextCardDelay(stateWithSettings(normalizeFlowSettings({ dealSpeedPreset: 'medium' })))).toBe(2000);
    expect(getNextCardDelay(stateWithSettings(normalizeFlowSettings({ dealSpeedPreset: 'normal' })))).toBe(3000);
    expect(getNextCardDelay(stateWithSettings(normalizeFlowSettings({ dealSpeedPreset: 'slow' })))).toBe(5000);
  });

  it('custom preset uses customDealDelayMs', () => {
    const settings = normalizeFlowSettings({ dealSpeedPreset: 'custom', customDealDelayMs: 4500 });
    expect(getNextCardDelay(stateWithSettings(settings))).toBe(4500);
  });

  it('random timing respects min/max', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const settings = normalizeFlowSettings({
      randomDealTiming: true,
      randomDealMinMs: 2000,
      randomDealMaxMs: 4000,
    });
    const delay = getNextCardDelay(stateWithSettings(settings));
    expect(delay).toBeGreaterThanOrEqual(2000);
    expect(delay).toBeLessThanOrEqual(4000);
    vi.restoreAllMocks();
  });

  it('all card contexts use the same delay (no bank-specific path)', () => {
    const state = stateWithSettings(normalizeFlowSettings({ dealSpeedPreset: 'normal' }));
    const base = getNextCardDelay(state);
    expect(getCardDealDelayMs(state, 'bank-turn-start')).toBe(base);
    expect(getCardDealDelayMs(state, 'bank-card-draw')).toBe(base);
    expect(getCardDealDelayMs(state, 'dealer')).toBe(base);
    expect(getCardDealDelayMs(state, 'hit')).toBe(base);
    expect(getCardDealDelayMs(state, 'double')).toBe(base);
    expect(getCardDealDelayMs(state, 'initial-deal')).toBe(base);
    expect(getCardDealDelayMs(state, 'bank-pause')).toBe(base);
    expect(getCardDealDelayMs(state, 'result-hold')).toBe(base);
  });

  it('legacy cardTimerPreset does not affect delay', () => {
    const settings = normalizeFlowSettings({ cardTimerPreset: 5, dealSpeedPreset: 'slow' });
    expect(getNextCardDelay(stateWithSettings(settings))).toBe(5000);
  });

  it('reveal display helpers delegate to getNextCardDelay', () => {
    const state = stateWithSettings(normalizeFlowSettings({ dealSpeedPreset: 'slow' }));
    expect(revealDelayFromDisplay(state, null, undefined, { dealer: 0, hands: {} }, { dealer: 1, hands: {} })).toBe(5000);
    expect(waitForInitialDealerHoleHoldMs(state)).toBe(5000);
    expect(waitForDealPaceMs(state)).toBe(5000);
    expect(waitForResultHoldMs(state)).toBe(5000);
  });

  it('scheduleNextCardReveal delegates to getNextCardDelay', () => {
    const src = readFileSync(join(process.cwd(), 'src/engine/blackjack/dealPacing.ts'), 'utf8');
    expect(src).toContain('export async function scheduleNextCardReveal');
    expect(src).toContain('getNextCardDelay(state)');
  });
});

describe('card timing engine — wiring guards', () => {
  it('flowSettings exports getNextCardDelay as canonical', () => {
    expect(FLOW_SRC).toContain('export function getNextCardDelay');
    expect(FLOW_SRC).not.toMatch(/cardTimerPreset\s*\*\s*1000/);
  });

  it('useSequentialCardReveal uses scheduleNextCardReveal only', () => {
    expect(REVEAL_HOOK_SRC).toContain('scheduleNextCardReveal');
    expect(REVEAL_HOOK_SRC).not.toContain('waitForResultHoldMs');
    expect(REVEAL_HOOK_SRC).not.toContain('waitForInitialDealerHoleHoldMs');
    expect(REVEAL_HOOK_SRC).not.toContain('getCardDealDelayMs');
  });

  it('auto bank play does not sleep between draws — reveal queue paces cards', () => {
    expect(TABLE_FLOW_SRC).not.toContain("getCardDealDelayMs");
    expect(TABLE_FLOW_SRC).not.toContain('bank-turn-start');
    expect(TABLE_FLOW_SRC).not.toContain('bank-card-draw');
    expect(TABLE_FLOW_SRC).toContain('cardRevealComplete');
  });

  it('settings UI removed bank timer / turn timer', () => {
    expect(FLOW_SETTINGS_UI_SRC).not.toContain('Turn timer');
    expect(FLOW_SETTINGS_UI_SRC).not.toContain('cardTimerPreset');
    expect(FLOW_SETTINGS_UI_SRC).toContain('Card deal speed');
    expect(FLOW_SETTINGS_UI_SRC).toContain('Random timing');
  });
});
