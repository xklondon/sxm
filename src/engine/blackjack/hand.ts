import type { Card, Rank } from '../../types/deck';

export type BlackjackHandStatus = 'empty' | 'playing' | 'busted' | 'blackjack';

export interface BlackjackHandValue {
  value: number;
  isSoft: boolean;
  isBlackjack: boolean;
}

function rankBaseValue(rank: Rank): number {
  if (rank === 'A') {
    return 11;
  }
  if (rank === 'K' || rank === 'Q' || rank === 'J') {
    return 10;
  }
  return Number.parseInt(rank, 10);
}

export function getBlackjackHandValue(cards: Card[]): BlackjackHandValue {
  if (cards.length === 0) {
    return { value: 0, isSoft: false, isBlackjack: false };
  }

  let value = 0;
  let aces = 0;

  for (const card of cards) {
    value += rankBaseValue(card.rank);
    if (card.rank === 'A') {
      aces += 1;
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  const isSoft = aces > 0 && value <= 21;
  const isBlackjack = cards.length === 2 && value === 21;

  return { value, isSoft, isBlackjack };
}

/** Lowest total when every Ace counts as 1 — used for player auto-stand decisions. */
export function getMinimumBlackjackHandValue(cards: Card[]): number {
  let value = 0;
  for (const card of cards) {
    value += card.rank === 'A' ? 1 : rankBaseValue(card.rank);
  }
  return value;
}

/** Total used for auto-stand threshold — hard/minimum when the hand contains an Ace. */
export function getAutoStandDecisionTotal(cards: Card[]): number {
  if (!cards.some((card) => card.rank === 'A')) {
    return getBlackjackHandValue(cards).value;
  }
  return getMinimumBlackjackHandValue(cards);
}

export function getBlackjackHandStatus(cards: Card[]): BlackjackHandStatus {
  if (cards.length === 0) {
    return 'empty';
  }

  const { value, isBlackjack } = getBlackjackHandValue(cards);

  if (isBlackjack) {
    return 'blackjack';
  }
  if (value > 21) {
    return 'busted';
  }
  return 'playing';
}

export function cardsFromIds(deck: import('../../types/deck').Deck, ids: string[] | undefined): Card[] {
  const byId = new Map(deck.cards.map((c) => [c.id, c]));
  return (ids ?? [])
    .map((id) => byId.get(id))
    .filter((c): c is Card => c !== undefined);
}
