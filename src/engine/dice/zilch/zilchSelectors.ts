import type { ZilchGameState } from './zilchTypes';
import {
  isValidKeep,
  resolveKeepForSelectedDice,
} from './zilchProtocol';

/** Phases where a seated player may roll, keep, or bank. */
export function isActiveZilchTurnPhase(state: ZilchGameState): boolean {
  return state.phase === 'player-turn' || state.phase === 'final-round';
}

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
  if (state.diceAnimation.isRolling || state.phase === 'zilch-reveal') {
    return false;
  }
  return isActiveZilchTurnPhase(state);
}

export function mustKeepBeforeRoll(state: ZilchGameState): boolean {
  return state.phase === 'awaiting-keep-selection';
}

export function isTurnoverRoll(state: ZilchGameState): boolean {
  return (
    isActiveZilchTurnPhase(state) &&
    state.dice.length === 0 &&
    state.turnScore > 0 &&
    state.rollNumberInTurn > 0
  );
}

export function findCombinationForSelection(
  state: ZilchGameState,
  selectedDiceIds: string[],
): ReturnType<typeof resolveKeepForSelectedDice> {
  return resolveKeepForSelectedDice(state.dice, selectedDiceIds);
}

export function canKeepSelectedDice(state: ZilchGameState, selectedDiceIds: string[]): boolean {
  if (!canKeepCombination(state)) {
    return false;
  }
  return isValidKeep(state.dice, selectedDiceIds);
}

export function canBank(state: ZilchGameState): boolean {
  if (
    state.phase === 'zilch' ||
    state.phase === 'zilch-reveal' ||
    state.phase === 'completed'
  ) {
    return false;
  }
  return (
    state.turnScore > 0 &&
    state.keptThisRoll &&
    (isActiveZilchTurnPhase(state) || state.phase === 'awaiting-keep-selection')
  );
}

export function canKeepCombination(state: ZilchGameState): boolean {
  if (state.availableCombinations.length === 0) {
    return false;
  }
  return (
    state.phase === 'awaiting-keep-selection' ||
    (isActiveZilchTurnPhase(state) && state.keptThisRoll)
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

export function canRollAvailableDice(state: ZilchGameState): boolean {
  if (!canRollDice(state) || mustKeepBeforeRoll(state) || state.diceAnimation.isRolling) {
    return false;
  }
  if (!state.keptThisRoll) {
    return false;
  }
  if (isTurnoverRoll(state)) {
    return true;
  }
  return state.dice.some((d) => !d.isKept);
}

export function canInitialRollAllDice(state: ZilchGameState): boolean {
  if (!canRollDice(state) || mustKeepBeforeRoll(state) || state.diceAnimation.isRolling) {
    return false;
  }
  if (isTurnoverRoll(state)) {
    return true;
  }
  return state.rollNumberInTurn === 0 && state.dice.length === 0;
}

export function canKeepAndRollSelected(
  state: ZilchGameState,
  selectedDiceIds: string[],
): boolean {
  return state.phase === 'awaiting-keep-selection' && canKeepSelectedDice(state, selectedDiceIds);
}

export function selectionHintForDice(
  _state: ZilchGameState,
  _selectedDiceIds: string[],
  _canSelect: boolean,
): string | null {
  return null;
}

export function zilchRevealSecondsRemaining(
  state: ZilchGameState,
  now: number = Date.now(),
): number {
  if (state.phase !== 'zilch-reveal' || !state.zilchRevealUntil) {
    return 0;
  }
  return Math.max(0, Math.ceil((state.zilchRevealUntil - now) / 1000));
}

export function commandStatusForPhase(
  state: ZilchGameState,
  names: Record<string, string>,
  canAct: boolean,
  options: { challengeNeedsOpponent?: boolean } = {},
): string | null {
  switch (state.phase) {
    case 'setup':
      return options.challengeNeedsOpponent
        ? 'Invite at least one player to start Challenge.'
        : 'Randomise who starts.';
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
    case 'zilch-reveal':
      return 'ZILCH — no scoring dice. Turn score lost.';
    case 'awaiting-keep-selection':
      return null;
    default:
      if (!canAct) {
        return null;
      }
      if (isTurnoverRoll(state)) {
        return 'Turnover — Greater Glory: roll all 6 dice.';
      }
      if (state.keptThisRoll && state.turnScore > 0) {
        return 'Keep and roll, roll available dice, or bank points.';
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
