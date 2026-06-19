import type { ZilchGameSettings, ZilchGameState, ZilchHistoryEvent, ZilchTableMode } from './zilchTypes';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function appendEvent(
  state: ZilchGameState,
  type: string,
  playerId?: string,
  payload?: Record<string, unknown>,
): ZilchHistoryEvent[] {
  return [
    ...state.history,
    {
      id: generateId(),
      at: Date.now(),
      type,
      playerId,
      payload,
    },
  ];
}

export function createZilchGame(
  playerIds: string[],
  settings: ZilchGameSettings,
  options: {
    tableMode?: ZilchTableMode;
    gameId?: string;
    wagerMetadata?: Record<string, unknown>;
  } = {},
): ZilchGameState {
  return createInitialZilchState(playerIds, settings, options);
}

/** @alias createZilchGame */
export function createInitialZilchState(
  playerIds: string[],
  settings: ZilchGameSettings,
  options: {
    tableMode?: ZilchTableMode;
    gameId?: string;
    wagerMetadata?: Record<string, unknown>;
  } = {},
): ZilchGameState {
  const totals: Record<string, number> = {};
  for (const id of playerIds) {
    totals[id] = 0;
  }
  return {
    protocolId: 'zilch',
    gameId: options.gameId ?? generateId(),
    tableMode: options.tableMode ?? 'practice',
    mode: settings.mode,
    targetPoints: settings.mode === 'target_points' ? settings.targetPoints : null,
    roundLimit: settings.mode === 'fixed_rounds' ? settings.roundLimit : null,
    phase: 'setup',
    players: playerIds.map((playerId) => ({ playerId, roundsPlayed: 0 })),
    currentPlayerId: null,
    starterPlayerId: null,
    currentRound: 1,
    dice: [],
    keptDice: [],
    availableCombinations: [],
    turnScore: 0,
    totalScoresByPlayerId: totals,
    rollNumberInTurn: 0,
    keptThisRoll: false,
    lastZilchPlayerId: null,
    finalRoundStartedByPlayerId: null,
    playersRemainingFinalTurn: null,
    winnerPlayerId: null,
    diceAnimation: { isRolling: false },
    history: [],
    wagerMetadata: options.wagerMetadata,
  };
}

export function startZilchGame(state: ZilchGameState, starterPlayerId: string): ZilchGameState {
  return {
    ...state,
    starterPlayerId,
    currentPlayerId: starterPlayerId,
    phase: 'player-turn',
    history: appendEvent(state, 'game-started', starterPlayerId),
  };
}

export function resetTurn(state: ZilchGameState): ZilchGameState {
  return {
    ...state,
    turnScore: 0,
    dice: [],
    keptDice: [],
    availableCombinations: [],
    keptThisRoll: false,
    rollNumberInTurn: 0,
    diceAnimation: { isRolling: false },
    history: appendEvent(state, 'turn-reset', state.currentPlayerId ?? undefined),
  };
}

export { appendEvent, generateId };
