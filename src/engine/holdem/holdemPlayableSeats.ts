import type { GameState } from '../../types';

/** True when a seat should appear in the Hold'em UI and receive starting stacks. */
export function isHoldemPlayableSeat(state: GameState, seatId: string): boolean {
  const player = state.players[seatId];
  if (!player || !state.session.playerIds.includes(seatId)) {
    return false;
  }
  if (player.role === 'bank' || player.role === 'box') {
    return false;
  }
  const mode = state.tableMeta.pokerConfig?.mode;
  if (mode === 'challenge' && player.playerType === 'virtual') {
    return false;
  }
  return true;
}

/** Seat ids for poker table UI and chip funding — excludes bank/box; challenge excludes virtuals. */
export function listHoldemPlayableSeatIds(state: GameState): string[] {
  return state.session.playerIds.filter((seatId) => isHoldemPlayableSeat(state, seatId));
}

/** Drop bank/box and (in challenge) virtual seats from the active Hold'em session order. */
export function pruneHoldemSessionForPlay(state: GameState): GameState {
  const playableIds = listHoldemPlayableSeatIds(state);
  if (playableIds.length === state.session.playerIds.length) {
    return state;
  }
  return {
    ...state,
    session: {
      ...state.session,
      playerIds: playableIds,
    },
  };
}
