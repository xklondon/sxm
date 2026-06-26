import type { GameState } from '../../types';
import { deriveAllBalancesFromLedger } from '../ledger/ledger';
import { listHoldemPlayableSeatIds } from './holdemPlayableSeats';

/** Returns a user-facing error when Hold'em cannot start, or null when ready. */
export function validateHoldemStartHand(state: GameState): string | null {
  const seats = listHoldemPlayableSeatIds(state);
  if (seats.length < 2) {
    const isChallenge = state.tableMeta.pokerConfig?.mode === 'challenge';
    return isChallenge ? 'Waiting for invited player' : 'Need at least 2 players';
  }

  const balances = deriveAllBalancesFromLedger(state.session, state.ledger);
  for (const seatId of seats) {
    const balance = balances[seatId] ?? 0;
    const name = state.players[seatId]?.displayName ?? 'Player';
    if (balance <= 0) {
      return `${name} has no chips`;
    }
  }

  return null;
}
