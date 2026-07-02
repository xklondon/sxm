import type { GameState } from '../../types';
import type { BlackjackPlayerHand } from '../../types/blackjack';
import type { GameSession } from '../../types/session';
import type { Ledger } from '../../types/ledger';
import { getAvailableChipsForBankrollOwner, bankrollContextFromState, type BankrollContext } from '../session/bankroll';
import { appendBoxLedgerEntryForStaker } from '../session/boxLedger';
import { resolveHandStakerAmounts, splitAmountByStakerShares } from './stakeSettlement';

export interface HandFundingParticipant {
  personId: string;
  stakeAmount: number;
  availableChips: number;
}

/** Per-staker funding view for a box hand — payer-correct, not native box owner. */
export function resolveHandFundingParticipants(
  state: GameState,
  hand: BlackjackPlayerHand,
  boxPlayerId: string,
): HandFundingParticipant[] {
  const ctx = bankrollContextFromState(state);
  const stakerAmounts = resolveHandStakerAmounts(hand, ctx, boxPlayerId);
  return Object.entries(stakerAmounts)
    .filter(([, amount]) => amount > 0)
    .map(([personId, stakeAmount]) => ({
      personId,
      stakeAmount,
      availableChips: getAvailableChipsForBankrollOwner(state, personId),
    }));
}

/** Effective chips available for proportional funding of `total` across stakers. */
export function resolveProportionalFundingCapacity(
  participants: HandFundingParticipant[],
  total: number,
): number {
  if (total <= 0 || participants.length === 0) {
    return 0;
  }
  const stakeMap = Object.fromEntries(
    participants.map((p) => [p.personId, p.stakeAmount]),
  );
  const shares = splitAmountByStakerShares(total, stakeMap);
  let capacity = Infinity;
  for (const [personId, share] of Object.entries(shares)) {
    if (share <= 0) {
      continue;
    }
    const participant = participants.find((p) => p.personId === personId);
    if (!participant) {
      return 0;
    }
    const personCapacity = Math.floor((participant.availableChips * total) / share);
    capacity = Math.min(capacity, personCapacity);
  }
  return capacity === Infinity ? 0 : capacity;
}

export function getProportionalFundingBlockReason(
  participants: HandFundingParticipant[],
  total: number,
): string | null {
  if (total <= 0) {
    return 'Nothing to fund.';
  }
  if (participants.length === 0) {
    return 'No stakers on this hand.';
  }
  const stakeMap = Object.fromEntries(
    participants.map((p) => [p.personId, p.stakeAmount]),
  );
  const shares = splitAmountByStakerShares(total, stakeMap);
  for (const [personId, share] of Object.entries(shares)) {
    if (share <= 0) {
      continue;
    }
    const participant = participants.find((p) => p.personId === personId);
    if (!participant || participant.availableChips < share) {
      return `Insufficient chips for staker (${share} needed).`;
    }
  }
  return null;
}

/** Debit each staker their proportional share of `total`. */
export function applyProportionalStakerDebits(
  session: GameSession,
  ledger: Ledger,
  ctx: BankrollContext,
  boxPlayerId: string,
  stakerAmounts: Record<string, number>,
  total: number,
  entryType: 'bet-placed' | 'bet-increased',
  description: string,
  roundNumber?: number,
): { session: GameSession; ledger: Ledger } {
  const shares = splitAmountByStakerShares(total, stakerAmounts);
  let nextSession = session;
  let nextLedger = ledger;
  for (const [stakerId, share] of Object.entries(shares)) {
    if (share <= 0) {
      continue;
    }
    const result = appendBoxLedgerEntryForStaker(
      nextSession,
      nextLedger,
      ctx,
      boxPlayerId,
      stakerId,
      entryType,
      -share,
      description,
      roundNumber,
    );
    nextSession = result.session;
    nextLedger = result.ledger;
  }
  return { session: nextSession, ledger: nextLedger };
}
