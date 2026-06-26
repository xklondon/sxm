import type { Card } from '../../../types/deck';

export type PokerStreet =
  | 'setup'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'resolved';

export type PokerPlayerAction = 'check' | 'call' | 'bet' | 'raise' | 'fold' | 'all-in';

export interface PokerHoleCards {
  faceDown: boolean;
  cards: Card[];
}

export interface PokerSeatViewModel {
  seatIndex: number;
  playerId: string;
  displayName: string;
  controllerName?: string;
  chipCount: number;
  streetBet: number;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isActive: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  isWinner: boolean;
  isViewer: boolean;
  actionStatus: string;
  holeCards: PokerHoleCards | null;
}

export interface PokerTableViewModel {
  tableName: string;
  street: PokerStreet;
  pot: number;
  sidePotCount: number;
  currentBet: number;
  smallBlind: number;
  bigBlind: number;
  communityCards: Card[];
  seats: PokerSeatViewModel[];
  activePlayerId: string | null;
  actionLog: string[];
  resultSummary?: string;
  winningHandLabel?: string;
  payoutSummary?: string[];
  winningSeatIds?: string[];
  viewerSeatId?: string | null;
}

export interface PokerActionAvailability {
  canCheck: boolean;
  canCall: boolean;
  canBet: boolean;
  canRaise: boolean;
  canFold: boolean;
  canAllIn: boolean;
  callAmount: number;
  allInAmount: number;
  allInDisabledReason?: string;
  minBet: number;
  minRaise: number;
}

export interface PokerChatMessage {
  id: string;
  author: string;
  body: string;
  timestamp: number;
}

export interface PokerSeatPosition {
  left: string;
  top: string;
}

/** Place seats on an elliptical ring; seat 0 sits at the bottom (hero). */
export function pokerSeatPosition(seatIndex: number, totalSeats: number): PokerSeatPosition {
  const safeTotal = Math.max(totalSeats, 1);
  const angle = Math.PI / 2 + (2 * Math.PI * seatIndex) / safeTotal;
  const rx = 44;
  const ry = 40;
  const left = 50 + rx * Math.cos(angle);
  const top = 50 + ry * Math.sin(angle);
  return { left: `${left.toFixed(2)}%`, top: `${top.toFixed(2)}%` };
}

/** Rotate seats so the viewer (when set) renders at the bottom of the ring. */
export function rotateSeatsForViewer(seats: PokerSeatViewModel[]): PokerSeatViewModel[] {
  const viewerIndex = seats.findIndex((seat) => seat.isViewer);
  if (viewerIndex <= 0) {
    return seats;
  }
  return [...seats.slice(viewerIndex), ...seats.slice(0, viewerIndex)].map((seat, index) => ({
    ...seat,
    seatIndex: index,
  }));
}
