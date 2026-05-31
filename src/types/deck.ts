export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface Deck {
  id: string;
  cards: Card[];
  /** Indices into `cards` still in the deck; top of deck = last element. */
  drawOrder: number[];
  dealtCardIds: string[];
  /** Number of standard decks when built as a shoe (optional). */
  deckCount?: number;
}

export function createEmptyDeck(id: string): Deck {
  return {
    id,
    cards: [],
    drawOrder: [],
    dealtCardIds: [],
  };
}

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

export const RANKS: Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

const SUIT_LETTERS: Record<Suit, string> = {
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
  spades: 'S',
};

export function cardIdFor(rank: Rank, suit: Suit): string {
  return `${rank}${SUIT_LETTERS[suit]}`;
}

export function getDealingStatusFromDeck(deck: Deck | null): import('./session').DealingStatus {
  if (!deck || deck.cards.length === 0) {
    return 'no-deck';
  }
  if (deck.drawOrder.length === 0) {
    return 'depleted';
  }
  return 'ready';
}
