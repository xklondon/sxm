import type { GameState } from '../types';
import type { CardViewBoxStatus } from './blackjackViewPhase';
import { isCallerForBox } from '../engine/session/playerAssignment';

/** Box-card class names — desktop Card View box value + active highlight. */
export const BOX_CARD_BASE = 'bj-phone-view__mini-hand';
export const BOX_CARD_ACTIVE = 'bj-phone-view__mini-hand--active';
export const BOX_CARD_VALUE = 'bj-phone-view__box-value';
export const BOX_CARD_VALUE_ABOVE = 'bj-phone-view__box-value--above';
export const BOX_CARD_VALUE_BUST = 'bj-phone-view__box-value--bust';
export const BOX_CARD_COLUMN = 'bj-phone-view__mini-hand-column';
export const BOX_CARD_STAKE_LABEL = 'bj-phone-view__box-stake-label';
export const BOX_CARD_STAKE_LABEL_RESERVED = 'bj-phone-view__box-stake-label--reserved';
export const BOX_CARD_CHIP_STACK = 'bj-phone-view__box-chip-stack';
export const BOX_CARD_CHIP_STACK_RESERVED = 'bj-phone-view__box-chip-stack--reserved';
export const BOX_CARD_VALUE_RESERVED = 'bj-phone-view__box-value--reserved';
/** @deprecated Use BOX_CARD_CHIP_STACK — stake wrapper removed for stable grid rows. */
export const BOX_CARD_STAKE = 'bj-phone-view__box-chip-stack';
export const BET_BOX_PULSE = 'bj-phone-view__bet-chip--pulse';

/** Card View layout CSS custom properties — canonical values live in bj-card-layout.css */
export const CARD_VIEW_CSS_TOKENS = {
  heroCardAspectRatio: '--bj-card-hero-card-aspect-ratio',
  heroCardWidth: '--bj-card-hero-card-width',
  totalMinHeight: '--bj-card-total-min-height',
  actionSecondaryHeight: '--bj-card-action-secondary-height',
  miniCardScale: '--bj-card-mini-card-scale',
} as const;

/** True when the slot's native assignment belongs to this person. */
export function isCardViewBoxNativeForPerson(
  state: GameState,
  boxPlayerId: string,
  personId: string | null | undefined,
): boolean {
  if (!personId) {
    return false;
  }
  const slot = state.tableMeta.boxSlots.find((s) => s.playerId === boxPlayerId);
  return slot?.nativeAssignedPersonId === personId;
}

/**
 * Card View betting display: native boxes look assigned by default; free boxes
 * only after this viewer has staked (first-bettor ownership), never on click alone.
 */
export function isCardViewBettingBoxVisuallyAssigned(
  state: GameState,
  boxPlayerId: string,
  openStake: number,
  viewerPersonId: string | null | undefined,
): boolean {
  if (isCardViewBoxNativeForPerson(state, boxPlayerId, viewerPersonId)) {
    return true;
  }
  if (openStake <= 0 || !viewerPersonId) {
    return false;
  }
  return isCallerForBox(state, boxPlayerId, viewerPersonId);
}

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
