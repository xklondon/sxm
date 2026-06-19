/** Zilch dice game — protocol types (no Blackjack dependencies). */

export type ZilchGameMode = 'target_points' | 'fixed_rounds';

/** @alias ZilchGameMode — stake setup compatibility */
export type ZilchMode = ZilchGameMode;

export type ZilchTableMode = 'practice' | 'challenge';

export type ZilchPhase =
  | 'setup'
  | 'randomising-starter'
  | 'player-turn'
  | 'awaiting-keep-selection'
  | 'zilch'
  | 'final-round'
  | 'completed';

/** Semantic phase aliases for protocol docs (maps to ZilchPhase). */
export type ZilchProtocolPhase =
  | 'setup'
  | 'rolling'
  | 'selecting'
  | 'zilched'
  | 'banking'
  | 'game-over';

export function mapZilchPhaseToProtocol(phase: ZilchPhase): ZilchProtocolPhase {
  switch (phase) {
    case 'setup':
    case 'randomising-starter':
      return phase === 'randomising-starter' ? 'rolling' : 'setup';
    case 'awaiting-keep-selection':
      return 'selecting';
    case 'zilch':
      return 'zilched';
    case 'player-turn':
      return 'banking';
    case 'final-round':
      return 'banking';
    case 'completed':
      return 'game-over';
    default:
      return 'setup';
  }
}

export type ZilchCombinationType =
  | 'single_one'
  | 'single_five'
  | 'three_of_a_kind'
  | 'four_of_a_kind'
  | 'five_of_a_kind'
  | 'six_of_a_kind'
  | 'straight'
  | 'three_pairs'
  | 'two_triplets';

export interface ZilchDie {
  id: string;
  value: number;
  isAvailable: boolean;
  isKept: boolean;
  keptGroupId?: string;
  /** Per-die hold selection during combination pick (UI convenience). */
  held?: boolean;
  scoring?: boolean;
  locked?: boolean;
}

export interface ZilchCombination {
  id: string;
  label: string;
  diceIds: string[];
  score: number;
  type: ZilchCombinationType;
}

export interface ZilchKeptGroup {
  id: string;
  combinationId: string;
  label: string;
  diceIds: string[];
  score: number;
  rollNumberInTurn: number;
}

export interface ZilchPlayerState {
  playerId: string;
  roundsPlayed: number;
}

export interface ZilchDiceAnimationState {
  isRolling: boolean;
  startedAt?: number;
  durationMs?: number;
  pendingValues?: number[];
}

export interface ZilchHistoryEvent {
  id: string;
  at: number;
  type: string;
  playerId?: string;
  payload?: Record<string, unknown>;
}

export interface ZilchGameState {
  protocolId: 'zilch';
  gameId: string;
  tableMode: ZilchTableMode;
  mode: ZilchGameMode;
  targetPoints: number | null;
  roundLimit: number | null;
  phase: ZilchPhase;
  players: ZilchPlayerState[];
  currentPlayerId: string | null;
  starterPlayerId: string | null;
  currentRound: number;
  dice: ZilchDie[];
  keptDice: ZilchKeptGroup[];
  availableCombinations: ZilchCombination[];
  turnScore: number;
  totalScoresByPlayerId: Record<string, number>;
  rollNumberInTurn: number;
  keptThisRoll: boolean;
  lastZilchPlayerId: string | null;
  finalRoundStartedByPlayerId: string | null;
  playersRemainingFinalTurn: string[] | null;
  winnerPlayerId: string | null;
  diceAnimation: ZilchDiceAnimationState;
  history: ZilchHistoryEvent[];
  wagerMetadata?: Record<string, unknown>;
}

export interface ZilchDiceAnimationSettings {
  diceAnimationMode: 'fixed' | 'random';
  diceAnimationMs: number;
  diceAnimationRandomMinMs: number;
  diceAnimationRandomMaxMs: number;
}

export interface ZilchGameSettings {
  mode: ZilchGameMode;
  targetPoints: number;
  roundLimit: number;
  diceAnimation: ZilchDiceAnimationSettings;
}
