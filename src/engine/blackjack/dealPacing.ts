import type { GameState } from '../../types';
import {
  getCardDealDelayMs,
  type CardDealDelayContext,
  type BlackjackFlowSettings,
} from './flowSettings';

/**
 * All visible card reveals and hand transitions must use these helpers so deal
 * speed and result holds stay consistent across initial deal, hits, doubles,
 * splits, bank draws, and auto-advance paths.
 */

/** Delay before the next card is revealed — uses table deal speed preset. */
export function waitForDealPaceMs(
  state: Pick<GameState, 'blackjackFlowSettings'>,
  context: CardDealDelayContext = 'initial-deal',
): number {
  return getCardDealDelayMs(state, context);
}

/** Pause after a hand result (bust, stand, 18+ auto-stand) before the next box/hand. */
export function waitForResultHoldMs(state: Pick<GameState, 'blackjackFlowSettings'>): number {
  return getCardDealDelayMs(state, 'result-hold');
}

export function waitForDealPaceFromSettings(
  settings: BlackjackFlowSettings,
  context: CardDealDelayContext = 'initial-deal',
): number {
  return getCardDealDelayMs({ blackjackFlowSettings: settings }, context);
}

export function waitForResultHoldFromSettings(settings: BlackjackFlowSettings): number {
  return getCardDealDelayMs({ blackjackFlowSettings: settings }, 'result-hold');
}

export function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
