/** Front-end Blackjack flow controls — persisted via settingsStorage. */

import type { GameState } from '../../types';
import {
  migrateInitialDealMode,
  type InitialDealMode,
} from './dealing/dealingModes';

export type { InitialDealMode } from './dealing/dealingModes';

/** @deprecated use InitialDealMode */
export type DealMode = 'manual' | 'auto';
export type AdviceCostMode = 'free' | 'bank-offer';
export type DealSpeedPreset = 'fast' | 'medium' | 'normal' | 'slow' | 'custom';

/** @deprecated ignored — use dealSpeedPreset / customDealDelayMs */
export type CardTimerPreset = 0 | 5 | 10 | 15 | 30;

export interface BlackjackFlowSettings {
  /** instant = all at once; staged = one card per tap; natural = auto one-at-a-time with delay */
  initialDealMode: InitialDealMode;
  /** Auto bank draw — decides WHAT to draw; timing engine decides WHEN cards appear. */
  bankDrawMode: 'manual' | 'auto';
  /** @deprecated synced from deal speed preset */
  autoDealDelayMs: number;
  /** @deprecated synced from deal speed preset */
  naturalDealDelayMs: number;
  /** @deprecated synced from deal speed preset */
  bankAutoDrawDelayMs: number;
  /** @deprecated synced from deal speed preset */
  bankDrawMinDelayMs: number;
  /** @deprecated synced from deal speed preset */
  bankDrawMaxDelayMs: number;
  /** @deprecated synced from deal speed preset */
  bankStandPauseMs: number;
  /** @deprecated synced from deal speed preset */
  bankingDisplayMs: number;
  /** Global card deal interval preset — every card reveal uses this unless randomDealTiming is on. */
  dealSpeedPreset: DealSpeedPreset;
  /** Used when dealSpeedPreset is 'custom'. */
  customDealDelayMs: number;
  /** When true, each card reveal uses a random delay in [randomDealMinMs, randomDealMaxMs]. */
  randomDealTiming: boolean;
  randomDealMinMs: number;
  randomDealMaxMs: number;
  /** @deprecated legacy bank timer — ignored */
  cardTimerPreset: CardTimerPreset;
  /** @deprecated ignored */
  countdownSeconds: number;
  adviceEnabled: boolean;
  adviceCostMode: AdviceCostMode;
}

export const DEAL_SPEED_MS: Record<Exclude<DealSpeedPreset, 'custom'>, number> = {
  fast: 1000,
  medium: 2000,
  normal: 3000,
  slow: 5000,
};

export const DEFAULT_BLACKJACK_FLOW_SETTINGS: BlackjackFlowSettings = {
  initialDealMode: 'natural',
  bankDrawMode: 'auto',
  autoDealDelayMs: DEAL_SPEED_MS.normal,
  naturalDealDelayMs: DEAL_SPEED_MS.normal,
  bankAutoDrawDelayMs: DEAL_SPEED_MS.normal,
  bankDrawMinDelayMs: DEAL_SPEED_MS.normal,
  bankDrawMaxDelayMs: DEAL_SPEED_MS.normal,
  bankStandPauseMs: Math.round(DEAL_SPEED_MS.normal * 0.5),
  bankingDisplayMs: Math.round(DEAL_SPEED_MS.normal * 0.5),
  dealSpeedPreset: 'normal',
  customDealDelayMs: 3000,
  randomDealTiming: false,
  randomDealMinMs: 2000,
  randomDealMaxMs: 4000,
  countdownSeconds: 0,
  cardTimerPreset: 0,
  adviceEnabled: true,
  adviceCostMode: 'free',
};

export function normalizeFlowSettings(
  partial?: Partial<BlackjackFlowSettings & { initialDealMode?: unknown }>,
): BlackjackFlowSettings {
  const base = { ...DEFAULT_BLACKJACK_FLOW_SETTINGS, ...partial };
  return syncDealTimingFromPreset({
    ...base,
    initialDealMode: migrateInitialDealMode(partial?.initialDealMode ?? base.initialDealMode),
    customDealDelayMs: partial?.customDealDelayMs ?? base.customDealDelayMs ?? 3000,
    randomDealTiming: partial?.randomDealTiming ?? base.randomDealTiming ?? false,
    randomDealMinMs: partial?.randomDealMinMs ?? base.randomDealMinMs ?? 2000,
    randomDealMaxMs: partial?.randomDealMaxMs ?? base.randomDealMaxMs ?? 4000,
    cardTimerPreset: 0,
    countdownSeconds: 0,
  });
}

export function dealDelayMsForPreset(preset: DealSpeedPreset, customMs = 3000): number {
  if (preset === 'custom') {
    return Math.max(0, customMs);
  }
  return DEAL_SPEED_MS[preset];
}

/** Fixed interval from preset (ignores random mode). */
export function cardDealDelayMs(settings: BlackjackFlowSettings): number {
  return dealDelayMsForPreset(settings.dealSpeedPreset, settings.customDealDelayMs);
}

/** Single deal-speed source of truth — syncs legacy pacing fields from the preset. */
export function syncDealTimingFromPreset(settings: BlackjackFlowSettings): BlackjackFlowSettings {
  const delay = cardDealDelayMs(settings);
  return {
    ...settings,
    autoDealDelayMs: delay,
    naturalDealDelayMs: delay,
    bankAutoDrawDelayMs: delay,
    bankDrawMinDelayMs: delay,
    bankDrawMaxDelayMs: delay,
    bankStandPauseMs: delay,
    bankingDisplayMs: delay,
    cardTimerPreset: 0,
    countdownSeconds: 0,
  };
}

/**
 * Canonical delay for the next card reveal — ONE timing engine for every card.
 * Fixed preset/custom interval, or random [min,max] when randomDealTiming is on.
 */
export function getNextCardDelay(
  state: Pick<GameState, 'blackjackFlowSettings'>,
  settings?: BlackjackFlowSettings,
): number {
  const s = settings ?? state.blackjackFlowSettings;
  if (s.randomDealTiming) {
    const min = Math.min(s.randomDealMinMs, s.randomDealMaxMs);
    const max = Math.max(s.randomDealMinMs, s.randomDealMaxMs);
    if (max <= min) {
      return min;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  return cardDealDelayMs(s);
}

/** @deprecated use getNextCardDelay */
export function resolveCardDealDelayMs(settings: BlackjackFlowSettings): number {
  return getNextCardDelay({ blackjackFlowSettings: settings }, settings);
}

/** @deprecated context ignored — use getNextCardDelay */
export type CardDealDelayContext =
  | 'initial-deal'
  | 'hit'
  | 'split'
  | 'double'
  | 'dealer'
  | 'result-hold'
  | 'bank-pause'
  | 'bank-turn-start'
  | 'bank-card-draw'
  | 'hydration';

/** @deprecated use getNextCardDelay */
export function getBankTurnDelayMs(settings: BlackjackFlowSettings): number {
  return getNextCardDelay({ blackjackFlowSettings: settings }, settings);
}

/** @deprecated context ignored — use getNextCardDelay */
export function getCardDealDelayMs(
  state: Pick<GameState, 'blackjackFlowSettings'>,
  _context: CardDealDelayContext = 'initial-deal',
): number {
  return getNextCardDelay(state);
}

/** @deprecated use getNextCardDelay */
export function randomBankDrawDelayMs(settings: BlackjackFlowSettings): number {
  return getNextCardDelay({ blackjackFlowSettings: settings }, settings);
}

/** @deprecated ignored */
export const CARD_TIMER_PRESETS: CardTimerPreset[] = [0, 5, 10, 15, 30];

export function dealSpeedLabelForPreset(preset: DealSpeedPreset, customMs?: number): string {
  switch (preset) {
    case 'fast':
      return '1 sec';
    case 'medium':
      return '2 sec';
    case 'slow':
      return '5 sec';
    case 'custom':
      return customMs != null ? `${customMs / 1000} sec (custom)` : 'Custom';
    default:
      return '3 sec';
  }
}
