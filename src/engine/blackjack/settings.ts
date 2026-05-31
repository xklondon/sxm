/** Blackjack table rules — imported by engine, not hard-coded in UI. */



import { LAS_VEGAS_PROTOCOL, protocolToBlackjackSettings } from './protocols';



export type BlackjackStartingPhase = 'betting' | 'deal';



export interface BlackjackSettings {

  /** Number of standard 52-card decks in the shoe (default 6). */

  numberOfDecks: number;

  /** Natural blackjack payout multiplier (default 1.5 = 3:2). */

  blackjackPayout: number;

  /** If true, dealer stands on soft 17; if false, dealer hits soft 17. */

  dealerStandsOnSoft17: boolean;

  /** 'any' = double on any first-two-card total; else hard totals only (e.g. 9, 10, 11). */
  doubleAllowedTotals: 'any' | number[];

  allowDoubleDown: boolean;

  allowSplit: boolean;

  maxSplits: number;

  allowDoubleAfterSplit: boolean;

  allowInsurance: boolean;

  /** European-style: dealer second card deferred until bank turn. */
  holeCardDealtLast: boolean;

  startingPhase: BlackjackStartingPhase;

  minBet: number;

  maxBet: number;

}



/** Defaults from active Las Vegas protocol — single source of truth. */

export const DEFAULT_BLACKJACK_SETTINGS: BlackjackSettings =

  protocolToBlackjackSettings(LAS_VEGAS_PROTOCOL);



export function mergeBlackjackSettings(

  partial?: Partial<BlackjackSettings>,

): BlackjackSettings {

  return { ...DEFAULT_BLACKJACK_SETTINGS, ...partial };

}

