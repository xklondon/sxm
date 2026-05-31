export type ScoreLedgerEntryStatus = 'open' | 'settled' | 'cancelled';

export interface ScoreLedgerEntry {
  id: string;
  tableId: string;
  wagerDescription: string;
  winnerPersonId: string | null;
  winnerName: string;
  loserPersonId: string | null;
  loserName: string;
  owedDescription: string;
  /** People at the table when the game ended. */
  playersInvolved?: string[];
  createdAt: string;
  status: ScoreLedgerEntryStatus;
}
