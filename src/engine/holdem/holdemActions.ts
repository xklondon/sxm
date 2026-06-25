/** Canonical Texas Hold'em gameplay action types. */

export type HoldemActionType =
  | 'start-hand'
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'all-in'
  | 'advance-street'
  | 'complete-hand';

export type HoldemAction = {
  type: HoldemActionType;
  actorSeatId?: string;
  amount?: number;
  requestedByPlayerId?: string;
  tableOwnerId?: string;
};
