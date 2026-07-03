import type { GameSession } from '../../types/session';
import type { Ledger, LedgerEntryType } from '../../types/ledger';
import type { BlackjackOutcome, BlackjackPlayerHand } from '../../types/blackjack';
import { appendBoxLedgerEntryForStaker } from '../session/boxLedger';
import { appendBankLedgerEntryUnlessInternalPot } from '../session/sharedPotSettlement';
import { personsShareOneChipPot } from '../session/sharedBankroll';
import { resolveBankrollOwnerId, type BankrollContext } from '../session/bankroll';
import type { GameState } from '../../types';
import { resolveStakerAmountsByPersonId } from './stakes';

/** Split a total payout/amount across stakers by their committed shares (integer chips). */
export function splitAmountByStakerShares(
  total: number,
  stakerAmounts: Record<string, number>,
): Record<string, number> {
  if (total <= 0) {
    return {};
  }
  const entries = Object.entries(stakerAmounts).filter(([, amount]) => amount > 0);
  const stakeTotal = entries.reduce((sum, [, amount]) => sum + amount, 0);
  if (stakeTotal <= 0) {
    return {};
  }

  const shares: Record<string, number> = {};
  let assigned = 0;
  const ranked = entries.map(([personId, stakeAmount]) => {
    const exact = (total * stakeAmount) / stakeTotal;
    const floor = Math.floor(exact);
    shares[personId] = floor;
    assigned += floor;
    return { personId, remainder: exact - floor };
  });

  let leftover = total - assigned;
  ranked.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; leftover > 0; i += 1) {
    const personId = ranked[i % ranked.length]!.personId;
    shares[personId] = (shares[personId] ?? 0) + 1;
    leftover -= 1;
  }

  return shares;
}

/** Staker contributions for settlement — hand snapshot, open box stake, else native owner. */
export function resolveHandStakerAmounts(
  hand: BlackjackPlayerHand,
  bankrollCtx: BankrollContext,
  boxPlayerId: string,
  state?: GameState,
): Record<string, number> {
  const fromHand = hand.stakerAmountsByPersonId;
  if (fromHand && Object.keys(fromHand).length > 0) {
    const cleaned: Record<string, number> = {};
    for (const [personId, amount] of Object.entries(fromHand)) {
      if (amount > 0) {
        cleaned[personId] = amount;
      }
    }
    if (Object.keys(cleaned).length > 0) {
      return cleaned;
    }
  }
  if (state) {
    try {
      const fromStake = resolveStakerAmountsByPersonId(state, boxPlayerId);
      if (Object.keys(fromStake).length > 0) {
        return fromStake;
      }
    } catch {
      // Fall through to native owner when stake map is unavailable.
    }
  }
  const nativeOwner = resolveBankrollOwnerId(bankrollCtx, boxPlayerId);
  if (hand.currentBet > 0) {
    return { [nativeOwner]: hand.currentBet };
  }
  return {};
}

function settlementStateSlice(
  session: GameSession,
  ctx: BankrollContext,
): Pick<GameState, 'session' | 'players' | 'tableMeta'> {
  return {
    session,
    players: ctx.players,
    tableMeta: {
      ownerPersonId: ctx.ownerPersonId ?? null,
      bankerSetup: ctx.bankerSetup ?? { mode: 'bot', playerId: null, displayName: '' },
    } as GameState['tableMeta'],
  };
}

function stakerSettlesAsInternalBankPot(
  session: GameSession,
  ctx: BankrollContext,
  stakerPersonId: string,
): boolean {
  const bankId = session.bankPlayerId;
  if (!bankId) {
    return false;
  }
  return personsShareOneChipPot(
    settlementStateSlice(session, ctx) as GameState,
    stakerPersonId,
    bankId,
  );
}

function appendStakerBoxSettlement(
  session: GameSession,
  ledger: Ledger,
  ctx: BankrollContext,
  boxPlayerId: string,
  stakerPersonId: string,
  entryType: LedgerEntryType,
  amount: number,
  description: string,
  roundNumber: number | undefined,
  stakerCommittedBet: number,
): { session: GameSession; ledger: Ledger } {
  if (stakerSettlesAsInternalBankPot(session, ctx, stakerPersonId)) {
    if (entryType === 'win-paid') {
      if (stakerCommittedBet <= 0) {
        return { session, ledger };
      }
      return appendBoxLedgerEntryForStaker(
        session,
        ledger,
        ctx,
        boxPlayerId,
        stakerPersonId,
        entryType,
        stakerCommittedBet,
        description,
        roundNumber,
      );
    }
    if (entryType === 'loss-collected' && stakerCommittedBet > 0) {
      return appendBoxLedgerEntryForStaker(
        session,
        ledger,
        ctx,
        boxPlayerId,
        stakerPersonId,
        'push-refund',
        stakerCommittedBet,
        description,
        roundNumber,
      );
    }
    return { session, ledger };
  }

  return appendBoxLedgerEntryForStaker(
    session,
    ledger,
    ctx,
    boxPlayerId,
    stakerPersonId,
    entryType,
    amount,
    description,
    roundNumber,
  );
}

/** Credit push/win payouts to actual stakers proportionally. */
export function applyProportionalHandBoxSettlement(
  session: GameSession,
  ledger: Ledger,
  ctx: BankrollContext,
  boxPlayerId: string,
  hand: BlackjackPlayerHand,
  payout: number,
  outcome: BlackjackOutcome,
  message: string,
  roundNumber?: number,
): { session: GameSession; ledger: Ledger } {
  const stakerAmounts = resolveHandStakerAmounts(hand, ctx, boxPlayerId);
  let nextSession = session;
  let nextLedger = ledger;

  if (payout > 0) {
    const entryType: LedgerEntryType =
      outcome === 'push' || outcome === 'blackjack-push' ? 'push-refund' : 'win-paid';
    const shares = splitAmountByStakerShares(payout, stakerAmounts);
    for (const [stakerId, share] of Object.entries(shares)) {
      if (share <= 0) {
        continue;
      }
      const result = appendStakerBoxSettlement(
        nextSession,
        nextLedger,
        ctx,
        boxPlayerId,
        stakerId,
        entryType,
        share,
        message,
        roundNumber,
        stakerAmounts[stakerId] ?? 0,
      );
      nextSession = result.session;
      nextLedger = result.ledger;
    }
    return { session: nextSession, ledger: nextLedger };
  }

  if (outcome === 'loss') {
    for (const [stakerId, stakerBet] of Object.entries(stakerAmounts)) {
      if (stakerBet <= 0) {
        continue;
      }
      const result = appendStakerBoxSettlement(
        nextSession,
        nextLedger,
        ctx,
        boxPlayerId,
        stakerId,
        'loss-collected',
        0,
        message,
        roundNumber,
        stakerBet,
      );
      nextSession = result.session;
      nextLedger = result.ledger;
    }
  }

  return { session: nextSession, ledger: nextLedger };
}

/** Bank side of settlement — unchanged total; staker bets already debited at deal. */
export function applyProportionalHandBankSettlement(
  session: GameSession,
  ledger: Ledger,
  ctx: BankrollContext,
  boxPlayerId: string,
  hand: BlackjackPlayerHand,
  payout: number,
  outcome: BlackjackOutcome,
  message: string,
  roundNumber?: number,
): { session: GameSession; ledger: Ledger } {
  const bankId = session.bankPlayerId;
  if (!bankId) {
    return { session, ledger };
  }

  const bet = hand.currentBet;
  if (outcome === 'loss' && bet > 0) {
    return appendBankLedgerEntryUnlessInternalPot(
      session,
      ledger,
      ctx,
      boxPlayerId,
      bankId,
      bet,
      `House collected ${bet} chips (${message})`,
      roundNumber,
    );
  }

  if (payout > bet) {
    const bankPays = payout - bet;
    return appendBankLedgerEntryUnlessInternalPot(
      session,
      ledger,
      ctx,
      boxPlayerId,
      bankId,
      -bankPays,
      `House paid ${bankPays} chips (${message})`,
      roundNumber,
    );
  }

  return { session, ledger };
}
