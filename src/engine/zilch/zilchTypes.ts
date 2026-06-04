export type ZilchPhase =
  | 'setup'
  | 'randomising-starter'
  | 'player-turn'
  | 'awaiting-keep-selection'
  | 'zilch'
  | 'final-round'
  | 'completed';

export type ZilchMode = 'target_points' | 'fixed_rounds';

export type ZilchCombinationType =
  | 'six_of_a_kind'
  | 'straight'
  | 'three_pairs'
  | 'five_of_a_kind'
  | 'four_of_a_kind'
  | 'three_of_a_kind'
  | 'single_one'
  | 'single_five';

export interface ZilchDie {
  id: string;
  value: number;
  isAvailable: boolean;
  isKept: boolean;
  keptGroupId?: string;
}

export interface ZilchKeptGroup {
  id: string;
  combinationId: string;
  label: string;
  diceIds: string[];
  score: number;
  rollNumberInTurn: number;
}

export interface ZilchCombination {
  id: string;
  label: string;
  diceIds: string[];
  score: number;
  type: ZilchCombinationType;
}

export interface ZilchPlayerState {
  playerId: string;
  roundsPlayed: number;
  hasHadFinalTurn: boolean;
}

export type DiceAnimationMode = 'fixed' | 'random';

export interface ZilchDiceAnimationSettings {
  diceAnimationMode: DiceAnimationMode;
  diceAnimationMs: number;
  diceAnimationRandomMinMs: number;
  diceAnimationRandomMaxMs: number;
}

export interface ZilchGameSettings {
  mode: ZilchMode;
  targetPoints: number;
  roundLimit: number;
  diceAnimation: ZilchDiceAnimationSettings;
}

export interface ZilchGameState {
  phase: ZilchPhase;
  players: ZilchPlayerState[];
  currentPlayerId: string | null;
  starterPlayerId: string | null;
  mode: ZilchMode;
  targetPoints?: number;
  roundLimit?: number;
  currentRound: number;
  finalRoundStartedByPlayerId?: string | null;
  playersRemainingFinalTurn?: string[];
  dice: ZilchDie[];
  rollNumberInTurn: number;
  turnScore: number;
  totalScoresByPlayerId: Record<string, number>;
  keptDice: ZilchKeptGroup[];
  availableCombinations: ZilchCombination[];
  /** True once at least one combination is kept after the current roll. */
  keptThisRoll: boolean;
  diceAnimation: {
    isRolling: boolean;
    startedAt?: number;
    durationMs?: number;
    /** Values hidden until animation completes — set when roll finishes. */
    pendingValues?: number[];
  };
  winnerPlayerId?: string | null;
}
