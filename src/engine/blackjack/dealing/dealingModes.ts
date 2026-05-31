/** Initial deal presentation modes. */
export type InitialDealMode = 'instant' | 'staged' | 'natural';

/** @deprecated legacy persisted values */
export type LegacyDealMode = 'auto' | 'manual';

export const DEFAULT_NATURAL_DEAL_DELAY_MS = 750;
export const NATURAL_DEAL_DELAY_MIN_MS = 600;
export const NATURAL_DEAL_DELAY_MAX_MS = 900;

export function migrateInitialDealMode(value: unknown): InitialDealMode {
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

/** True when engine deals one card at a time (staged or natural). */
export function isStepwiseInitialDeal(mode: InitialDealMode): boolean {
  return mode === 'staged' || mode === 'natural';
}

/** True when UI should auto-advance cards with delay. */
export function isNaturalInitialDeal(mode: InitialDealMode): boolean {
  return mode === 'natural';
}

export function clampNaturalDealDelayMs(ms: number): number {
  return Math.min(NATURAL_DEAL_DELAY_MAX_MS, Math.max(NATURAL_DEAL_DELAY_MIN_MS, ms));
}
