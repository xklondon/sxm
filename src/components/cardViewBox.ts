import type { CardViewBoxStatus } from './blackjackViewPhase';

/** Box-card class names — desktop Card View box value + active highlight. */
export const BOX_CARD_BASE = 'bj-phone-view__mini-hand';
export const BOX_CARD_ACTIVE = 'bj-phone-view__mini-hand--active';
export const BOX_CARD_VALUE = 'bj-phone-view__box-value';
export const BOX_CARD_VALUE_ABOVE = 'bj-phone-view__box-value--above';
export const BOX_CARD_VALUE_BUST = 'bj-phone-view__box-value--bust';
export const BOX_CARD_COLUMN = 'bj-phone-view__mini-hand-column';
export const BOX_CARD_STAKE = 'bj-phone-view__box-stake';
export const BOX_CARD_STAKE_LABEL = 'bj-phone-view__box-stake-label';
export const BET_BOX_PULSE = 'bj-phone-view__bet-chip--pulse';

/**
 * Dominant hand-value label shown at the top of each box card.
 * Busted hands read "BUST"; empty hands render no label.
 */
export function getBoxCardValueLabel(
  value: number | null,
  status: CardViewBoxStatus,
): string {
  if (status === 'bust') {
    return 'BUST';
  }
  if (value === null || value <= 0) {
    return '';
  }
  return String(value);
}

/** Box card gets the active highlight only when it is the active turn box in play. */
export function getBoxCardClassName(isActive: boolean): string {
  return isActive ? `${BOX_CARD_BASE} ${BOX_CARD_ACTIVE}` : BOX_CARD_BASE;
}

/**
 * Betting pulse is derived purely from current state, so it stays applied
 * across re-renders (including WebSocket-driven state updates).
 */
export function getBetBoxPulseClassName(bettingOpen: boolean, hasBox: boolean): string {
  return bettingOpen && hasBox ? BET_BOX_PULSE : '';
}
