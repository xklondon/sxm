/** Canonical Texas Hold'em state shapes — target model for Phase A+ migration. */

export type HoldemPhase =
  | 'waiting-for-players'
  | 'hand-start'
  | 'post-blinds'
  | 'deal-hole-cards'
  | 'preflop-betting'
  | 'flop'
  | 'flop-betting'
  | 'turn'
  | 'turn-betting'
  | 'river'
  | 'river-betting'
  | 'showdown'
  | 'hand-complete';

export type HoldemSeatStatus =
  | 'empty'
  | 'active'
  | 'folded'
  | 'all-in'
  | 'out';

export type HoldemPlayerHandState = {
  seatId: string;
  playerId?: string;
  stack: number;
  holeCardIds: string[];
  status: HoldemSeatStatus;
  committedThisStreet: number;
  committedThisHand: number;
  hasActedThisStreet: boolean;
};

export type HoldemSidePot = {
  id: string;
  amount: number;
  eligibleSeatIds: string[];
};

export type HoldemHandState = {
  phase: HoldemPhase;
  handNumber: number;
  dealerSeatId?: string;
  smallBlindSeatId?: string;
  bigBlindSeatId?: string;
  actingSeatId?: string;
  lastAggressorSeatId?: string;
  communityCardIds: string[];
  pot: number;
  sidePots: HoldemSidePot[];
  currentBet: number;
  minimumRaise: number;
  players: HoldemPlayerHandState[];
};
