export type { GameType, GameStatus, GameSession, DealingStatus } from './session';
export { createEmptySession } from './session';

export type {
  PlayerType,
  VirtualPlayerStyle,
  PlayerStatus,
  Player,
} from './player';
export { createPlayer } from './player';

export type { Suit, Rank, Card, Deck } from './deck';
export {
  createEmptyDeck,
  SUITS,
  RANKS,
  cardIdFor,
  getDealingStatusFromDeck,
} from './deck';

export type { LedgerEntryType, LedgerEntry, Ledger } from './ledger';
export { createEmptyLedger } from './ledger';

export type {
  BlackjackRound,
  BlackjackRoundStatus,
  BlackjackPlayerHand,
  BlackjackPlayerActionStatus,
  BlackjackOutcome,
} from './blackjack';
export { createEmptyBlackjackRound } from './blackjack';

export type {
  HoldemRound,
  HoldemRoundStatus,
  HoldemPlayerState,
  HoldemPlayerActionStatus,
  BettingStreet,
  CreateHoldemRoundOptions,
} from './holdem';
export {
  createEmptyHoldemRound,
  computeHoldemPot,
  BETTING_STREETS,
} from './holdem';

export type { TableAgreement, TableOutcome, TableMeta, TableSessionStatus } from './table';
export type { TableInviteRecord, InviteStatus, JoinTableParams } from './invites';
export type { TableAdminSettings } from './admin';
export { createDefaultTableMeta } from './table';
import type { TableMeta } from './table';
import type { TableAdminSettings } from './admin';
import type { BlackjackFlowSettings } from '../engine/blackjack/flowSettings';

export type TableViewMode = 'full' | 'card';

/** Aggregate game state for local MVP (single-device). */
export interface GameState {
  session: import('./session').GameSession;
  players: Record<string, import('./player').Player>;
  deck: import('./deck').Deck | null;
  ledger: import('./ledger').Ledger;
  blackjack: import('./blackjack').BlackjackRound | null;
  holdem: import('./holdem').HoldemRound | null;
  zilch: import('../engine/zilch/zilchTypes').ZilchGameState | null;
  blackjackSettings: import('../engine/blackjack/settings').BlackjackSettings;
  holdemSettings: import('../engine/holdem/settings').HoldemSettings;
  zilchSettings: import('../engine/zilch/zilchTypes').ZilchGameSettings;
  tableGame: import('./session').GameType | null;
  tableViewMode: TableViewMode;
  selectedSeatId: string | null;
  tableMeta: TableMeta;
  blackjackFlowSettings: BlackjackFlowSettings;
  /** Selected Blackjack rule protocol preset. */
  blackjackProtocolId: string;
  /** Local admin permission toggles. */
  tableAdminSettings: TableAdminSettings;
  /** Active design template id. */
  designTemplateId: string;
}
