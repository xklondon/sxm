import type { GameState } from '../../types';
import type { Card } from '../../types/deck';
import { cardsFromIds, getBlackjackHandValue } from './hand';
import { getVisibleDealerCardIds } from './protocolState';

export interface DealerDisplayHand {
  cardIds: string[];
  cards: Card[];
  value: number;
  isSoft: boolean;
  isBlackjack: boolean;
}

/** Single source for dealer cards shown in UI and derived totals. */
export function getDealerDisplayHand(state: GameState): DealerDisplayHand | null {
  const round = state.blackjack;
  const deck = state.deck;
  if (!round || !deck) {
    return null;
  }
  const cardIds = getVisibleDealerCardIds(state);
  if (cardIds.length === 0) {
    return null;
  }
  const valueCardIds =
    round.dealerHoleHidden &&
    round.status !== 'bank-turn' &&
    round.status !== 'banking' &&
    round.status !== 'resolved' &&
    cardIds.length > 1
      ? cardIds.slice(0, 1)
      : cardIds;
  const cards = cardsFromIds(deck, valueCardIds);
  const { value, isSoft, isBlackjack } = getBlackjackHandValue(cards);
  return { cardIds, cards: cardsFromIds(deck, cardIds), value, isSoft, isBlackjack };
}

/** Authoritative dealer hand for settlement / bank-final messages (all dealt cards). */
export function getDealerAuthoritativeHand(state: GameState): DealerDisplayHand | null {
  const round = state.blackjack;
  const deck = state.deck;
  if (!round || !deck) {
    return null;
  }
  const cardIds = round.dealerCardIds.filter(Boolean);
  if (cardIds.length === 0) {
    return null;
  }
  const cards = cardsFromIds(deck, cardIds);
  const { value, isSoft, isBlackjack } = getBlackjackHandValue(cards);
  return { cardIds, cards, value, isSoft, isBlackjack };
}
