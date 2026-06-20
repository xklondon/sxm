import type { ZilchGameState } from './zilchTypes';
import { findCombinationForExactDiceIds } from './zilchRules';

export function getZilchWinnerId(state: ZilchGameState): string | null {
  if (state.winnerPlayerId) {
    return state.winnerPlayerId;
  }
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
      winnerPlayerId: getZilchWinnerId(state),
    };
  }

  return state;
}

export function canRollDice(state: ZilchGameState): boolean {
  if (state.diceAnimation.isRolling) {
    return false;
  }
  if (state.phase !== 'player-turn') {
    return false;
  }
  return true;
}

export function mustKeepBeforeRoll(state: ZilchGameState): boolean {
  return state.phase === 'awaiting-keep-selection';
}

export function isTurnoverRoll(state: ZilchGameState): boolean {
  return (
    state.phase === 'player-turn' &&
    state.dice.length === 0 &&
    state.turnScore > 0 &&
    state.rollNumberInTurn > 0
  );
}

export function findCombinationForSelection(
  state: ZilchGameState,
  selectedDiceIds: string[],
): ReturnType<typeof findCombinationForExactDiceIds> {
  return findCombinationForExactDiceIds(state.availableCombinations, selectedDiceIds);
}

export function canKeepSelectedDice(state: ZilchGameState, selectedDiceIds: string[]): boolean {
  if (!canKeepCombination(state)) {
    return false;
  }
  return Boolean(findCombinationForSelection(state, selectedDiceIds));
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
  if (state.availableCombinations.length === 0) {
    return false;
  }
  return (
    state.phase === 'awaiting-keep-selection' ||
    (state.phase === 'player-turn' && state.keptThisRoll)
  );
}

export function canPassTurn(state: ZilchGameState): boolean {
  return canBank(state);
}

export function activePlayerName(state: ZilchGameState, names: Record<string, string>): string {
  const id = state.currentPlayerId;
  if (!id) {
    return '—';
  }
  return names[id] ?? id;
}

export function commandStatusForPhase(
  state: ZilchGameState,
  names: Record<string, string>,
  canAct: boolean,
): string {
  switch (state.phase) {
    case 'setup':
      return 'Randomise who starts.';
    case 'randomising-starter':
      return 'Starting…';
    case 'final-round':
      return 'Final round — each other player gets one last turn.';
    case 'completed': {
      const w = getZilchWinnerId(state);
      const name = w ? names[w] ?? 'Winner' : '—';
      return `Game over — ${name} wins!`;
    }
    case 'zilch':
      return 'ZILCH — turn score lost.';
    case 'awaiting-keep-selection':
      return 'Select scoring dice to keep.';
    default:
      if (!canAct) {
        return 'Waiting for another player…';
      }
      if (isTurnoverRoll(state)) {
        return 'Turnover — Greater Glory: roll all 6 dice.';
      }
      if (state.keptThisRoll && state.turnScore > 0) {
        return 'Keep selected dice or bank points.';
      }
      if (state.dice.some((d) => !d.isKept) && state.rollNumberInTurn > 0) {
        return 'Roll remaining dice.';
      }
      if (state.turnScore > 0) {
        return `${activePlayerName(state, names)} — ${state.turnScore} this turn. Bank or roll.`;
      }
      return `${activePlayerName(state, names)} rolls.`;
  }
}
