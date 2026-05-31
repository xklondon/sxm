import type { GameSession } from '../../types/session';
import type { Ledger } from '../../types/ledger';
import { appendLedgerEntry } from '../ledger/ledger';
import { log } from '../../utils/logger';

/** Record house bankroll movement at settlement (wins/losses vs players). */
export function appendBankLedgerEntry(
  session: GameSession,
  ledger: Ledger,
  bankPlayerId: string,
  amount: number,
  description: string,
  roundNumber?: number,
): { session: GameSession; ledger: Ledger } {
  if (amount === 0) {
    return { session, ledger };
  }
  const result = appendLedgerEntry(session, ledger, {
    playerId: bankPlayerId,
    entryType: 'bank-transfer',
    amount,
    description,
    roundNumber,
  });
  log.info('bankLedgerEntry', {
    bankPlayerId,
    amount,
    description,
    roundNumber: roundNumber ?? session.currentRound,
  });
  return { session: result.session, ledger: result.ledger };
}
