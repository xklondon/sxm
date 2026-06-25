import type { GameState } from '../../types';
import type { HoldemAction } from './holdemActions';
import { applyHoldemActionToState, shuffleHoldemDeckOnState } from './applyHoldemActionToState';
import { getHoldemPlayerIdForPerson } from './holdemTurnAuthority';

export const HOLDEM_GAMEPLAY_ACTIONS = [
  'startHoldemHand',
  'holdemFold',
  'holdemCheck',
  'holdemCall',
  'holdemBet',
  'holdemRaise',
  'holdemAllIn',
  'holdemShuffleDeck',
] as const;

export type HoldemGameplayAction = (typeof HOLDEM_GAMEPLAY_ACTIONS)[number];

export function isHoldemGameplayAction(action: string): action is HoldemGameplayAction {
  return (HOLDEM_GAMEPLAY_ACTIONS as readonly string[]).includes(action);
}

function mapHoldemGameplayActionToCanonical(
  state: GameState,
  action: HoldemGameplayAction,
  personId: string,
  payload: Record<string, unknown>,
): HoldemAction {
  const playerId = getHoldemPlayerIdForPerson(state, personId) ?? personId;
  const base = { actorSeatId: playerId, requestedByPlayerId: playerId };

  switch (action) {
    case 'startHoldemHand':
      return { type: 'start-hand', requestedByPlayerId: playerId };
    case 'holdemFold':
      return { type: 'fold', ...base };
    case 'holdemCheck':
      return { type: 'check', ...base };
    case 'holdemCall':
      return { type: 'call', ...base };
    case 'holdemBet':
      return { type: 'bet', ...base, amount: Number(payload.amount) };
    case 'holdemRaise':
      return { type: 'raise', ...base, amount: Number(payload.amount) };
    case 'holdemAllIn':
      return { type: 'all-in', ...base };
    default:
      throw new Error(`Unsupported Hold'em table action: ${action}`);
  }
}

/**
 * Server-side Hold'em gameplay reducer — maps table actions to canonical
 * `HoldemAction` and applies via `applyHoldemActionToState`.
 */
export function applyHoldemTableActionToState(
  state: GameState,
  action: HoldemGameplayAction,
  personId: string,
  payload: Record<string, unknown>,
): GameState {
  if (action === 'holdemShuffleDeck') {
    const result = shuffleHoldemDeckOnState(state);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.state;
  }

  const holdemAction = mapHoldemGameplayActionToCanonical(state, action, personId, payload);
  const result = applyHoldemActionToState(state, holdemAction);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.state;
}
