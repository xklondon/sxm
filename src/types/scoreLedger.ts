import type { TableMode } from './table';

export type ScoreLedgerEntryStatus = 'open' | 'settled' | 'cancelled';

export interface ScoreLedgerParticipantResult {
  email: string;
  name: string;
  personId: string | null;
  startingChips: number;
  endingChips: number;
  outcome: 'winner' | 'loser' | 'participant';
}

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
  gameType?: string;
  protocolId?: string;
  mode?: TableMode;
  bankName?: string;
  participantEmails?: string[];
  participants?: ScoreLedgerParticipantResult[];
  createdAt: string;
  status: ScoreLedgerEntryStatus;
}
