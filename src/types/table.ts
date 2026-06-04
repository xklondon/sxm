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

/** Per-box open betting stake (chips placed before shuffle / start round). */
export interface BoxStakeEntry {
  amount: number;
  chips: number[];
  /** True once stake meets minimum bet (auto-set on add or via confirm). */
  confirmed?: boolean;
  /** Person bankroll id of the caller for this box (first staker on free box). */
  callerPersonId?: string;
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
  /** True after payout until player presses Next Round. */
  awaitingNextRound: boolean;
  /** Active play vs table ended (one side holds all chips). */
  gameStatus: TableGameStatus;
  /** Bank or person bankroll id when gameStatus is ended. */
  winnerId: string | null;
  endedAt: string | null;
  /** Placeholder for future wager voucher flow. */
  wagerVoucherStatus: WagerVoucherStatus;
  /** Per-person auto-stand play flow (manual | auto-18 … auto-21). */
  personPlayFlow?: Record<string, import('../storage/profileStorage').PlayFlowAutoStand>;
  /** Table game family — cards (blackjack/holdem) or dice (zilch). */
  gameCategory?: import('./session').GameCategory;
  /** Active dice game when gameCategory is dice. */
  diceGame?: 'zilch';
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
    gameStatus: 'active',
    winnerId: null,
    endedAt: null,
    wagerVoucherStatus: 'not-created',
    tableNotice: null,
    joinHighlight: null,
  };
}
