import type { Player, VirtualPlayerStyle } from '../../types/player';
import type { Ledger } from '../../types/ledger';
import type { HoldemRound } from '../../types/holdem';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';

export type VirtualHoldemAction =
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'fold' }
  | { type: 'bet'; amount: number }
  | { type: 'raise'; amount: number };

const RAISE_THRESHOLD_MULTIPLIER = 3;

/** Simple deterministic virtual player — no bluffing. */
export function getVirtualHoldemAction(
  round: HoldemRound,
  playerId: string,
  ledger: Ledger,
  style?: VirtualPlayerStyle,
): VirtualHoldemAction {
  const ps = round.playerStates[playerId];
  if (!ps || ps.actionStatus === 'folded') {
    return { type: 'fold' };
  }

  const balance = derivePlayerBalanceFromLedger(playerId, ledger);
  const toCall = round.currentBet - ps.playerBetsThisStreet;
  const conservative = style === 'conservative' || style === undefined;
  const raiseThreshold = round.bigBlind * RAISE_THRESHOLD_MULTIPLIER;

  if (toCall === 0) {
    if (!conservative && round.currentBet === 0 && balance >= round.bigBlind) {
      return { type: 'bet', amount: round.bigBlind };
    }
    return { type: 'check' };
  }

  if (toCall > balance) {
    return { type: 'fold' };
  }

  if (conservative && round.currentBet > raiseThreshold) {
    return { type: 'fold' };
  }

  if (toCall <= round.bigBlind * 2) {
    return { type: 'call' };
  }

  return { type: 'fold' };
}

export function isVirtualHoldemPlayer(
  players: Record<string, Player>,
  playerId: string,
): boolean {
  return players[playerId]?.playerType === 'virtual';
}
