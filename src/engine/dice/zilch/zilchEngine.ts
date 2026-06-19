import type {
  ZilchCombination,
  ZilchDie,
  ZilchGameSettings,
  ZilchGameState,
  ZilchKeptGroup,
} from './zilchTypes';
import { detectZilchCombinations } from './zilchRules';
import { appendEvent, generateId } from './zilchState';
import { getZilchWinnerId } from './zilchSelectors';
import { resolveDiceAnimationDurationMs } from './settings';

export { createZilchGame, createInitialZilchState, resetTurn, startZilchGame } from './zilchState';

function rollDieValue(rng: () => number): number {
  return 1 + Math.floor(rng() * 6);
}

function freshDice(count: number): ZilchDie[] {
  return Array.from({ length: count }, () => ({
    id: generateId(),
    value: 1,
    isAvailable: true,
    isKept: false,
  }));
}

export function randomiseStarter(
  state: ZilchGameState,
  rng: () => number = Math.random,
): ZilchGameState {
  if (state.phase !== 'setup' && state.phase !== 'randomising-starter') {
    throw new Error('Starter can only be randomised before the first turn');
  }
  if (state.players.length === 0) {
    throw new Error('No players');
  }
  const idx = Math.floor(rng() * state.players.length);
  const starterId = state.players[idx]!.playerId;
  return startTurn(
    {
      ...state,
      starterPlayerId: starterId,
      diceAnimation: { isRolling: false },
      history: appendEvent(state, 'starter-randomised', starterId),
    },
    starterId,
  );
}

/** @deprecated Starter selection completes in randomiseStarter; kept for legacy actions. */
export function confirmStarter(state: ZilchGameState): ZilchGameState {
  if (state.phase === 'player-turn' && state.starterPlayerId && state.currentPlayerId) {
    return state;
  }
  if (state.phase !== 'randomising-starter' || !state.starterPlayerId) {
    throw new Error('Starter randomisation is not active');
  }
  return startTurn(state, state.starterPlayerId);
}

export function startTurn(state: ZilchGameState, playerId: string): ZilchGameState {
  const phase =
    state.phase === 'final-round' ? 'final-round' : 'player-turn';
  return {
    ...state,
    phase,
    currentPlayerId: playerId,
    turnScore: 0,
    dice: [],
    keptDice: [],
    availableCombinations: [],
    rollNumberInTurn: 0,
    keptThisRoll: false,
    lastZilchPlayerId: null,
    diceAnimation: { isRolling: false },
    history: appendEvent(state, 'turn-started', playerId),
  };
}

export function rollDice(
  state: ZilchGameState,
  settings: ZilchGameSettings,
  rng: () => number = Math.random,
  now: number = Date.now(),
): ZilchGameState {
  if (state.phase !== 'player-turn') {
    throw new Error('Cannot roll in the current phase');
  }
  if (state.diceAnimation.isRolling) {
    throw new Error('Dice are already rolling');
  }

  const unkept = state.dice.filter((d) => !d.isKept);
  const count = unkept.length > 0 ? unkept.length : 6;
  const nextDice =
    unkept.length > 0
      ? state.dice
      : freshDice(6);

  const values = Array.from({ length: count }, () => rollDieValue(rng));
  const durationMs = resolveDiceAnimationDurationMs(settings.diceAnimation, rng);

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
    history: appendEvent(state, 'roll-started', state.currentPlayerId ?? undefined, {
      count,
    }),
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
    return resolveZilch({
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
    history: appendEvent(state, 'roll-completed', state.currentPlayerId ?? undefined, {
      scoring: true,
    }),
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

/** @alias holdScoringDice */
export function keepCombination(
  state: ZilchGameState,
  combinationId: string,
): ZilchGameState {
  return holdScoringDice(state, combinationId);
}

export function holdScoringDice(
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
      ? { ...d, isKept: true, isAvailable: false, keptGroupId: groupId, held: true, scoring: true }
      : d,
  );

  const remainingAvailable = nextDice.filter((d) => d.isAvailable && !d.isKept);
  const nextCombinations = detectZilchCombinations(nextDice).filter((c) =>
    combinationDiceAvailable({ ...state, dice: nextDice }, c),
  );

  const hotDice = remainingAvailable.length === 0;
  let phase: ZilchGameState['phase'] = 'player-turn';
  let diceAfter = nextDice;
  let keptAfter = [...state.keptDice, keptGroup];

  if (hotDice) {
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
    availableCombinations: hotDice ? [] : nextCombinations,
    keptThisRoll: true,
    history: appendEvent(state, hotDice ? 'hot-dice' : 'dice-held', state.currentPlayerId ?? undefined, {
      score: combo.score,
      label: combo.label,
    }),
  };
}

export function toggleHoldDie(state: ZilchGameState, dieId: string): ZilchGameState {
  if (state.phase !== 'awaiting-keep-selection') {
    return state;
  }
  return {
    ...state,
    dice: state.dice.map((d) =>
      d.id === dieId && !d.isKept ? { ...d, held: !d.held } : d,
    ),
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
      history: appendEvent(state, 'turn-banked', playerId, {
        banked: state.turnScore,
      }),
    },
    playerId,
  );

  if (next.mode === 'target_points' && !next.finalRoundStartedByPlayerId) {
    const total = totalScoresByPlayerId[playerId] ?? 0;
    const target = next.targetPoints ?? 0;
    if (total >= target) {
      const remaining = next.players
        .map((p) => p.playerId)
        .filter((id) => id !== playerId);
      if (remaining.length === 0) {
        return {
          ...next,
          phase: 'completed',
          winnerPlayerId: getZilchWinnerId(next),
          currentPlayerId: null,
          history: appendEvent(next, 'game-completed', playerId),
        };
      }
      const first = remaining[0]!;
      return startTurn(
        {
          ...next,
          phase: 'final-round',
          finalRoundStartedByPlayerId: playerId,
          playersRemainingFinalTurn: remaining,
          history: appendEvent(next, 'final-round-started', playerId),
        },
        first,
      );
    }
  }

  if (next.mode === 'fixed_rounds' && allPlayersReachedRoundLimit(next)) {
    return {
      ...next,
      phase: 'completed',
      winnerPlayerId: getZilchWinnerId(next),
      currentPlayerId: null,
      history: appendEvent(next, 'game-completed', playerId),
    };
  }

  return passTurn(next);
}

/** @alias bankTurn when player ends turn with points */
export function passTurn(state: ZilchGameState): ZilchGameState {
  return advanceToNextPlayer(state);
}

export function endTurnWithZilch(state: ZilchGameState): ZilchGameState {
  return resolveZilch(state);
}

export function resolveZilch(state: ZilchGameState): ZilchGameState {
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
      history: appendEvent(state, 'zilch', playerId),
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
      winnerPlayerId: getZilchWinnerId(next),
      currentPlayerId: null,
      history: appendEvent(next, 'game-completed', playerId),
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
        winnerPlayerId: getZilchWinnerId(state),
        currentPlayerId: null,
        history: appendEvent(state, 'game-completed', currentId),
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

function allPlayersReachedRoundLimit(state: ZilchGameState): boolean {
  const limit = state.roundLimit ?? 0;
  return state.players.every((p) => p.roundsPlayed >= limit);
}

/** Bank current turn score without rolling remaining dice (Greater Glory quit). */
export function quitTurn(state: ZilchGameState): ZilchGameState {
  return bankTurn(state);
}

export {
  canBank,
  canKeepCombination,
  canPassTurn,
  canRollDice,
  checkZilchGameEnd,
  getZilchWinnerId,
} from './zilchSelectors';
