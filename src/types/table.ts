/** Local honor-system agreement for what this table session is played for. */
export interface TableAgreement {
  stakeDescription: string;
  defaultChips: number;
  agreedAt: string;
}

/** Placeholder outcome when a table session ends — personal ledger deferred. */
export interface TableOutcome {
  winnerId: string | null;
  loserId: string | null;
  stakeDescription: string;
  note: string;
  recordedAt: string;
}

export type TableSessionStatus = 'open' | 'complete';

export type TableGameStatus = 'active' | 'ended';

/** Practice = dealer bank, no wager; Challenge = friends, wager, player bank. */
export type TableMode = 'practice' | 'challenge';

/** Pre-game Challenge choice when the bank player goes bust. */
export type BankBustSettlementMode = 'fractional' | 'winner-takes-all';

export type WagerVoucherStatus = 'pending' | 'not-created';

export type BankerMode = 'unset' | 'bot' | 'person';

export interface BankerSetup {
  mode: BankerMode;
  displayName: string;
  playerId: string | null;
  startBalance: number;
}

/** Fixed table position — slot 1 is rightmost and acts first. */
export interface BoxSlotState {
  slotNumber: number;
  playerId: string | null;
  /** Person player id that owns the bankroll for this box. */
  bankrollOwnerId: string | null;
  /** Native assigned person for this slot (from This Table order). */
  nativeAssignedPersonId: string | null;
  /** Person who calls Hit/Stay/Split/Double for this box this round. */
  callerPersonId: string | null;
  passiveNames: string[];
}

/** Local table owner — not auth, device-local only. */
export interface TableOwner {
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
}

import type { TableInviteRecord } from './invites';

/** @deprecated use TableInviteRecord */
export type TableInvite = TableInviteRecord;

/** One chip on a box stake — payer is who placed it (not native box owner). */
export interface StakeChipEntry {
  value: number;
  payerPersonId: string;
}

/** Per-box open betting stake (chips placed before shuffle / start round). */
export interface BoxStakeEntry {
  amount: number;
  /** Legacy chip values only — prefer chipEntries for payer attribution. */
  chips: number[];
  /** Chip stack with payer per chip (canonical for undo). */
  chipEntries?: StakeChipEntry[];
  /** True once stake meets minimum bet (auto-set on add or via confirm). */
  confirmed?: boolean;
  /** Person bankroll id of the caller for this box (first staker on free box). */
  callerPersonId?: string;
  /** Person bankroll ids who placed chips on this box (for This Table co-box display). */
  stakerPersonIds?: string[];
  /** Per-person chip totals on this box — source of truth for exposure and deal debits. */
  stakerAmountsByPersonId?: Record<string, number>;
}

export interface TableMeta {
  agreement: TableAgreement | null;
  outcome: TableOutcome | null;
  status: TableSessionStatus;
  /** Show stake setup panel on first open. */
  showStakeSetup: boolean;
  /** Show banker picker before play (legacy — set with stake panel). */
  showBankerSetup: boolean;
  bankerSetup: BankerSetup;
  /** Seven fixed box positions (1 = rightmost). */
  boxSlots: BoxSlotState[];
  /** Name of the person at this device / controller. */
  controllerName: string;
  /** Local table owner metadata. */
  owner: TableOwner | null;
  /** Person bankroll id for the table owner (device-local). */
  ownerPersonId: string | null;
  /** Display order in This Table — first player gets native Box 1. */
  playerOrder: string[];
  /** Native assigned slot per person bankroll id. */
  assignedBoxByPersonId: Record<string, number>;
  /** Pending email invites (local only). */
  invites: TableInviteRecord[];
  /** True after first deal — protocol cannot change mid-round. */
  protocolLocked: boolean;
  /** Open box stakes — single source of truth until round ends. */
  boxStakes: Record<string, BoxStakeEntry>;
  /** True after shuffle/start-round until banking completes. */
  bettingLocked: boolean;
  /** True after first shuffle this table session. */
  shoeStarted: boolean;
  /** Configured starting chips for each box seat (ledger buy-in on claim). */
  startingChipsEachSeat: number;
  /** Configured starting chips for the bank (ledger buy-in at setup). */
  startingChipsBank: number;
  /** Minimum bet per box for deal eligibility (owner-editable during betting). */
  minimumBet: number;
  /** True after payout until player presses New Cards. */
  awaitingNextRound: boolean;
  /** Show structured round summary overlay after settlement (default on). */
  showRoundSummaryOverlay?: boolean;
  /** Visual-only felt / table cloth artwork in the cards area. */
  tableFeltSkin?: import('./tableFeltSkin').TableFeltSkin;
  /** Printed table name on classic cloth (header stays BLACKJACK). */
  tableClothName?: string;
  /** Optional social wager label on classic cloth — visual only. */
  tableClothWager?: string;
  /** Chip tray footer label (mobile). Admin-editable; defaults to SxM Casino Challenge. */
  tableTrayLabel?: string;
  /** Practice or challenge — drives setup UX and end-of-game ledger offer. */
  tableMode?: TableMode;
  /** Emails invited during challenge setup (before/at table start). */
  setupInvitedEmails?: string[];
  /** Challenge pre-game: how bank bankruptcy is settled (default fractional). */
  bankBustSettlementMode?: BankBustSettlementMode;
  /** Active play vs table ended (one side holds all chips). */
  gameStatus: TableGameStatus;
  /** Bank or person bankroll id when gameStatus is ended. */
  winnerId: string | null;
  /** Why the table session ended (single-holder, bank-bust, etc.). */
  gameEndReason?:
    | 'bank-bust'
    | 'single-holder'
    | 'bank-has-all-chips'
    | 'bank-empty'
    | 'all-players-eliminated'
    | 'zilch-completed'
    | 'last-player-standing'
    | 'chip-leader';
  /** Effective settlement applied at game end (may fall back to fractional on tie). */
  settlementMode?: BankBustSettlementMode;
  endedAt: string | null;
  /** Placeholder for future wager voucher flow. */
  wagerVoucherStatus: WagerVoucherStatus;
  /** Per-person auto-stand play flow (manual | auto-18 … auto-21). */
  personPlayFlow?: Record<string, import('../storage/profileStorage').PlayFlowAutoStand>;
  /** Table game family — cards (blackjack/holdem) or dice (zilch). */
  gameCategory?: import('./session').GameCategory;
  /** Active dice game when gameCategory is dice. */
  diceGame?: 'zilch';
  /** Active card game when gameCategory is cards. */
  cardGame?: 'blackjack' | 'holdem';
  /** Texas Hold'em poker table config (isolated from blackjack/zilch). */
  pokerConfig?: import('./poker').PokerTableConfig;
  /** Brief table-wide message in the command area (e.g. player joined). */
  tableNotice?: {
    message: string;
    personId: string;
    slotNumber: number;
    at: string;
  } | null;
  /** Highlights a newly assigned box during betting. */
  joinHighlight?: {
    personId: string;
    slotNumber: number;
  } | null;
  /** Session blackjack wins per box slot (1 = rightmost). */
  blackjackCountBySlot?: Record<number, number>;
}

export const MAX_TABLE_BOXES = 7;

export function createEmptyBoxSlots(): BoxSlotState[] {
  return Array.from({ length: MAX_TABLE_BOXES }, (_, i) => ({
    slotNumber: i + 1,
    playerId: null,
    bankrollOwnerId: null,
    nativeAssignedPersonId: null,
    callerPersonId: null,
    passiveNames: [],
  }));
}

export function resolveShowRoundSummaryOverlay(meta: Pick<TableMeta, 'showRoundSummaryOverlay'>): boolean {
  return meta.showRoundSummaryOverlay === true;
}

export function createDefaultTableMeta(): TableMeta {
  return {
    agreement: null,
    outcome: null,
    status: 'open',
    showStakeSetup: true,
    showBankerSetup: true,
    bankerSetup: {
      mode: 'unset',
      displayName: '',
      playerId: null,
      startBalance: 500,
    },
    boxSlots: createEmptyBoxSlots(),
    controllerName: '',
    owner: null,
    ownerPersonId: null,
    playerOrder: [],
    assignedBoxByPersonId: {},
    invites: [],
    protocolLocked: false,
    boxStakes: {},
    bettingLocked: false,
    shoeStarted: false,
    startingChipsEachSeat: 500,
    startingChipsBank: 500,
    minimumBet: 5,
    awaitingNextRound: false,
    showRoundSummaryOverlay: false,
    gameStatus: 'active',
    winnerId: null,
    endedAt: null,
    wagerVoucherStatus: 'not-created',
    tableNotice: null,
    joinHighlight: null,
  };
}
