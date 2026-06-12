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
export type DealSpeedPreset = 'fast' | 'normal' | 'slow';

export type CardTimerPreset = 0 | 5 | 10 | 15 | 30;

export interface BlackjackFlowSettings {
  /** instant = all at once; staged = one card per tap; natural = auto one-at-a-time with delay */
  initialDealMode: InitialDealMode;
  bankDrawMode: 'manual' | 'auto';
  autoDealDelayMs: number;
  /** Derived from dealSpeedPreset — delay between cards in natural dealing mode. */
  naturalDealDelayMs: number;
  /** @deprecated derived from dealSpeedPreset */
  bankAutoDrawDelayMs: number;
  bankDrawMinDelayMs: number;
  bankDrawMaxDelayMs: number;
  bankStandPauseMs: number;
  bankingDisplayMs: number;
  dealSpeedPreset: DealSpeedPreset;
  /** @deprecated use cardTimerPreset */
  countdownSeconds: number;
  /** Seconds until auto Cards after bets lock; 0 = deal immediately. */
  cardTimerPreset: CardTimerPreset;
  adviceEnabled: boolean;
  adviceCostMode: AdviceCostMode;
}

export const DEAL_SPEED_MS: Record<DealSpeedPreset, number> = {
  fast: 1000,
  normal: 3000,
  slow: 5000,
};

export const DEFAULT_BLACKJACK_FLOW_SETTINGS: BlackjackFlowSettings = {
  initialDealMode: 'natural',
  bankDrawMode: 'auto',
  autoDealDelayMs: DEAL_SPEED_MS.fast,
  naturalDealDelayMs: DEAL_SPEED_MS.fast,
  bankAutoDrawDelayMs: DEAL_SPEED_MS.fast,
  bankDrawMinDelayMs: DEAL_SPEED_MS.fast,
  bankDrawMaxDelayMs: DEAL_SPEED_MS.fast,
  bankStandPauseMs: Math.round(DEAL_SPEED_MS.fast * 0.5),
  bankingDisplayMs: Math.round(DEAL_SPEED_MS.fast * 0.5),
  dealSpeedPreset: 'fast',
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
  });
}

export function dealDelayMsForPreset(preset: DealSpeedPreset): number {
  return DEAL_SPEED_MS[preset];
}

/** Single deal-speed source of truth — syncs all pacing fields from the preset. */
export function syncDealTimingFromPreset(settings: BlackjackFlowSettings): BlackjackFlowSettings {
  const delay = dealDelayMsForPreset(settings.dealSpeedPreset);
  const pause = Math.round(delay * 0.5);
  return {
    ...settings,
    autoDealDelayMs: delay,
    naturalDealDelayMs: delay,
    bankAutoDrawDelayMs: delay,
    bankDrawMinDelayMs: delay,
    bankDrawMaxDelayMs: delay,
    bankStandPauseMs: pause,
    bankingDisplayMs: pause,
  };
}

export function cardDealDelayMs(settings: BlackjackFlowSettings): number {
  return dealDelayMsForPreset(settings.dealSpeedPreset);
}

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

/** Seconds to wait after the last player before bank begins (independent of deal speed). */
export function getBankTurnDelayMs(settings: BlackjackFlowSettings): number {
  return settings.cardTimerPreset * 1000;
}

/** Single timing source for sequential card reveal between player cards. */
export function getCardDealDelayMs(
  state: Pick<GameState, 'blackjackFlowSettings'>,
  context: CardDealDelayContext = 'initial-deal',
): number {
  if (
    context === 'bank-pause' ||
    context === 'bank-turn-start' ||
    context === 'bank-card-draw'
  ) {
    return getBankTurnDelayMs(state.blackjackFlowSettings);
  }
  if (context === 'result-hold') {
    return cardDealDelayMs(state.blackjackFlowSettings);
  }
  return cardDealDelayMs(state.blackjackFlowSettings);
}

/** Bank draw pacing between individual bank cards — uses deal speed, not bank timer. */
export function randomBankDrawDelayMs(settings: BlackjackFlowSettings): number {
  return cardDealDelayMs(settings);
}

export const CARD_TIMER_PRESETS: CardTimerPreset[] = [0, 5, 10, 15, 30];
