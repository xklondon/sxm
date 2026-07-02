import type { GameSession } from '../../types/session';
import type { Ledger, LedgerEntryType } from '../../types/ledger';
import { appendLedgerEntry } from '../ledger/ledger';
import { log } from '../../utils/logger';
import { resolveBankrollOwnerId, type BankrollContext } from './bankroll';

export interface BoxLedgerMeta {
  boxPlayerId: string;
  boxSlotNumber: number | null;
  bankrollOwnerId: string;
}

export function boxLedgerMeta(
  ctx: BankrollContext,
  boxPlayerId: string,
): BoxLedgerMeta {
  const bankrollOwnerId = resolveBankrollOwnerId(ctx, boxPlayerId);
  return {
    boxPlayerId,
    boxSlotNumber: ctx.boxSlotNumbers[boxPlayerId] ?? null,
    bankrollOwnerId,
  };
}

/** Ledger entry on a box position, debiting/crediting the actual staker person id. */
export function appendBoxLedgerEntryForStaker(
  session: GameSession,
  ledger: Ledger,
  ctx: BankrollContext,
  boxPlayerId: string,
  stakerPersonId: string,
  entryType: LedgerEntryType,
  amount: number,
  description: string,
  roundNumber?: number,
): { session: GameSession; ledger: Ledger } {
  const meta = boxLedgerMeta(ctx, boxPlayerId);
  const slotLabel = meta.boxSlotNumber ? `Box ${meta.boxSlotNumber}` : 'Box';
  const desc = description.includes(slotLabel) ? description : `${slotLabel}: ${description}`;

  const result = appendLedgerEntry(session, ledger, {
    playerId: stakerPersonId,
    entryType,
    amount,
    description: desc,
    roundNumber,
    boxPlayerId: meta.boxPlayerId,
    boxSlotNumber: meta.boxSlotNumber ?? undefined,
  });

  if (entryType === 'bet-placed' || entryType === 'bet-increased') {
    log.info('betLedgerEntry', {
      bankrollOwnerId: stakerPersonId,
      boxPlayerId: meta.boxPlayerId,
      boxSlotNumber: meta.boxSlotNumber,
      amount,
      entryType,
    });
  } else if (
    entryType === 'win-paid' ||
    entryType === 'push-refund' ||
    entryType === 'loss-collected'
  ) {
    log.info('payoutLedgerEntry', {
      bankrollOwnerId: stakerPersonId,
      boxPlayerId: meta.boxPlayerId,
      boxSlotNumber: meta.boxSlotNumber,
      amount,
      entryType,
    });
  }

  return { session: result.session, ledger: result.ledger };
}

export function appendBoxLedgerEntry(
  session: GameSession,
  ledger: Ledger,
  ctx: BankrollContext,
  boxPlayerId: string,
  entryType: LedgerEntryType,
  amount: number,
  description: string,
  roundNumber?: number,
): { session: GameSession; ledger: Ledger } {
  const meta = boxLedgerMeta(ctx, boxPlayerId);
  return appendBoxLedgerEntryForStaker(
    session,
    ledger,
    ctx,
    boxPlayerId,
    meta.bankrollOwnerId,
    entryType,
    amount,
    description,
    roundNumber,
  );
}
