import type { BlackjackProtocolPhase } from '../protocol';

/** Player actions AID may recommend during play. */
export type AidRecommendedAction =
  | 'hit'
  | 'stand'
  | 'double'
  | 'split'
  | 'insurance-take'
  | 'insurance-decline'
  | 'surrender'
  | 'none';

/** Engine-level player actions allowed by a protocol variant. */
export type ProtocolPlayerAction =
  | 'hit'
  | 'stand'
  | 'double'
  | 'split'
  | 'insurance'
  | 'surrender';

export interface ShoeConfig {
  deckCount: number;
  minDecks: number;
  maxDecks: number;
  reshuffleWhenEmpty: boolean;
}

export interface DealerRules {
  /** Dealer stands on soft 17 when true; hits soft 17 when false. */
  standsOnSoft17: boolean;
  /** Dealer must hit below this hard total. */
  hitBelow: number;
  /** Dealer stands at or above this hard total (when not soft). */
  standAtOrAbove: number;
  peekOnAce: boolean;
  peekOnTen: boolean;
  description: string;
}

export interface PayoutRules {
  /** Natural blackjack multiplier (1.5 = 3:2). */
  blackjackMultiplier: number;
  blackjackLabel: string;
  winPays: string;
  pushPays: string;
  bustLoses: string;
}

export interface DoubleRules {
  allowed: boolean;
  /** Only on first two cards. */
  firstTwoCardsOnly: boolean;
  /** One card only after double. */
  oneCardOnly: boolean;
  allowedAfterSplit: boolean;
  /** Hard totals allowed for double — 'any' or list e.g. [9, 10, 11]. */
  allowedHardTotals: 'any' | number[];
  description: string;
}

export interface SplitRules {
  allowed: boolean;
  sameRankOnly: boolean;
  maxSplitsPerRound: number;
  resplitAces: boolean;
  hitSplitAces: boolean;
  doubleAfterSplit: boolean;
  description: string;
}

export interface InsuranceRules {
  offered: boolean;
  /** Max insurance = half of main bet (floor). */
  maxHalfOfMainBet: boolean;
  payoutRatio: number;
  payoutLabel: string;
  description: string;
}

export interface SurrenderRules {
  allowed: boolean;
  lateSurrender: boolean;
  earlySurrender: boolean;
  description: string;
}

export interface HandResolutionRules {
  compareAfterDealerCompletes: boolean;
  naturalBeatsNonNatural: boolean;
  splitHandsResolvedIndependently: boolean;
  description: string;
}

export interface PhaseActionRules {
  /** Actions allowed per protocol phase (high-level). */
  byPhase: Partial<Record<BlackjackProtocolPhase, ProtocolPlayerAction[]>>;
}

/** Hooks for future variants — not active in Las Vegas default. */
export interface VariantExtensions {
  wildCards?: {
    enabled: boolean;
    description: string;
  };
  sideBets?: Array<{
    id: string;
    name: string;
    description: string;
    enabled: boolean;
  }>;
  alteredPayouts?: Record<string, string>;
  customDealerBehavior?: string;
}

export interface ProtocolDisplayRule {
  id: string;
  label: string;
  value: string;
}

/** How cards are revealed during the initial deal. */
export interface DealingRules {
  /** If false, dealer hole card hidden until players finish (European no-hole-card style). */
  showDealerHoleCardDuringPlay: boolean;
  /** Dealer second card dealt after all player cards (European style). */
  holeCardDealtLast: boolean;
  description: string;
}

/** AID tone and strategy emphasis for this protocol. */
export interface AidProfile {
  id: string;
  label: string;
  description: string;
  insuranceBias: 'decline' | 'neutral' | 'count-only';
}

export interface BlackjackProtocol {
  /** Unique protocol preset id. */
  protocolId: string;
  /** UI label — e.g. "Las Vegas Protocol — house rules". */
  displayName: string;
  /** One-line summary for setup screens. */
  shortDescription: string;
  /** @deprecated use protocolId */
  id: string;
  /** @deprecated use displayName */
  name: string;
  /** @deprecated use shortDescription */
  summary: string;
  shoe: ShoeConfig;
  dealer: DealerRules;
  /** Human-readable dealer draw rule for UI. */
  dealerDrawRule: string;
  payouts: PayoutRules;
  /** @deprecated use payouts.blackjackMultiplier */
  blackjackPayout: number;
  double: DoubleRules;
  split: SplitRules;
  insurance: InsuranceRules;
  surrender: SurrenderRules;
  resolution: HandResolutionRules;
  dealingRules: DealingRules;
  phaseActions: PhaseActionRules;
  /** Player actions supported in this variant. */
  supportedActions: ProtocolPlayerAction[];
  aidProfile: AidProfile;
  defaultMinBet: number;
  defaultMaxBet: number;
  extensions: VariantExtensions;
  displayRules: ProtocolDisplayRule[];
  /** Deck count shortcut for setup summaries. */
  numberOfDecks: number;
}
