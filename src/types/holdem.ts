export type HoldemRoundStatus =
  | 'setup'
  | 'blinds'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'resolved';

export type BettingStreet = 'preflop' | 'flop' | 'turn' | 'river';

export type HoldemPlayerActionStatus =
  | 'waiting'
  | 'active'
  | 'acted'
  | 'folded';

export interface HoldemPlayerState {
  holeCardIds: string[];
  actionStatus: HoldemPlayerActionStatus;
  playerBetsThisStreet: number;
  playerTotalCommitted: number;
  hasActedThisStreet: boolean;
}

export interface HoldemRound {
  status: HoldemRoundStatus;
  bettingStreet: BettingStreet | null;
  smallBlind: number;
  bigBlind: number;
  communityCardIds: string[];
  pot: number;
  currentBet: number;
  dealerButtonPlayerId: string;
  smallBlindPlayerId: string;
  bigBlindPlayerId: string;
  activePlayerId: string | null;
  playerStates: Record<string, HoldemPlayerState>;
  actionLog: string[];
  winners: string[];
  resultSummary: string;
  lastRaiseSize: number;
}

export interface CreateHoldemRoundOptions {
  smallBlind?: number;
  bigBlind?: number;
}

export function createEmptyHoldemRound(
  dealerButtonPlayerId: string,
  smallBlindPlayerId: string,
  bigBlindPlayerId: string,
  options?: CreateHoldemRoundOptions,
): HoldemRound {
  const smallBlind = options?.smallBlind ?? 5;
  const bigBlind = options?.bigBlind ?? 10;
  return {
    status: 'setup',
    bettingStreet: null,
    smallBlind,
    bigBlind,
    communityCardIds: [],
    pot: 0,
    currentBet: 0,
    dealerButtonPlayerId,
    smallBlindPlayerId,
    bigBlindPlayerId,
    activePlayerId: null,
    playerStates: {},
    actionLog: [],
    winners: [],
    resultSummary: '',
    lastRaiseSize: bigBlind,
  };
}

export const BETTING_STREETS: BettingStreet[] = ['preflop', 'flop', 'turn', 'river'];

export function nextBettingStreet(
  street: BettingStreet | null,
): BettingStreet | 'showdown' | null {
  if (!street) {
    return 'preflop';
  }
  const index = BETTING_STREETS.indexOf(street);
  if (index === -1 || index === BETTING_STREETS.length - 1) {
    return 'showdown';
  }
  return BETTING_STREETS[index + 1];
}

export function computeHoldemPot(round: HoldemRound): number {
  return Object.values(round.playerStates).reduce(
    (sum, ps) => sum + ps.playerTotalCommitted,
    0,
  );
}
