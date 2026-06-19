import type { TableMode, BankBustSettlementMode } from './table';

export type ScoreLedgerEntryStatus = 'open' | 'settled' | 'cancelled';

export interface ScoreLedgerParticipantResult {
  email: string;
  name: string;
  personId: string | null;
  startingChips: number;
  endingChips: number;
  outcome: 'winner' | 'loser' | 'participant';
  /** Final chip rank when challenge ends with fractional settlement. */
  rank?: number;
}

export interface ScoreLedgerEntry {
  id: string;
  tableId: string;
  /** Human-readable table name for score-ledger filtering. */
  tableName?: string;
  /** Rounds played when the game ended. */
  roundCount?: number;
  wagerDescription: string;
  winnerPersonId: string | null;
  winnerName: string;
  loserPersonId: string | null;
  loserName: string;
  owedDescription: string;
  /** People at the table when the game ended. */
  playersInvolved?: string[];
  gameType?: string;
  /** Human-readable game name for personal ledger (e.g. Zilch, Blackjack). */
  gameLabel?: string;
  protocolId?: string;
  /** Zilch-only: target_points or fixed_rounds. */
  zilchMode?: string;
  /** Zilch-only: final score totals by player id. */
  finalScores?: Record<string, number>;
  mode?: TableMode;
  /** Effective bank-bust settlement recorded for this game. */
  settlementMode?: BankBustSettlementMode;
  bankName?: string;
  participantEmails?: string[];
  /** Emails of users who explicitly saved this game to their personal ledger. */
  savedByEmails?: string[];
  participants?: ScoreLedgerParticipantResult[];
  createdAt: string;
  status: ScoreLedgerEntryStatus;
}
