import type { GameState } from '../../types';
import { getNextCardDelay, type BlackjackFlowSettings } from './flowSettings';

/**
 * All visible card reveals must use getNextCardDelay / scheduleNextCardReveal so
 * player deal, hits, doubles, splits, dealer hole, and bank draws share one engine.
 */

/** Canonical pause before the next card is shown. */
export function waitForDealPaceMs(state: Pick<GameState, 'blackjackFlowSettings'>): number {
  return getNextCardDelay(state);
}

/** @deprecated use waitForDealPaceMs — same global interval */
export function waitForResultHoldMs(state: Pick<GameState, 'blackjackFlowSettings'>): number {
  return getNextCardDelay(state);
}

export function waitForDealPaceFromSettings(settings: BlackjackFlowSettings): number {
  return getNextCardDelay({ blackjackFlowSettings: settings }, settings);
}

/** @deprecated use waitForDealPaceFromSettings */
export function waitForResultHoldFromSettings(settings: BlackjackFlowSettings): number {
  return getNextCardDelay({ blackjackFlowSettings: settings }, settings);
}

/** Await the canonical inter-card delay — sole scheduler for reveal pacing. */
export async function scheduleNextCardReveal(
  state: Pick<GameState, 'blackjackFlowSettings'>,
): Promise<void> {
  await sleepMs(getNextCardDelay(state));
}

export function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
