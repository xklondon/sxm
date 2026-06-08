import type { GameState } from '../types';
import type { CardViewBoxStatus } from './blackjackViewPhase';
import { getStakeForBox } from '../engine/blackjack/stakes';
import { getCallerPersonIdForBox, isCallerForBox } from '../engine/session/playerAssignment';
import { getStakerPersonIdsForBox } from '../engine/session/tableBoxDisplay';

/** Box-card class names — desktop Card View box value + highlight states. */
export const BOX_CARD_BASE = 'bj-phone-view__mini-hand';
/** @deprecated Use BOX_BORDER_TURN — active player turn glow. */
export const BOX_CARD_ACTIVE = 'bj-phone-view__mini-hand--active';
/** @deprecated Use BOX_BORDER_SELECTED */
export const BOX_CARD_SELECTED = 'bj-box--selected';
/** @deprecated Use BOX_BORDER_NATIVE / BOX_BORDER_RUNNING */
export const BOX_CARD_ASSIGNED = 'bj-phone-view__mini-hand--assigned';
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

/** Semantic box border states — shared by Full Table + Card View. */
export const BOX_BORDER_NATIVE = 'bj-box--native-assigned';
export const BOX_BORDER_RUNNING = 'bj-box--running';
export const BOX_BORDER_CO_BOX = 'bj-box--co-box';
export const BOX_BORDER_SELECTED = 'bj-box--selected';
export const BOX_BORDER_TURN = 'bj-box--turn';
export const BOX_BORDER_DROP_HOVER = 'bj-box--drop-hover';

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

export interface BoxBorderVisualInput {
  state: GameState;
  boxPlayerId: string;
  viewerPersonId: string | null | undefined;
  openStake?: number;
  selectedBettingBoxId?: string | null;
  selectedBettingSlotNumber?: number | null;
  activeBoxId?: string | null;
  isDropHover?: boolean;
  /** True during betting / chip placement. */
  bettingStage?: boolean;
  /** True during player-turn phase (not betting). */
  playerPhase?: boolean;
}

export interface BoxBorderVisualState {
  isNativeAssigned: boolean;
  isRunning: boolean;
  isCoBox: boolean;
  isSelected: boolean;
  isTurn: boolean;
  isDropHover: boolean;
}

/** Resolve semantic box border flags from table + viewer context. */
export function resolveBoxBorderVisualState(input: BoxBorderVisualInput): BoxBorderVisualState {
  const {
    state,
    boxPlayerId,
    viewerPersonId,
    selectedBettingBoxId,
    selectedBettingSlotNumber,
    activeBoxId,
    isDropHover,
    bettingStage = false,
    playerPhase = false,
  } = input;
  const openStake = input.openStake ?? getStakeForBox(state, boxPlayerId);
  const slotNumber = state.tableMeta.boxSlots.find((s) => s.playerId === boxPlayerId)?.slotNumber;
  const isSelected = Boolean(
    bettingStage &&
      (selectedBettingBoxId === boxPlayerId ||
        (selectedBettingSlotNumber != null &&
          slotNumber != null &&
          selectedBettingSlotNumber === slotNumber)),
  );
  const isTurn = Boolean(playerPhase && activeBoxId === boxPlayerId);
  const isNative = isCardViewBoxNativeForPerson(state, boxPlayerId, viewerPersonId);

  let isNativeAssigned = false;
  let isRunning = false;
  let isCoBox = false;

  if (viewerPersonId) {
    if (isNative) {
      isNativeAssigned = true;
    } else if (openStake > 0) {
      const caller = getCallerPersonIdForBox(state, boxPlayerId);
      const stakers = getStakerPersonIdsForBox(state, boxPlayerId);
      if (stakers.includes(viewerPersonId)) {
        if (caller === viewerPersonId) {
          isRunning = true;
        } else {
          isCoBox = true;
        }
      }
    }
  }

  return {
    isNativeAssigned,
    isRunning,
    isCoBox,
    isSelected,
    isTurn,
    isDropHover: Boolean(isDropHover),
  };
}

/** CSS classes for ownership/drop/selection borders — pulse is layered separately. */
export function getBoxBorderVisualClasses(resolved: BoxBorderVisualState): string {
  const parts: string[] = [];
  if (resolved.isNativeAssigned) {
    parts.push(BOX_BORDER_NATIVE);
  } else if (resolved.isRunning) {
    parts.push(BOX_BORDER_RUNNING);
  } else if (resolved.isCoBox) {
    parts.push(BOX_BORDER_CO_BOX);
  }
  if (resolved.isDropHover) {
    parts.push(BOX_BORDER_DROP_HOVER);
  }
  return parts.join(' ');
}

export interface BoxCardVisualState {
  isSelected?: boolean;
  isAssigned?: boolean;
  isTurn?: boolean;
}

/** Compose box tile classes from resolved border state + base shell. */
export function getBoxCardVisualClasses(
  border: BoxBorderVisualState | BoxCardVisualState,
): string {
  if ('isNativeAssigned' in border) {
    return [BOX_CARD_BASE, getBoxBorderVisualClasses(border)].filter(Boolean).join(' ');
  }
  const legacy: BoxBorderVisualState = {
    isNativeAssigned: Boolean(border.isAssigned && !border.isSelected),
    isRunning: false,
    isCoBox: false,
    isSelected: Boolean(border.isSelected),
    isTurn: Boolean(border.isTurn),
    isDropHover: false,
  };
  return [BOX_CARD_BASE, getBoxBorderVisualClasses(legacy)].filter(Boolean).join(' ');
}

/** @deprecated Prefer getBoxCardVisualClasses with resolveBoxBorderVisualState. */
export function getBoxCardClassName(isActive: boolean): string {
  return isActive ? `${BOX_CARD_BASE} ${BOX_BORDER_TURN}` : BOX_CARD_BASE;
}

/** Pulse for local chip target (betting) or active player turn (play). */
export function getBoxActivePulseClassName(
  resolved: Pick<BoxBorderVisualState, 'isSelected' | 'isTurn'>,
): string {
  return resolved.isSelected || resolved.isTurn ? BET_BOX_PULSE : '';
}

/**
 * @deprecated Prefer getBoxActivePulseClassName(borderState).
 * Betting pulse applies only to the selected chip target — not every assigned box.
 */
export function getBetBoxPulseClassName(isChipTarget: boolean, isActiveTurn = false): string {
  return isChipTarget || isActiveTurn ? BET_BOX_PULSE : '';
}
