export const DEFAULT_NATURAL_DEAL_DELAY_MS = 750;
export const NATURAL_DEAL_DELAY_MIN_MS = 600;
export const NATURAL_DEAL_DELAY_MAX_MS = 900;
export function migrateInitialDealMode(value) {
    if (value === 'instant' || value === 'staged' || value === 'natural') {
        return value;
    }
    if (value === 'auto') {
        return 'instant';
    }
    if (value === 'manual') {
        return 'staged';
    }
    return 'instant';
}
/** True when the engine leaves the round in `initial-deal` for manual next-card dealing. */
export function isStagedInitialDeal(mode) {
    return mode === 'staged';
}
/** @deprecated Use isStagedInitialDeal — natural/instant deal authoritatively in one pass. */
export function isStepwiseInitialDeal(mode) {
    return isStagedInitialDeal(mode);
}
/** True when UI should auto-advance cards with delay. */
export function isNaturalInitialDeal(mode) {
    return mode === 'natural';
}
export function isInstantInitialDeal(mode) {
    return mode === 'instant';
}
export function isPacedCardReveal(mode) {
    return mode === 'staged' || mode === 'natural';
}
export function clampNaturalDealDelayMs(ms) {
    return Math.min(NATURAL_DEAL_DELAY_MAX_MS, Math.max(NATURAL_DEAL_DELAY_MIN_MS, ms));
}
