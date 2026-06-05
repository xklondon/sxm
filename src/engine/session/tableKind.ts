import type { GameState } from '../../types';
import { normalizeZilchState } from '../zilch/normalizeZilchState';

/** True when this table session is a dice Zilch game (any authoritative marker). */
export function isZilchTable(state: GameState): boolean {
  return (
    state.tableGame === 'zilch' ||
    state.session.gameType === 'zilch' ||
    state.tableMeta.diceGame === 'zilch' ||
    state.tableMeta.gameCategory === 'dice'
  );
}

/** Align tableGame, session.gameType, and table meta for dice/Zilch tables. */
export function ensureZilchTableIdentity(state: GameState): GameState {
  if (!isZilchTable(state)) {
    return state;
  }
  return {
    ...state,
    tableGame: 'zilch',
    session: {
      ...state.session,
      gameType: 'zilch',
    },
    tableMeta: {
      ...state.tableMeta,
      gameCategory: 'dice',
      diceGame: 'zilch',
    },
    blackjack: null,
  };
}

export function isBlackjackTable(state: GameState): boolean {
  if (isZilchTable(state)) {
    return false;
  }
  return state.tableGame === 'blackjack' || state.session.gameType === 'blackjack';
}

export function isHoldemTable(state: GameState): boolean {
  if (isZilchTable(state)) {
    return false;
  }
  return state.tableGame === 'texas-holdem' || state.session.gameType === 'texas-holdem';
}

/** Normalize loaded/saved/hydrated state before render. */
export function normalizeLoadedGameState(state: GameState): GameState {
  const withIdentity = ensureZilchTableIdentity(state);
  if (!withIdentity.zilch) {
    return withIdentity;
  }
  return {
    ...withIdentity,
    zilch: normalizeZilchState(withIdentity.zilch),
  };
}
