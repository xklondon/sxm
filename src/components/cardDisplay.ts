import type { Rank, Suit } from '../types/deck';

/** Normalized pip positions for ranks 2–10 (x%, y%). */
export const PIP_LAYOUTS: Record<
  Exclude<Rank, 'J' | 'Q' | 'K' | 'A'>,
  Array<{ x: number; y: number; invert?: boolean }>
> = {
  '2': [
    { x: 50, y: 22 },
    { x: 50, y: 78, invert: true },
  ],
  '3': [
    { x: 50, y: 18 },
    { x: 50, y: 50 },
    { x: 50, y: 82, invert: true },
  ],
  '4': [
    { x: 28, y: 22 },
    { x: 72, y: 22 },
    { x: 28, y: 78, invert: true },
    { x: 72, y: 78, invert: true },
  ],
  '5': [
    { x: 28, y: 22 },
    { x: 72, y: 22 },
    { x: 50, y: 50 },
    { x: 28, y: 78, invert: true },
    { x: 72, y: 78, invert: true },
  ],
  '6': [
    { x: 28, y: 20 },
    { x: 72, y: 20 },
    { x: 28, y: 50 },
    { x: 72, y: 50 },
    { x: 28, y: 80, invert: true },
    { x: 72, y: 80, invert: true },
  ],
  '7': [
    { x: 28, y: 20 },
    { x: 72, y: 20 },
    { x: 50, y: 35 },
    { x: 28, y: 50 },
    { x: 72, y: 50 },
    { x: 28, y: 80, invert: true },
    { x: 72, y: 80, invert: true },
  ],
  '8': [
    { x: 28, y: 18 },
    { x: 72, y: 18 },
    { x: 28, y: 38 },
    { x: 72, y: 38 },
    { x: 28, y: 62, invert: true },
    { x: 72, y: 62, invert: true },
    { x: 28, y: 82, invert: true },
    { x: 72, y: 82, invert: true },
  ],
  '9': [
    { x: 28, y: 16 },
    { x: 72, y: 16 },
    { x: 28, y: 36 },
    { x: 72, y: 36 },
    { x: 50, y: 50 },
    { x: 28, y: 64, invert: true },
    { x: 72, y: 64, invert: true },
    { x: 28, y: 84, invert: true },
    { x: 72, y: 84, invert: true },
  ],
  '10': [
    { x: 28, y: 14 },
    { x: 72, y: 14 },
    { x: 50, y: 24 },
    { x: 28, y: 34 },
    { x: 72, y: 34 },
    { x: 28, y: 66, invert: true },
    { x: 72, y: 66, invert: true },
    { x: 50, y: 76, invert: true },
    { x: 28, y: 86, invert: true },
    { x: 72, y: 86, invert: true },
  ],
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function isPipRank(rank: Rank): rank is Exclude<Rank, 'J' | 'Q' | 'K' | 'A'> {
  return rank !== 'J' && rank !== 'Q' && rank !== 'K' && rank !== 'A';
}

export function isFaceRank(rank: Rank): boolean {
  return rank === 'J' || rank === 'Q' || rank === 'K';
}

/** Compact rank+suit label for player-box hand composition (e.g. `10♠`). */
export function formatShortCardLabel(card: { rank: Rank; suit: Suit }): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}
