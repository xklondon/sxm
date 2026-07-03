export type BlackjackRoundStatus =
  | 'betting'
  | 'initial-deal'
  | 'player-turns'
  | 'bank-turn'
  | 'banking'
  | 'resolved';

export type BlackjackPlayerActionStatus =
  | 'betting'
  | 'acting'
  | 'stood'
  | 'busted'
  | 'blackjack'
  | 'done';

export type BlackjackOutcome =
  | 'win'
  | 'loss'
  | 'push'
  | 'blackjack-win'
  | 'blackjack-push';

export interface BlackjackPlayerHand {
  playerId: string;
  handIndex: number;
  cardIds: string[];
  actionStatus: BlackjackPlayerActionStatus;
  currentBet: number;
  doubled: boolean;
  fromSplit: boolean;
  /** True after immediate bust settlement — skip duplicate payout at banking. */
  bustSettled?: boolean;
  /** True after natural blackjack paid immediately or via even money. */
  naturalSettled?: boolean;
  /** Snapshot of who paid what on this hand — used for proportional settlement. */
  stakerAmountsByPersonId?: Record<string, number>;
}

export interface BlackjackRound {
  status: BlackjackRoundStatus;
  dealerCardIds: string[];
  dealerHoleHidden: boolean;
  /** Active split hand key, e.g. `playerId:0`. */
  activeHandKey: string | null;
  /** @deprecated Use activeHandKey — kept for transitional reads */
  activePlayerId: string | null;
  playerHands: Record<string, BlackjackPlayerHand>;
  splitCounts: Record<string, number>;
  outcomes: Record<string, BlackjackOutcome>;
  resultMessages: Record<string, string>;
  /** Index into initial-deal plan while status is `initial-deal`. */
  initialDealStepIndex?: number;
  /** Hand keys locked when initial deal begins — must match deal plan steps. */
  initialDealHandKeys?: string[];
  insuranceOfferPending?: boolean;
  /** playerId -> insurance chips wagered (half of main bet max) */
  insuranceBets?: Record<string, number>;
  /** playerId -> declined insurance this round */
  insuranceDeclined?: Record<string, boolean>;
  /** playerId -> explicit skip reason when insurance could not be funded */
  insuranceSkipReasons?: Record<string, string>;
  /** boxPlayerId -> stakerPersonId -> accepted | declined | skipped */
  insuranceStakerDecisions?: Record<string, Record<string, 'accepted' | 'declined' | 'skipped'>>;
  /** boxPlayerId -> stakerPersonId -> skip reason */
  insuranceStakerSkipReasons?: Record<string, Record<string, string>>;
  /** boxPlayerId -> stakerPersonId -> insurance chips accepted for that staker share */
  insuranceStakerBets?: Record<string, Record<string, number>>;
  /** True after payout ledger entries are written — prevents double settlement. */
  isSettled?: boolean;
  settledAt?: string | null;
  /** Hand key awaiting even-money decision (natural vs dealer Ace/10). */
  evenMoneyOfferHandKey?: string | null;
  /** Remaining even-money offers after the active one (multi-box). */
  evenMoneyPendingHandKeys?: string[];
  evenMoneyDeclined?: Record<string, boolean>;
  tookEvenMoney?: Record<string, boolean>;
}

export function createEmptyBlackjackRound(): BlackjackRound {
  return {
    status: 'betting',
    dealerCardIds: [],
    dealerHoleHidden: true,
    activeHandKey: null,
    activePlayerId: null,
    playerHands: {},
    splitCounts: {},
    outcomes: {},
    resultMessages: {},
    insuranceOfferPending: false,
    insuranceBets: {},
    insuranceDeclined: {},
  };
}

export function createBlackjackPlayerHand(
  playerId: string,
  handIndex = 0,
  fromSplit = false,
): BlackjackPlayerHand {
  return {
    playerId,
    handIndex,
    cardIds: [],
    actionStatus: 'betting',
    currentBet: 0,
    doubled: false,
    fromSplit,
  };
}
