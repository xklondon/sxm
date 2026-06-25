import type { HoldemRound } from '../../types/holdem';
import type { GameSession } from '../../types/session';
import type { Ledger } from '../../types/ledger';
import { appendHoldemLedgerEntry } from './ledgerEntries';
import { appendActionLog, contributionsFromRound, syncHoldemPot } from './helpers';
import type { HoldemContribution } from './sidePots';

export type UncalledBetReturn = {
  seatId: string;
  amount: number;
};

/**
 * When only one player remains contesting the pot, return chips committed
 * above the second-highest total contribution (including folded players).
 */
export function calculateUncalledBetReturns(
  contributions: HoldemContribution[],
  contestingSeatIds: string[],
): UncalledBetReturn[] {
  if (contestingSeatIds.length !== 1) {
    return [];
  }

  const winnerId = contestingSeatIds[0]!;
  const bySeat = new Map(contributions.map((c) => [c.seatId, c.amount]));
  const winnerAmount = bySeat.get(winnerId) ?? 0;

  const sortedAmounts = contributions
    .map((c) => c.amount)
    .filter((a) => a > 0)
    .sort((a, b) => b - a);

  const secondHighest = sortedAmounts.length >= 2 ? sortedAmounts[1]! : 0;

  if (winnerAmount > secondHighest) {
    return [{ seatId: winnerId, amount: winnerAmount - secondHighest }];
  }
  return [];
}

export function applyUncalledBetReturnsToRound(
  round: HoldemRound,
  returns: UncalledBetReturn[],
): HoldemRound {
  if (returns.length === 0) {
    return round;
  }

  let next = round;
  for (const ret of returns) {
    const ps = next.playerStates[ret.seatId];
    if (!ps || ret.amount <= 0) {
      continue;
    }
    const newCommitted = Math.max(0, ps.playerTotalCommitted - ret.amount);
    const streetReduction = Math.min(ps.playerBetsThisStreet, ret.amount);
    next = {
      ...next,
      playerStates: {
        ...next.playerStates,
        [ret.seatId]: {
          ...ps,
          playerTotalCommitted: newCommitted,
          playerBetsThisStreet: Math.max(0, ps.playerBetsThisStreet - streetReduction),
        },
      },
    };
    next = appendActionLog(next, `${ret.seatId} returned ${ret.amount} uncalled chips`);
  }
  return syncHoldemPot(next);
}

export function applyUncalledBetReturnsToHand(
  session: GameSession,
  ledger: Ledger,
  round: HoldemRound,
  contestingSeatIds: string[],
): {
  session: GameSession;
  ledger: Ledger;
  round: HoldemRound;
  returns: UncalledBetReturn[];
} {
  const returns = calculateUncalledBetReturns(
    contributionsFromRound(round),
    contestingSeatIds,
  );

  if (returns.length === 0) {
    return { session, ledger, round, returns };
  }

  let nextSession = session;
  let nextLedger = ledger;

  for (const ret of returns) {
    const credited = appendHoldemLedgerEntry(
      nextSession,
      nextLedger,
      ret.seatId,
      'push-refund',
      ret.amount,
      `Uncalled bet return — ${ret.amount} chips`,
    );
    nextSession = credited.session;
    nextLedger = credited.ledger;
  }

  const nextRound = applyUncalledBetReturnsToRound(round, returns);
  return { session: nextSession, ledger: nextLedger, round: nextRound, returns };
}
