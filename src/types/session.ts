export type DealingStatus = 'no-deck' | 'ready' | 'depleted';

export type GameType = 'blackjack' | 'texas-holdem' | 'zilch';

export type GameCategory = 'cards' | 'dice';

export type GameStatus =
  | 'setup'
  | 'active'
  | 'round-complete'
  | 'finished';

export interface GameSession {
  id: string;
  gameType: GameType | null;
  createdAt: string;
  status: GameStatus;
  playerIds: string[];
  bankPlayerId: string | null;
  dealerButtonPlayerId: string | null;
  currentRound: number;
  ledgerEntryIds: string[];
  deckId: string | null;
  dealingStatus: DealingStatus;
  /** Box player id → slot number (1 = rightmost, acts first). */
  boxSlotNumbers: Record<string, number>;
}

export function createEmptySession(id: string): GameSession {
  return {
    id,
    gameType: null,
    createdAt: new Date().toISOString(),
    status: 'setup',
    playerIds: [],
    bankPlayerId: null,
    dealerButtonPlayerId: null,
    currentRound: 0,
    ledgerEntryIds: [],
    deckId: null,
    dealingStatus: 'no-deck',
    boxSlotNumbers: {},
  };
}
