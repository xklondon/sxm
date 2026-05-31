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
  const slotLabel = meta.boxSlotNumber ? `Box ${meta.boxSlotNumber}` : 'Box';
  const desc = description.includes(slotLabel) ? description : `${slotLabel}: ${description}`;

  const result = appendLedgerEntry(session, ledger, {
    playerId: meta.bankrollOwnerId,
    entryType,
    amount,
    description: desc,
    roundNumber,
    boxPlayerId: meta.boxPlayerId,
    boxSlotNumber: meta.boxSlotNumber ?? undefined,
  });

  if (entryType === 'bet-placed' || entryType === 'bet-increased') {
    log.info('betLedgerEntry', {
      bankrollOwnerId: meta.bankrollOwnerId,
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
      bankrollOwnerId: meta.bankrollOwnerId,
      boxPlayerId: meta.boxPlayerId,
      boxSlotNumber: meta.boxSlotNumber,
      amount,
      entryType,
    });
  }

  return { session: result.session, ledger: result.ledger };
}
