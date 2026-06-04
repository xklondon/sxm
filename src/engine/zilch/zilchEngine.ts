import { generateId } from '../utils/id';
import { detectZilchCombinations } from './zilchScoring';
import { resolveDiceAnimationDurationMs } from './settings';
import type {
  ZilchCombination,
  ZilchDie,
  ZilchGameSettings,
  ZilchGameState,
  ZilchKeptGroup,
  ZilchPlayerState,
} from './zilchTypes';

export function createInitialZilchState(
  playerIds: string[],
  settings: ZilchGameSettings,
): ZilchGameState {
  const players: ZilchPlayerState[] = playerIds.map((playerId) => ({
    playerId,
    roundsPlayed: 0,
    hasHadFinalTurn: false,
  }));
  const totalScoresByPlayerId: Record<string, number> = {};
  for (const id of playerIds) {
    totalScoresByPlayerId[id] = 0;
  }

  return {
    phase: 'setup',
    players,
    currentPlayerId: null,
    starterPlayerId: null,
    mode: settings.mode,
    targetPoints: settings.mode === 'target_points' ? settings.targetPoints : undefined,
    roundLimit: settings.mode === 'fixed_rounds' ? settings.roundLimit : undefined,
    currentRound: 1,
    finalRoundStartedByPlayerId: null,
    playersRemainingFinalTurn: undefined,
    dice: [],
    rollNumberInTurn: 0,
    turnScore: 0,
    totalScoresByPlayerId,
    keptDice: [],
    availableCombinations: [],
    keptThisRoll: false,
    diceAnimation: { isRolling: false },
    winnerPlayerId: null,
  };
}

function rollDieValue(rng: () => number): number {
  return 1 + Math.floor(rng() * 6);
}

export function randomiseStarter(
  state: ZilchGameState,
  rng: () => number = Math.random,
): ZilchGameState {
  if (state.phase !== 'setup') {
    throw new Error('Starter can only be randomised during setup');
  }
  if (state.players.length === 0) {
    throw new Error('At least one player is required');
  }
  const index = Math.floor(rng() * state.players.length);
  const starter = state.players[index]!.playerId;
  return {
    ...state,
    phase: 'randomising-starter',
    starterPlayerId: starter,
    currentPlayerId: starter,
  };
}

export function confirmStarter(state: ZilchGameState): ZilchGameState {
  if (state.phase !== 'randomising-starter' || !state.starterPlayerId) {
    throw new Error('Starter randomisation is not active');
  }
  return startTurn(state, state.starterPlayerId);
}

export function startTurn(state: ZilchGameState, playerId: string): ZilchGameState {
  if (!state.players.some((p) => p.playerId === playerId)) {
    throw new Error(`Unknown player ${playerId}`);
  }
  const phase =
    state.phase === 'final-round' ? 'final-round' : ('player-turn' as ZilchGameState['phase']);
  return {
    ...state,
    phase,
    currentPlayerId: playerId,
    rollNumberInTurn: 0,
    turnScore: 0,
    dice: [],
    keptDice: [],
    availableCombinations: [],
    keptThisRoll: false,
    diceAnimation: { isRolling: false },
  };
}

function diceToRollCount(state: ZilchGameState): number {
  const available = state.dice.filter((d) => d.isAvailable && !d.isKept);
  if (available.length > 0) {
    return available.length;
  }
  return 6;
}

export function rollDice(
  state: ZilchGameState,
  settings: ZilchGameSettings,
  rng: () => number = Math.random,
  now: number = Date.now(),
): ZilchGameState {
  if (state.phase !== 'player-turn') {
    throw new Error('Can only roll during an active turn');
  }
  if (state.diceAnimation.isRolling) {
    throw new Error('Dice are already rolling');
  }

  const count = diceToRollCount(state);
  const values = Array.from({ length: count }, () => rollDieValue(rng));
  const durationMs = resolveDiceAnimationDurationMs(settings.diceAnimation, rng);

  const nextDice: ZilchDie[] =
    count === 6
      ? values.map((value) => ({
          id: generateId(),
          value,
          isAvailable: true,
          isKept: false,
        }))
      : state.dice
          .filter((d) => d.isKept)
          .concat(
            values.map((value) => ({
              id: generateId(),
              value,
              isAvailable: true,
              isKept: false,
            })),
          );

  return {
    ...state,
    rollNumberInTurn: state.rollNumberInTurn + 1,
    keptThisRoll: false,
    lastZilchPlayerId: null,
    dice: nextDice,
    availableCombinations: [],
    diceAnimation: {
      isRolling: true,
      startedAt: now,
      durationMs,
      pendingValues: values,
    },
  };
}

/** Reveal dice after animation — evaluates combinations or zilch. */
export function completeDiceRoll(state: ZilchGameState): ZilchGameState {
  if (!state.diceAnimation.isRolling) {
    return state;
  }

  let dice = state.dice;
  const pending = state.diceAnimation.pendingValues;
  if (pending && pending.length > 0) {
    const unkept = dice.filter((d) => !d.isKept);
    dice = [
      ...dice.filter((d) => d.isKept),
      ...unkept.map((die, i) => ({
        ...die,
        value: pending[i] ?? die.value,
      })),
    ];
  }

  const combinations = detectZilchCombinations(dice);
  if (combinations.length === 0) {
    return endTurnWithZilch({
      ...state,
      dice,
      diceAnimation: { isRolling: false },
      availableCombinations: [],
    });
  }

  return {
    ...state,
    dice,
    phase: 'awaiting-keep-selection',
    availableCombinations: combinations,
    diceAnimation: { isRolling: false },
  };
}

function findCombination(
  state: ZilchGameState,
  combinationId: string,
): ZilchCombination | undefined {
  return state.availableCombinations.find((c) => c.id === combinationId);
}

function combinationDiceAvailable(state: ZilchGameState, combo: ZilchCombination): boolean {
  const dieMap = new Map(state.dice.map((d) => [d.id, d]));
  return combo.diceIds.every((id) => {
    const die = dieMap.get(id);
    return die && die.isAvailable && !die.isKept;
  });
}

export function keepCombination(
  state: ZilchGameState,
  combinationId: string,
): ZilchGameState {
  if (state.phase !== 'awaiting-keep-selection' && state.phase !== 'player-turn') {
    throw new Error('Cannot keep a combination in the current phase');
  }

  const combo = findCombination(state, combinationId);
  if (!combo) {
    throw new Error(`Unknown combination ${combinationId}`);
  }
  if (!combinationDiceAvailable(state, combo)) {
    throw new Error('Combination dice are not available');
  }

  const groupId = generateId();
  const keptGroup: ZilchKeptGroup = {
    id: groupId,
    combinationId: combo.id,
    label: combo.label,
    diceIds: [...combo.diceIds],
    score: combo.score,
    rollNumberInTurn: state.rollNumberInTurn,
  };

  const keptIds = new Set(combo.diceIds);
  const nextDice = state.dice.map((d) =>
    keptIds.has(d.id)
      ? { ...d, isKept: true, isAvailable: false, keptGroupId: groupId }
      : d,
  );

  const remainingAvailable = nextDice.filter((d) => d.isAvailable && !d.isKept);
  const nextCombinations = detectZilchCombinations(nextDice).filter((c) =>
    combinationDiceAvailable({ ...state, dice: nextDice }, c),
  );

  const turnover = remainingAvailable.length === 0;
  let phase: ZilchGameState['phase'] = 'player-turn';
  let diceAfter = nextDice;
  let keptAfter = [...state.keptDice, keptGroup];

  if (turnover) {
    diceAfter = [];
    keptAfter = [];
    phase = 'player-turn';
  }

  return {
    ...state,
    phase,
    dice: diceAfter,
    keptDice: keptAfter,
    turnScore: state.turnScore + combo.score,
    availableCombinations: turnover ? [] : nextCombinations,
    keptThisRoll: true,
  };
}

export function bankTurn(state: ZilchGameState): ZilchGameState {
  if (state.phase !== 'player-turn' && state.phase !== 'awaiting-keep-selection') {
    throw new Error('Cannot bank in the current phase');
  }
  if (state.turnScore <= 0) {
    throw new Error('Nothing to bank');
  }
  if (!state.keptThisRoll) {
    throw new Error('Must keep a scoring combination before banking');
  }

  const playerId = state.currentPlayerId;
  if (!playerId) {
    throw new Error('No active player');
  }

  const totalScoresByPlayerId = {
    ...state.totalScoresByPlayerId,
    [playerId]: (state.totalScoresByPlayerId[playerId] ?? 0) + state.turnScore,
  };

  const next = incrementRoundsPlayed(
    {
      ...state,
      totalScoresByPlayerId,
      turnScore: 0,
      dice: [],
      keptDice: [],
      availableCombinations: [],
      keptThisRoll: false,
      diceAnimation: { isRolling: false },
    },
    playerId,
  );

  if (next.mode === 'target_points' && !next.finalRoundStartedByPlayerId) {
    const total = totalScoresByPlayerId[playerId] ?? 0;
    if (total > (next.targetPoints ?? 0)) {
      const remaining = next.players
        .map((p) => p.playerId)
        .filter((id) => id !== playerId);
      if (remaining.length === 0) {
        return {
          ...next,
          phase: 'completed',
          winnerPlayerId: highestScorePlayerId(next),
          currentPlayerId: null,
        };
      }
      const first = remaining[0]!;
      return startTurn(
        {
          ...next,
          phase: 'final-round',
          finalRoundStartedByPlayerId: playerId,
          playersRemainingFinalTurn: remaining,
        },
        first,
      );
    }
  }

  if (next.mode === 'fixed_rounds' && allPlayersReachedRoundLimit(next)) {
    return {
      ...next,
      phase: 'completed',
      winnerPlayerId: highestScorePlayerId(next),
      currentPlayerId: null,
    };
  }

  return advanceToNextPlayer(next);
}

export function endTurnWithZilch(state: ZilchGameState): ZilchGameState {
  const playerId = state.currentPlayerId;
  if (!playerId) {
    throw new Error('No active player');
  }

  const priorTotal = state.totalScoresByPlayerId[playerId] ?? 0;

  const next = incrementRoundsPlayed(
    {
      ...state,
      phase: 'zilch',
      turnScore: 0,
      dice: [],
      keptDice: [],
      availableCombinations: [],
      keptThisRoll: false,
      diceAnimation: { isRolling: false },
      lastZilchPlayerId: playerId,
    },
    playerId,
  );

  if ((next.totalScoresByPlayerId[playerId] ?? 0) !== priorTotal) {
    throw new Error('Zilch must not change total game score');
  }

  if (next.mode === 'fixed_rounds' && allPlayersReachedRoundLimit(next)) {
    return {
      ...next,
      phase: 'completed',
      winnerPlayerId: highestScorePlayerId(next),
      currentPlayerId: null,
    };
  }

  return advanceToNextPlayer(next);
}

function incrementRoundsPlayed(state: ZilchGameState, playerId: string): ZilchGameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === playerId
        ? { ...p, roundsPlayed: p.roundsPlayed + 1 }
        : p,
    ),
  };
}

export function advanceToNextPlayer(state: ZilchGameState): ZilchGameState {
  const currentId = state.currentPlayerId;
  if (!currentId) {
    return state;
  }

  if (state.phase === 'final-round' && state.playersRemainingFinalTurn) {
    const remaining = state.playersRemainingFinalTurn.filter((id) => id !== currentId);
    if (remaining.length === 0) {
      return {
        ...state,
        phase: 'completed',
        winnerPlayerId: highestScorePlayerId(state),
        currentPlayerId: null,
      };
    }
    const nextPlayerId = remaining[0]!;
    return startTurn(
      { ...state, playersRemainingFinalTurn: remaining },
      nextPlayerId,
    );
  }

  const order = state.players.map((p) => p.playerId);
  const idx = order.indexOf(currentId);
  const nextIdx = (idx + 1) % order.length;
  const nextPlayerId = order[nextIdx]!;
  const nextRound = state.currentRound + (nextIdx === 0 ? 1 : 0);

  return startTurn({ ...state, currentRound: nextRound }, nextPlayerId);
}

function highestScorePlayerId(state: ZilchGameState): string | null {
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const [id, score] of Object.entries(state.totalScoresByPlayerId)) {
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

function allPlayersReachedRoundLimit(state: ZilchGameState): boolean {
  const limit = state.roundLimit ?? 0;
  return state.players.every((p) => p.roundsPlayed >= limit);
}

export function checkZilchGameEnd(state: ZilchGameState): ZilchGameState {
  if (state.phase === 'completed') {
    return state;
  }

  if (state.mode === 'fixed_rounds' && allPlayersReachedRoundLimit(state)) {
    return {
      ...state,
      phase: 'completed',
      currentPlayerId: null,
      winnerPlayerId: highestScorePlayerId(state),
    };
  }

  return state;
}

export function getZilchWinnerId(state: ZilchGameState): string | null {
  if (state.winnerPlayerId) {
    return state.winnerPlayerId;
  }
  return highestScorePlayerId(state);
}

export function canRollDice(state: ZilchGameState): boolean {
  return state.phase === 'player-turn' && !state.diceAnimation.isRolling;
}

export function canBank(state: ZilchGameState): boolean {
  if (state.phase === 'zilch' || state.phase === 'completed') {
    return false;
  }
  return (
    state.turnScore > 0 &&
    state.keptThisRoll &&
    (state.phase === 'player-turn' || state.phase === 'awaiting-keep-selection')
  );
}

export function canKeepCombination(state: ZilchGameState): boolean {
  return state.phase === 'awaiting-keep-selection' && state.availableCombinations.length > 0;
}

/** Bank current turn score without rolling remaining dice (Greater Glory quit). */
export function quitTurn(state: ZilchGameState): ZilchGameState {
  return bankTurn(state);
}
