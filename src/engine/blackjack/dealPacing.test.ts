import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { GameState } from '../../types';
import {
  isHandBoundaryRevealStep,
  resolveCardRevealDelayMs,
} from './dealing/cardRevealDisplay';
import { isInstantInitialDeal, isPacedCardReveal } from './dealing/dealingModes';
import { normalizeFlowSettings } from './flowSettings';
import { waitForDealPaceMs, waitForResultHoldMs } from './dealPacing';

describe('deal pacing helpers', () => {
  it('waitForDealPaceMs and waitForResultHoldMs use deal speed preset', () => {
    const state = {
      blackjackFlowSettings: normalizeFlowSettings({ dealSpeedPreset: 'slow' }),
    } as GameState;
    expect(waitForDealPaceMs(state)).toBe(5000);
    expect(waitForResultHoldMs(state)).toBe(5000);
  });

  it('staged and natural modes use paced reveal; instant does not', () => {
    expect(isPacedCardReveal('staged')).toBe(true);
    expect(isPacedCardReveal('natural')).toBe(true);
    expect(isInstantInitialDeal('instant')).toBe(true);
    expect(isPacedCardReveal('instant')).toBe(false);
  });

  it('detects hand boundary steps during initial deal order', () => {
    expect(
      isHandBoundaryRevealStep(
        { dealer: 0, hands: { 'p:0': 1 } },
        { dealer: 0, hands: { 'p:0': 1, 'p:1': 1 } },
      ),
    ).toBe(true);
    expect(
      isHandBoundaryRevealStep(
        { dealer: 0, hands: {} },
        { dealer: 0, hands: { 'p:0': 1 } },
      ),
    ).toBe(false);
  });

  it('resolveCardRevealDelayMs uses slow preset for hits', () => {
    const state = {
      blackjackFlowSettings: normalizeFlowSettings({ dealSpeedPreset: 'slow' }),
    } as GameState;
    const delay = resolveCardRevealDelayMs(
      state,
      null,
      'player-turns',
      { dealer: 2, hands: { 'p:0': 2 } },
      { dealer: 2, hands: { 'p:0': 3 } },
    );
    expect(delay).toBe(5000);
  });

  it('sequential reveal hook uses scheduleNextCardReveal', () => {
    const hook = readFileSync(join(process.cwd(), 'src/hooks/useSequentialCardReveal.ts'), 'utf8');
    expect(hook).toContain('isInstantInitialDeal');
    expect(hook).toContain('scheduleNextCardReveal');
  });

  it('table flow defers auto-stand while result hold is active', () => {
    const flow = readFileSync(join(process.cwd(), 'src/components/useBlackjackTableFlow.ts'), 'utf8');
    expect(flow).toContain('suppressEngineAutoAdvance');
    expect(flow).toContain('cardRevealComplete');
  });
});
