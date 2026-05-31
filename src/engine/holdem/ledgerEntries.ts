import type { GameSession } from '../../types/session';
import type { Ledger } from '../../types/ledger';
import type { LedgerEntryType } from '../../types/ledger';
import { appendLedgerEntry } from '../ledger/ledger';

export function appendHoldemLedgerEntry(
  session: GameSession,
  ledger: Ledger,
  playerId: string,
  entryType: LedgerEntryType,
  amount: number,
  description: string,
): { session: GameSession; ledger: Ledger } {
  const result = appendLedgerEntry(session, ledger, {
    playerId,
    entryType,
    amount,
    description,
    roundNumber: session.currentRound,
  });
  return { session: result.session, ledger: result.ledger };
}

export function payPotToWinner(
  session: GameSession,
  ledger: Ledger,
  playerId: string,
  amount: number,
  description: string,
): { session: GameSession; ledger: Ledger } {
  return appendHoldemLedgerEntry(
    session,
    ledger,
    playerId,
    'pot-paid',
    amount,
    description,
  );
}
