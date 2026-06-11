import type { Deck } from '../types/deck';
import type { BlackjackRound } from '../types/blackjack';
import { getDisplayedHandValue } from '../engine/blackjack/dealing/cardRevealDisplay';
import {
  BOX_CARD_VALUE,
  BOX_CARD_VALUE_ABOVE,
  BOX_CARD_VALUE_BUST,
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

export function boxValueSpanClassName(hasLabel: boolean, isBusted: boolean): string {
  if (!hasLabel) {
    return `${BOX_CARD_VALUE} ${BOX_CARD_VALUE_ABOVE} ${BOX_CARD_VALUE}--placeholder`;
  }
  return [BOX_CARD_VALUE, BOX_CARD_VALUE_ABOVE, isBusted ? BOX_CARD_VALUE_BUST : '']
    .filter(Boolean)
    .join(' ');
}
