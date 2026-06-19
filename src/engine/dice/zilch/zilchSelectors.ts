import type { ZilchGameState } from './zilchTypes';

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
      return 'Zilch — turn passes.';
    case 'awaiting-keep-selection':
      return 'Hold scoring dice or bank.';
    default:
      if (!canAct) {
        return 'Waiting for another player…';
      }
      if (state.turnScore > 0) {
        return `${activePlayerName(state, names)} — hold scoring dice or bank (${state.turnScore} this turn).`;
      }
      return `${activePlayerName(state, names)} rolls.`;
  }
}
