import type { GameState } from '../../types';
import type { ZilchGameState } from '../dice/zilch/zilchTypes';

export function repairStuckRandomisingStarter(zilch: ZilchGameState): ZilchGameState {
  if (zilch.phase !== 'randomising-starter' || !zilch.starterPlayerId) {
    return zilch;
  }
  const playerId = zilch.starterPlayerId;
  return {
    ...zilch,
    phase: 'player-turn',
    currentPlayerId: playerId,
    turnScore: 0,
    dice: [],
    keptDice: [],
    availableCombinations: [],
    rollNumberInTurn: 0,
    keptThisRoll: false,
    diceAnimation: { isRolling: false },
  };
}

function normalizeLoadedZilch(zilch: ZilchGameState): ZilchGameState {
  let next = repairStuckRandomisingStarter(zilch);
  if (!next.history) {
    next = { ...next, history: [] };
  }
  if (!next.protocolId) {
    next = { ...next, protocolId: 'zilch' };
  }
  if (!next.gameId) {
    next = { ...next, gameId: `legacy-${Date.now()}` };
  }
  if (!next.tableMode) {
    next = { ...next, tableMode: 'practice' };
  }
  if (next.diceAnimation?.isRolling && !next.currentPlayerId) {
    next = { ...next, diceAnimation: { isRolling: false } };
  }
  return next;
}

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
  const zilch = withIdentity.zilch;
  if (!zilch) {
    return withIdentity;
  }
  return {
    ...withIdentity,
    zilch: normalizeLoadedZilch(zilch),
  };
}
