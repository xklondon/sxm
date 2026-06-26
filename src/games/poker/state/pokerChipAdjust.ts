import type { GameState } from '../../../types';
import { allocateChipsToBankrollOwner } from '../../../engine/session/allocation';

/** Practice-only chip top-up for a seated poker player. */
export function addPokerPracticeChips(
  state: GameState,
  playerId: string,
  amount: number,
): GameState {
  const player = state.players[playerId];
  if (!player) {
    return state;
  }
  const bankrollOwnerId = player.bankrollOwnerId ?? playerId;
  return allocateChipsToBankrollOwner(state, {
    bankrollOwnerId,
    amount,
    reason: 'owner-top-up',
    source: 'assign-modal',
  });
}
