import type { GameSession } from '../../types/session';
import type {
  Ledger,
  LedgerEntry,
  LedgerEntryType,
} from '../../types/ledger';
import { generateId } from '../utils/id';

export interface AppendLedgerEntryInput {
  playerId: string;
  entryType: LedgerEntryType;
  amount: number;
  description: string;
  roundNumber?: number;
  boxPlayerId?: string;
  boxSlotNumber?: number;
}

export function derivePlayerBalanceFromLedger(
  playerId: string,
  ledger: Ledger,
): number {
  const playerEntries = ledger.entries.filter((e) => e.playerId === playerId);
  if (playerEntries.length === 0) {
    return 0;
  }
  const last = playerEntries[playerEntries.length - 1];
  return last.balanceAfter;
}

export function deriveAllBalancesFromLedger(
  session: GameSession,
  ledger: Ledger,
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const playerId of session.playerIds) {
    balances[playerId] = derivePlayerBalanceFromLedger(playerId, ledger);
  }
  return balances;
}

export function createBuyInEntry(
  playerId: string,
  amount: number,
  balanceBefore: number,
  roundNumber = 0,
): Omit<LedgerEntry, 'id' | 'timestamp'> {
  return {
    roundNumber,
    playerId,
    entryType: 'buy-in',
    amount,
    balanceBefore,
    balanceAfter: balanceBefore + amount,
    description: `Buy-in: ${amount} chips`,
  };
}

export function createManualAdjustmentEntry(
  playerId: string,
  amount: number,
  note: string,
  balanceBefore: number,
  roundNumber = 0,
): Omit<LedgerEntry, 'id' | 'timestamp'> {
  const sign = amount >= 0 ? '+' : '';
  return {
    roundNumber,
    playerId,
    entryType: 'manual-adjustment',
    amount,
    balanceBefore,
    balanceAfter: balanceBefore + amount,
    description: note || `Manual adjustment: ${sign}${amount} chips`,
  };
}

function finalizeEntry(
  partial: Omit<LedgerEntry, 'id' | 'timestamp'>,
): LedgerEntry {
  return {
    ...partial,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };
}

export function appendLedgerEntry(
  session: GameSession,
  ledger: Ledger,
  entryInput: AppendLedgerEntryInput,
): { session: GameSession; ledger: Ledger; entry: LedgerEntry } {
  const balanceBefore = derivePlayerBalanceFromLedger(entryInput.playerId, ledger);
  const entry = finalizeEntry({
    roundNumber: entryInput.roundNumber ?? session.currentRound,
    playerId: entryInput.playerId,
    entryType: entryInput.entryType,
    amount: entryInput.amount,
    balanceBefore,
    balanceAfter: balanceBefore + entryInput.amount,
    description: entryInput.description,
    boxPlayerId: entryInput.boxPlayerId,
    boxSlotNumber: entryInput.boxSlotNumber,
  });

  return {
    session: {
      ...session,
      ledgerEntryIds: [...session.ledgerEntryIds, entry.id],
    },
    ledger: {
      ...ledger,
      entries: [...ledger.entries, entry],
    },
    entry,
  };
}

export interface LedgerValidationIssue {
  playerId?: string;
  entryId?: string;
  message: string;
}

export function validateLedgerConsistency(
  session: GameSession,
  ledger: Ledger,
): { valid: boolean; issues: LedgerValidationIssue[] } {
  const issues: LedgerValidationIssue[] = [];

  const entryIds = ledger.entries.map((e) => e.id);
  const sessionIds = new Set(session.ledgerEntryIds);
  for (const id of entryIds) {
    if (!sessionIds.has(id)) {
      issues.push({
        entryId: id,
        message: 'Ledger entry not referenced in session',
      });
    }
  }
  for (const id of session.ledgerEntryIds) {
    if (!entryIds.includes(id)) {
      issues.push({
        entryId: id,
        message: 'Session references missing ledger entry',
      });
    }
  }

  for (const playerId of session.playerIds) {
    const playerEntries = ledger.entries.filter((e) => e.playerId === playerId);
    let expectedBalance = 0;
    for (const entry of playerEntries) {
      if (entry.balanceBefore !== expectedBalance) {
        issues.push({
          playerId,
          entryId: entry.id,
          message: `Expected balanceBefore ${expectedBalance}, got ${entry.balanceBefore}`,
        });
      }
      expectedBalance = entry.balanceAfter;
      if (entry.balanceAfter !== entry.balanceBefore + entry.amount) {
        issues.push({
          playerId,
          entryId: entry.id,
          message: 'amount does not match balanceBefore/balanceAfter delta',
        });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
