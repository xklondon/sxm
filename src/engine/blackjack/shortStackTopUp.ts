import type { GameState } from '../../types';
import { getTableMinimumBet } from './dealEligibility';
import {
  getAvailableChipsForBankrollOwner,
  listPersonBankrollOwnerIds,
} from '../session/bankroll';
import { allocateChipsToBankrollOwner } from '../session/allocation';

/**
 * At betting-round start, bump non-bankrupt players with chips below min bet up to min bet
 * so they can place the next wager (virtual-chip playability rule).
 */
export function applyShortStackMinBetTopUpOnState(state: GameState): GameState {
  const minBet = getTableMinimumBet(state);
  if (!Number.isFinite(minBet) || minBet <= 0) {
    return state;
  }

  let next = state;
  const topped = new Set<string>();

  function topUpOwner(ownerId: string): void {
    if (topped.has(ownerId)) {
      return;
    }
    topped.add(ownerId);
    const balance = getAvailableChipsForBankrollOwner(next, ownerId);
    if (balance <= 0 || balance >= minBet) {
      return;
    }
    const delta = minBet - balance;
    next = allocateChipsToBankrollOwner(next, {
      bankrollOwnerId: ownerId,
      amount: delta,
      reason: 'owner-top-up',
      note: `Short-stack min-bet top-up (+${delta} to ${minBet})`,
      source: 'assign-modal',
    });
  }

  for (const ownerId of listPersonBankrollOwnerIds(next)) {
    topUpOwner(ownerId);
  }

  const bankId = next.session.bankPlayerId;
  if (bankId) {
    topUpOwner(bankId);
  }

  return next;
}
