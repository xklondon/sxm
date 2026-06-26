import type { GameState } from '../../types';
import { shuffleGameDeck } from '../deck';
import {
  createHoldemRoundOnState,
  startHoldemHandOnState,
  newHoldemRoundOnState,
  checkHoldemOnState,
  callHoldemOnState,
  foldHoldemOnState,
  betHoldemOnState,
  raiseHoldemOnState,
  allInHoldemOnState,
} from './gameState';
import {
  rotatePokerDealerOnState,
} from '../session/holdemTableSetup';
import { ensureHoldemChallengeParticipantSnapshot } from './challengeParticipants';
import type { HoldemAction } from './holdemActions';
import { getHoldemActingSeatId } from './holdemSelectors';
import { validateHoldemStartHand } from './holdemStartValidation';

export type HoldemActionApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; error: string };

const UNSUPPORTED_PHASE_A: HoldemAction['type'][] = [
  'advance-street',
  'complete-hand',
];

function success(state: GameState): HoldemActionApplyResult {
  return { ok: true, state };
}

function failure(state: GameState, error: string): HoldemActionApplyResult {
  return { ok: false, state, error };
}

function requireHoldemGame(state: GameState): HoldemActionApplyResult | null {
  if (state.session.gameType !== 'texas-holdem') {
    return failure(state, 'Not a Texas Hold\'em game');
  }
  return null;
}

/** Sync pokerConfig dealer into session before round creation (Phase A partial unification). */
function withDealerFromPokerConfig(state: GameState): GameState {
  const dealerSeatId = state.tableMeta.pokerConfig?.dealerSeatId;
  if (!dealerSeatId) {
    return state;
  }
  return {
    ...state,
    session: {
      ...state.session,
      dealerButtonPlayerId: dealerSeatId,
    },
  };
}

function resolveActorSeatId(state: GameState, action: HoldemAction): string | null {
  return (
    action.actorSeatId ??
    action.requestedByPlayerId ??
    getHoldemActingSeatId(state)
  );
}

function assertActingPlayer(
  state: GameState,
  action: HoldemAction,
): HoldemActionApplyResult | null {
  const actorId = resolveActorSeatId(state, action);
  const activeId = getHoldemActingSeatId(state);
  if (!activeId) {
    return failure(state, 'No active Hold\'em action');
  }
  if (actorId && actorId !== activeId) {
    return failure(state, 'Not this player\'s turn');
  }
  return null;
}

function applyStartHand(state: GameState): HoldemActionApplyResult {
  const gameError = requireHoldemGame(state);
  if (gameError) {
    return gameError;
  }

  try {
    if (!state.deck) {
      return failure(state, 'Shuffle the deck before starting Hold\'em');
    }

    let next = withDealerFromPokerConfig(state);

    if (next.holdem && next.holdem.status !== 'setup' && next.holdem.status !== 'resolved') {
      return failure(state, 'Hand already in progress');
    }

    const startError = validateHoldemStartHand(next);
    if (startError) {
      return failure(state, startError);
    }

    if (next.holdem?.status === 'resolved') {
      next = rotatePokerDealerOnState(newHoldemRoundOnState(next));
      next = withDealerFromPokerConfig(next);
    }

    if (!next.holdem || next.holdem.status === 'resolved') {
      next = createHoldemRoundOnState(next);
    }

    next = startHoldemHandOnState(next);
    if (next.holdem?.status === 'preflop') {
      next = ensureHoldemChallengeParticipantSnapshot(next);
    }
    return success(next);
  } catch (err) {
    return failure(state, err instanceof Error ? err.message : 'Start hand failed');
  }
}

function applyPlayerAction(
  state: GameState,
  action: HoldemAction,
  mutate: (s: GameState) => GameState,
): HoldemActionApplyResult {
  const gameError = requireHoldemGame(state);
  if (gameError) {
    return gameError;
  }

  const turnError = assertActingPlayer(state, action);
  if (turnError) {
    return turnError;
  }

  try {
    return success(mutate(state));
  } catch (err) {
    return failure(state, err instanceof Error ? err.message : 'Action failed');
  }
}

/**
 * Canonical Hold'em gameplay mutation entry point (Phase A strangler).
 * Delegates to existing `*OnState` helpers; preserves current behavior.
 */
export function applyHoldemActionToState(
  state: GameState,
  action: HoldemAction,
): HoldemActionApplyResult {
  if (UNSUPPORTED_PHASE_A.includes(action.type)) {
    return failure(state, `Hold'em action "${action.type}" is not supported yet`);
  }

  switch (action.type) {
    case 'start-hand':
      return applyStartHand(state);
    case 'check':
      return applyPlayerAction(state, action, checkHoldemOnState);
    case 'call':
      return applyPlayerAction(state, action, callHoldemOnState);
    case 'fold':
      return applyPlayerAction(state, action, foldHoldemOnState);
    case 'bet': {
      const amount = action.amount ?? 0;
      if (amount <= 0) {
        return failure(state, 'Bet amount must be positive');
      }
      return applyPlayerAction(state, action, (s) => betHoldemOnState(s, amount));
    }
    case 'raise': {
      const amount = action.amount ?? 0;
      if (amount <= 0) {
        return failure(state, 'Raise amount must be positive');
      }
      return applyPlayerAction(state, action, (s) => raiseHoldemOnState(s, amount));
    }
    case 'all-in':
      return applyPlayerAction(state, action, allInHoldemOnState);
    default:
      return failure(state, `Unknown Hold'em action: ${action.type}`);
  }
}

/** Convenience helper when callers prefer throw-on-error (matches legacy *OnState style). */
export function applyHoldemActionToStateOrThrow(
  state: GameState,
  action: HoldemAction,
): GameState {
  const result = applyHoldemActionToState(state, action);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.state;
}

/** Shuffle deck — table prep before `start-hand` (not a betting action). */
export function shuffleHoldemDeckOnState(state: GameState): HoldemActionApplyResult {
  const gameError = requireHoldemGame(state);
  if (gameError) {
    return gameError;
  }
  try {
    return success(shuffleGameDeck(state));
  } catch (err) {
    return failure(state, err instanceof Error ? err.message : 'Shuffle failed');
  }
}
