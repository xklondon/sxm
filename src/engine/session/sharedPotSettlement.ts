import type { GameState } from '../../types';
import type { GameSession } from '../../types/session';
import type { Ledger, LedgerEntryType } from '../../types/ledger';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { appendBankLedgerEntry } from '../blackjack/bankLedger';
import {
  bankrollContextFromState,
  listBankrollParticipantIds,
  resolveBankrollOwnerId,
  type BankrollContext,
} from './bankroll';
import { appendBoxLedgerEntry } from './boxLedger';
import { personsShareOneChipPot, resolveCanonicalBankrollOwnerId } from './sharedBankroll';

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

/** True when box vs bank settlement is an internal move inside one shared chip pot. */
export function boxSettlesAsInternalBankPotTransfer(
  session: GameSession,
  ctx: BankrollContext,
  boxPlayerId: string,
): boolean {
  const bankId = session.bankPlayerId;
  if (!bankId) {
    return false;
  }
  const ownerId = resolveBankrollOwnerId(ctx, boxPlayerId);
  return personsShareOneChipPot(settlementStateSlice(session, ctx) as GameState, ownerId, bankId);
}

export function boxSettlesAsInternalBankPotTransferFromState(
  state: GameState,
  boxPlayerId: string,
): boolean {
  return boxSettlesAsInternalBankPotTransfer(
    state.session,
    bankrollContextFromState(state),
    boxPlayerId,
  );
}

export function appendBoxLedgerEntryUnlessInternalPot(
  session: GameSession,
  ledger: Ledger,
  ctx: BankrollContext,
  boxPlayerId: string,
  entryType: LedgerEntryType,
  amount: number,
  description: string,
  roundNumber?: number,
  committedBet?: number,
): { session: GameSession; ledger: Ledger } {
  if (boxSettlesAsInternalBankPotTransfer(session, ctx, boxPlayerId)) {
    if (entryType === 'win-paid') {
      const bet = committedBet ?? 0;
      if (bet <= 0) {
        return { session, ledger };
      }
      // Winnings vs own bank are internal — restore committed bet only.
      return appendBoxLedgerEntry(
        session,
        ledger,
        ctx,
        boxPlayerId,
        entryType,
        bet,
        description,
        roundNumber,
      );
    }
    if (entryType === 'loss-collected') {
      const bet = committedBet ?? 0;
      if (bet > 0) {
        // Bet vs own bank is internal — restore committed chips without crediting bank.
        return appendBoxLedgerEntry(
          session,
          ledger,
          ctx,
          boxPlayerId,
          'push-refund',
          bet,
          description,
          roundNumber,
        );
      }
      return { session, ledger };
    }
  }
  return appendBoxLedgerEntry(
    session,
    ledger,
    ctx,
    boxPlayerId,
    entryType,
    amount,
    description,
    roundNumber,
  );
}

export function appendBankLedgerEntryUnlessInternalPot(
  session: GameSession,
  ledger: Ledger,
  ctx: BankrollContext,
  boxPlayerId: string,
  bankPlayerId: string,
  amount: number,
  description: string,
  roundNumber?: number,
): { session: GameSession; ledger: Ledger } {
  if (amount === 0 || boxSettlesAsInternalBankPotTransfer(session, ctx, boxPlayerId)) {
    return { session, ledger };
  }
  return appendBankLedgerEntry(session, ledger, bankPlayerId, amount, description, roundNumber);
}

/** Sum canonical ledger pots once — invariant check for settlement tests. */
export function totalCanonicalChipsInPlay(state: GameState): number {
  const seen = new Set<string>();
  let total = 0;
  for (const id of listBankrollParticipantIds(state)) {
    const canonical = resolveCanonicalBankrollOwnerId(state, id);
    if (seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    total += derivePlayerBalanceFromLedger(canonical, state.ledger);
  }
  return total;
}
