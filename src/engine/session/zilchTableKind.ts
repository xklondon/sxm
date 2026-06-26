import type { GameState } from '../../types';
import type { ZilchGameState } from '../dice/zilch/zilchTypes';
import { normalizeZilchState } from '../dice/zilch/normalizeZilchState';
import { pruneHoldemSessionForPlay } from '../holdem/holdemPlayableSeats';

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
  let next = normalizeZilchState(zilch);
  if (next.diceAnimation?.isRolling && !next.currentPlayerId) {
    next = { ...next, diceAnimation: { isRolling: false } };
  }
  return next;
}

/** True when this table session is a dice Zilch game (authoritative game type first). */
export function isZilchTable(state: GameState): boolean {
  if (state.tableGame === 'blackjack') {
    return false;
  }
  if (state.tableGame === 'zilch') {
    return true;
  }
  if (state.session.gameType === 'blackjack') {
    return false;
  }
  if (state.session.gameType === 'zilch') {
    return true;
  }
  return state.tableMeta.diceGame === 'zilch' || state.tableMeta.gameCategory === 'dice';
}

/** Align tableGame, session.gameType, and table meta for blackjack tables. */
export function ensureBlackjackTableIdentity(state: GameState): GameState {
  if (isZilchTable(state)) {
    return state;
  }
  return {
    ...state,
    tableGame: 'blackjack',
    session: {
      ...state.session,
      gameType: 'blackjack',
    },
    tableMeta: {
      ...state.tableMeta,
      gameCategory: 'cards',
      cardGame: 'blackjack',
      diceGame: undefined,
    },
    zilch: null,
  };
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
      cardGame: undefined,
    },
    blackjack: null,
  };
}

function hasHoldemTableIdentity(state: GameState): boolean {
  return (
    state.tableGame === 'texas-holdem' ||
    state.session.gameType === 'texas-holdem' ||
    state.tableMeta.cardGame === 'holdem' ||
    state.tableMeta.pokerConfig != null
  );
}

export function isHoldemTable(state: GameState): boolean {
  if (isZilchTable(state)) {
    return false;
  }
  return hasHoldemTableIdentity(state);
}

export function isBlackjackTable(state: GameState): boolean {
  if (isZilchTable(state) || isHoldemTable(state)) {
    return false;
  }
  if (state.tableGame === 'blackjack') {
    return true;
  }
  return state.session.gameType === 'blackjack';
}

/** Align tableGame, session.gameType, and table meta for Hold'em poker tables. */
export function ensureHoldemTableIdentity(state: GameState): GameState {
  if (!isHoldemTable(state)) {
    return state;
  }
  return {
    ...state,
    tableGame: 'texas-holdem',
    session: {
      ...state.session,
      gameType: 'texas-holdem',
    },
    tableMeta: {
      ...state.tableMeta,
      gameCategory: 'cards',
      cardGame: 'holdem',
      diceGame: undefined,
    },
    blackjack: null,
    zilch: null,
  };
}

/** Normalize loaded/saved/hydrated state before render. */
export function normalizeLoadedGameState(state: GameState): GameState {
  if (isHoldemTable(state)) {
    let next = ensureHoldemTableIdentity(state);
    if (next.tableMeta.pokerConfig?.mode === 'challenge') {
      next = pruneHoldemSessionForPlay(next);
    }
    return next;
  }
  if (state.tableGame === 'blackjack') {
    return ensureBlackjackTableIdentity(state);
  }
  if (!isZilchTable(state)) {
    return state;
  }
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
