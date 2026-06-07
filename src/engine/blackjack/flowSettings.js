/** Front-end Blackjack flow controls — persisted via settingsStorage. */
import { migrateInitialDealMode, } from './dealing/dealingModes';
export const DEAL_SPEED_MS = {
    fast: 1000,
    normal: 3000,
    slow: 5000,
};
export const DEFAULT_BLACKJACK_FLOW_SETTINGS = {
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
export function normalizeFlowSettings(partial) {
    const base = { ...DEFAULT_BLACKJACK_FLOW_SETTINGS, ...partial };
    return syncDealTimingFromPreset({
        ...base,
        initialDealMode: migrateInitialDealMode(partial?.initialDealMode ?? base.initialDealMode),
    });
}
export function dealDelayMsForPreset(preset) {
    return DEAL_SPEED_MS[preset];
}
/** Single deal-speed source of truth — syncs all pacing fields from the preset. */
export function syncDealTimingFromPreset(settings) {
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
export function cardDealDelayMs(settings) {
    return dealDelayMsForPreset(settings.dealSpeedPreset);
}
/** Seconds to wait after the last player before bank begins (independent of deal speed). */
export function getBankTurnDelayMs(settings) {
    return settings.cardTimerPreset * 1000;
}
/** Single timing source for sequential card reveal between player cards. */
export function getCardDealDelayMs(state, context = 'initial-deal') {
    if (context === 'bank-pause' || context === 'bank-turn-start') {
        return getBankTurnDelayMs(state.blackjackFlowSettings);
    }
    return cardDealDelayMs(state.blackjackFlowSettings);
}
/** Bank draw pacing between individual bank cards — uses deal speed, not bank timer. */
export function randomBankDrawDelayMs(settings) {
    return cardDealDelayMs(settings);
}
export const CARD_TIMER_PRESETS = [0, 5, 10, 15, 30];
