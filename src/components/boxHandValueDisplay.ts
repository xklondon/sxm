import type { Deck } from '../types/deck';
import type { BlackjackRound } from '../types/blackjack';
import { getDisplayedHandValue } from '../engine/blackjack/dealing/cardRevealDisplay';
import type { BoxNetResultTone } from './boxBetResultDisplay';
import {
  BOX_CARD_VALUE,
  BOX_CARD_VALUE_ABOVE,
  BOX_CARD_VALUE_BUST,
  BOX_NET_RESULT,
} from './cardViewBox';

/** Shared box/card-column hand total — same rules as Card View hero and player box tiles. */
export function resolvePrimaryHandValueLabel(
  deck: Deck | null | undefined,
  round: BlackjackRound | null | undefined,
  primaryHandKey: string | undefined,
  primaryHand: { actionStatus?: string } | null | undefined,
): string {
  if (primaryHand?.actionStatus === 'busted') {
    return 'BUST';
  }
  if (!deck || !round || !primaryHandKey) {
    return '';
  }
  const displayValue = getDisplayedHandValue(deck, round, primaryHandKey);
  if (displayValue === null || displayValue <= 0) {
    return '';
  }
  return String(displayValue);
}

/** Stake / net label above player box — no hand-total emphasis styling. */
export function boxStakeLabelClassName(
  hasLabel: boolean,
  isBusted: boolean,
  netTone?: BoxNetResultTone | null,
): string {
  if (!hasLabel) {
    return `${BOX_CARD_VALUE} ${BOX_CARD_VALUE_ABOVE} ${BOX_CARD_VALUE}--placeholder`;
  }
  const showBustStyle = isBusted || netTone === 'loss';
  return [
    BOX_CARD_VALUE,
    BOX_CARD_VALUE_ABOVE,
    showBustStyle ? BOX_CARD_VALUE_BUST : '',
    netTone === 'win' ? 'bj-phone-view__box-value--win' : '',
    netTone === 'even' ? 'bj-phone-view__box-value--even' : '',
    netTone !== null && netTone !== undefined ? BOX_NET_RESULT : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function boxValueSpanClassName(
  hasLabel: boolean,
  isBusted: boolean,
  netTone?: BoxNetResultTone | null,
): string {
  if (!hasLabel) {
    return `${BOX_CARD_VALUE} ${BOX_CARD_VALUE_ABOVE} ${BOX_CARD_VALUE}--placeholder`;
  }
  const showBustStyle = isBusted || netTone === 'loss';
  return [
    BOX_CARD_VALUE,
    BOX_CARD_VALUE_ABOVE,
    'bj-player-hand-value--emphasis',
    showBustStyle ? BOX_CARD_VALUE_BUST : '',
    netTone === 'win' ? 'bj-phone-view__box-value--win' : '',
    netTone === 'even' ? 'bj-phone-view__box-value--even' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Card-column hand total — no box emphasis; active turn uses circular highlight only. */
export function cardColumnHandValueClassName(
  hasLabel: boolean,
  isBusted: boolean,
  isActiveTurn: boolean,
  netTone?: BoxNetResultTone | null,
): string {
  if (!hasLabel) {
    return `${BOX_CARD_VALUE} ${BOX_CARD_VALUE}--placeholder`;
  }
  const showBustStyle = isBusted || netTone === 'loss';
  return [
    BOX_CARD_VALUE,
    isActiveTurn ? 'bj-phone-view__box-value--active-turn' : '',
    showBustStyle ? BOX_CARD_VALUE_BUST : '',
    netTone === 'win' ? 'bj-phone-view__box-value--win' : '',
    netTone === 'even' ? 'bj-phone-view__box-value--even' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
