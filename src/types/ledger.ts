export type LedgerEntryType =
  | 'buy-in'
  | 'bet-placed'
  | 'bet-increased'
  | 'call-placed'
  | 'blind-posted'
  | 'fold-recorded'
  | 'pot-paid'
  | 'win-paid'
  | 'loss-collected'
  | 'push-refund'
  | 'side-pot-contribution'
  | 'manual-adjustment'
  | 'bank-transfer'
  | 'table-outcome-recorded';

export interface LedgerEntry {
  id: string;
  timestamp: string;
  roundNumber: number;
  playerId: string;
  entryType: LedgerEntryType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  /** Box position id when entry relates to a specific box. */
  boxPlayerId?: string;
  /** Box slot number (1 = rightmost) for audit/display. */
  boxSlotNumber?: number;
}

export interface Ledger {
  sessionId: string;
  entries: LedgerEntry[];
}

export function createEmptyLedger(sessionId: string): Ledger {
  return {
    sessionId,
    entries: [],
  };
}
