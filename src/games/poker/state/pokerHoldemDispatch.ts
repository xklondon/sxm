import type { GameState } from '../../../types';
import {
  applyHoldemActionToState,
  shuffleHoldemDeckOnState,
  type HoldemActionApplyResult,
} from '../../../engine/holdem';
import type { HoldemAction, HoldemActionType } from '../../../engine/holdem/holdemActions';
import type { PokerPlayerAction } from './pokerTypes';

/** UI actions routed through the canonical holdem wrapper. */
export type PokerGameplayAction = PokerPlayerAction | 'all-in' | 'start-hand';

export function formatPokerHoldemActionError(
  error: string,
  _actionType?: HoldemActionType,
): string {
  return error;
}

export function mapPokerUiActionToHoldemAction(
  action: PokerGameplayAction,
  viewerSeatId: string | null,
  amount?: number,
): HoldemAction {
  const seat = viewerSeatId ?? undefined;
  const base = { actorSeatId: seat, requestedByPlayerId: seat };

  switch (action) {
    case 'start-hand':
      return { type: 'start-hand', requestedByPlayerId: seat };
    case 'check':
      return { type: 'check', ...base };
    case 'call':
      return { type: 'call', ...base };
    case 'fold':
      return { type: 'fold', ...base };
    case 'bet':
      return { type: 'bet', ...base, amount };
    case 'raise':
      return { type: 'raise', ...base, amount };
    case 'all-in':
      return { type: 'all-in', ...base };
    default:
      return { type: 'fold', ...base };
  }
}

/** Canonical offline poker gameplay mutation — delegates to engine wrapper. */
export function runPokerHoldemAction(
  state: GameState,
  action: HoldemAction,
): HoldemActionApplyResult {
  return applyHoldemActionToState(state, action);
}

export function runPokerShuffleDeck(state: GameState): HoldemActionApplyResult {
  return shuffleHoldemDeckOnState(state);
}

export type HoldemServerTableAction =
  | 'startHoldemHand'
  | 'holdemFold'
  | 'holdemCheck'
  | 'holdemCall'
  | 'holdemBet'
  | 'holdemRaise'
  | 'holdemAllIn'
  | 'holdemShuffleDeck';

export function mapPokerUiToServerTableAction(
  action: PokerGameplayAction,
  amount?: number,
): { type: HoldemServerTableAction; payload: Record<string, unknown> } {
  switch (action) {
    case 'start-hand':
      return { type: 'startHoldemHand', payload: {} };
    case 'fold':
      return { type: 'holdemFold', payload: {} };
    case 'check':
      return { type: 'holdemCheck', payload: {} };
    case 'call':
      return { type: 'holdemCall', payload: {} };
    case 'bet':
      return { type: 'holdemBet', payload: { amount: amount ?? 0 } };
    case 'raise':
      return { type: 'holdemRaise', payload: { amount: amount ?? 0 } };
    case 'all-in':
      return { type: 'holdemAllIn', payload: {} };
    default:
      return { type: 'holdemFold', payload: {} };
  }
}

export const HOLDEM_SHUFFLE_SERVER_ACTION = 'holdemShuffleDeck' as const;
export const HOLDEM_UPDATE_BLINDS_SERVER_ACTION = 'updateHoldemBlinds' as const;
export const HOLDEM_END_CHALLENGE_SERVER_ACTION = 'endHoldemChallenge' as const;
