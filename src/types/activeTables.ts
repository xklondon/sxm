import type { TableMode } from './table';

export type ActiveTableAccess = 'open' | 'join' | 'request' | 'pending';

export interface ActiveTableSummary {
  tableId: string;
  name: string;
  game: string;
  mode: TableMode | 'unknown';
  wager: string | null;
  players: string[];
  bank: string;
  host: string;
  hostEmail: string | null;
  playerCount: number;
  status: 'active' | 'ended' | 'setup';
  createdAt: string;
  access: ActiveTableAccess;
  inviteId?: string;
  inviteToken?: string;
  joinRequestId?: string;
}
