/** Front-end Blackjack flow controls — persisted via settingsStorage. */



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

  /** Delay between cards in natural dealing mode (600–900ms default). */

  naturalDealDelayMs: number;

  /** @deprecated use bankDrawMinDelayMs / bankDrawMaxDelayMs */

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

  fast: 280,

  normal: 550,

  slow: 900,

};



export const DEFAULT_BLACKJACK_FLOW_SETTINGS: BlackjackFlowSettings = {

  initialDealMode: 'instant',

  bankDrawMode: 'auto',

  autoDealDelayMs: 550,

  naturalDealDelayMs: 750,

  bankAutoDrawDelayMs: 3000,

  bankDrawMinDelayMs: 2000,

  bankDrawMaxDelayMs: 5000,

  bankStandPauseMs: 1500,

  bankingDisplayMs: 1500,

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

  return {

    ...base,

    initialDealMode: migrateInitialDealMode(partial?.initialDealMode ?? base.initialDealMode),

  };

}



export function dealDelayMsForPreset(preset: DealSpeedPreset): number {

  return DEAL_SPEED_MS[preset];

}



/** Random delay between bank draws (inclusive min–max). */

export function randomBankDrawDelayMs(settings: BlackjackFlowSettings): number {

  const min = Math.min(settings.bankDrawMinDelayMs, settings.bankDrawMaxDelayMs);

  const max = Math.max(settings.bankDrawMinDelayMs, settings.bankDrawMaxDelayMs);

  if (max <= min) {

    return min;

  }

  return min + Math.floor(Math.random() * (max - min + 1));

}

export const CARD_TIMER_PRESETS: CardTimerPreset[] = [0, 5, 10, 15, 30];

