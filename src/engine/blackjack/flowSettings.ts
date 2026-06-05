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
  autoDealDelayMs: DEAL_SPEED_MS.normal,
  naturalDealDelayMs: DEAL_SPEED_MS.normal,
  bankAutoDrawDelayMs: DEAL_SPEED_MS.normal,
  bankDrawMinDelayMs: DEAL_SPEED_MS.normal,
  bankDrawMaxDelayMs: DEAL_SPEED_MS.normal,
  bankStandPauseMs: Math.round(DEAL_SPEED_MS.normal * 0.5),
  bankingDisplayMs: Math.round(DEAL_SPEED_MS.normal * 0.5),
  dealSpeedPreset: 'normal',
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
  | 'bank-pause'
  | 'hydration';

/** Single timing source for every card reveal / bank pacing delay. */
export function getCardDealDelayMs(
  state: Pick<GameState, 'blackjackFlowSettings'>,
  _context: CardDealDelayContext = 'initial-deal',
): number {
  void _context;
  return cardDealDelayMs(state.blackjackFlowSettings);
}

/** Bank draw pacing — uses the same deal-speed delay as player cards. */
export function randomBankDrawDelayMs(settings: BlackjackFlowSettings): number {
  return cardDealDelayMs(settings);
}

export const CARD_TIMER_PRESETS: CardTimerPreset[] = [0, 5, 10, 15, 30];
