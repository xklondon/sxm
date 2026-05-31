import type { GameSession, GameType } from '../../types/session';
import { createEmptySession } from '../../types/session';
import type { Player, VirtualPlayerStyle } from '../../types/player';
import { createPlayer } from '../../types/player';
import type { Ledger } from '../../types/ledger';
import { createEmptyLedger } from '../../types/ledger';
import type { GameState } from '../../types';
import { createDefaultTableMeta } from '../../types/table';
import { generateId } from '../utils/id';
import { DEFAULT_BLACKJACK_SETTINGS } from '../blackjack/settings';
import { DEFAULT_HOLDEM_SETTINGS } from '../holdem/settings';
import { DEFAULT_BLACKJACK_FLOW_SETTINGS } from '../blackjack/flowSettings';
import { DEFAULT_BLACKJACK_PROTOCOL_ID } from '../blackjack/protocols';
import { DEFAULT_DESIGN_TEMPLATE_ID } from '../../design/templates';
import { DEFAULT_TABLE_ADMIN_SETTINGS } from '../../types/admin';
import { allocateChipsToBankrollOwner } from './allocation';

export interface CreateGameSessionOptions {
  sessionId?: string;
}

export interface AddPlayerInput {
  id?: string;
  displayName: string;
  controllerName?: string;
  startingChips?: number;
  role?: import('../../types/player').PlayerRole;
  bankrollOwnerId?: string;
}

export interface AddVirtualPlayerOptions {
  id?: string;
  displayName?: string;
  virtualStyle?: VirtualPlayerStyle;
  startingChips?: number;
}

export interface SessionPlayersLedger {
  session: GameSession;
  players: Record<string, Player>;
  ledger: Ledger;
}

export function createGameSession(
  gameType: GameType,
  options?: CreateGameSessionOptions,
): GameState {
  const id = options?.sessionId ?? generateId();
  return {
    session: {
      ...createEmptySession(id),
      gameType,
      status: 'setup',
    },
    players: {},
    deck: null,
    ledger: createEmptyLedger(id),
    blackjack: null,
    holdem: null,
    blackjackSettings: { ...DEFAULT_BLACKJACK_SETTINGS },
    holdemSettings: { ...DEFAULT_HOLDEM_SETTINGS },
    tableGame: null,
    tableViewMode: 'full',
    selectedSeatId: null,
    tableMeta: createDefaultTableMeta(),
    blackjackFlowSettings: { ...DEFAULT_BLACKJACK_FLOW_SETTINGS },
    blackjackProtocolId: DEFAULT_BLACKJACK_PROTOCOL_ID,
    tableAdminSettings: { ...DEFAULT_TABLE_ADMIN_SETTINGS },
    designTemplateId: DEFAULT_DESIGN_TEMPLATE_ID,
  };
}

export function addPlayer(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  playerInput: AddPlayerInput,
): SessionPlayersLedger {
  const id = playerInput.id ?? generateId();
  const trimmed = playerInput.displayName.trim();
  if (!trimmed) {
    throw new Error('Player name is required');
  }

  const player = createPlayer(
    id,
    trimmed,
    'real',
    playerInput.startingChips ?? 0,
    undefined,
    playerInput.controllerName,
    playerInput.role ?? 'person',
    playerInput.bankrollOwnerId,
  );

  return {
    session: {
      ...session,
      playerIds: [...session.playerIds, id],
    },
    players: { ...players, [id]: player },
    ledger,
  };
}

export function addVirtualPlayer(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  options?: AddVirtualPlayerOptions,
): SessionPlayersLedger {
  const id = options?.id ?? generateId();
  const style = options?.virtualStyle ?? 'normal';
  const existingVirtualCount = Object.values(players).filter(
    (p) => p.playerType === 'virtual',
  ).length;
  const displayName =
    options?.displayName?.trim() ||
    `Virtual Player ${existingVirtualCount + 1}`;

  const player = createPlayer(
    id,
    displayName,
    'virtual',
    options?.startingChips ?? 0,
    style,
  );

  return {
    session: {
      ...session,
      playerIds: [...session.playerIds, id],
    },
    players: { ...players, [id]: player },
    ledger,
  };
}

export function removePlayer(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  playerId: string,
): SessionPlayersLedger {
  if (!session.playerIds.includes(playerId)) {
    throw new Error(`Player ${playerId} not in session`);
  }

  const remainingPlayers = { ...players };
  delete remainingPlayers[playerId];

  let nextSession: GameSession = {
    ...session,
    playerIds: session.playerIds.filter((id) => id !== playerId),
  };

  if (nextSession.bankPlayerId === playerId) {
    nextSession = { ...nextSession, bankPlayerId: null };
  }
  if (nextSession.dealerButtonPlayerId === playerId) {
    nextSession = { ...nextSession, dealerButtonPlayerId: null };
  }

  return {
    session: nextSession,
    players: remainingPlayers,
    ledger,
  };
}

export function assignBankOrDealer(
  session: GameSession,
  playerId: string,
): GameSession {
  if (!session.playerIds.includes(playerId)) {
    throw new Error(`Player ${playerId} not in session`);
  }

  if (session.gameType === 'texas-holdem') {
    return { ...session, dealerButtonPlayerId: playerId };
  }

  return { ...session, bankPlayerId: playerId };
}

/** @deprecated Prefer allocateChipsToBankrollOwner on full GameState. */
export function setStartingChips(
  state: GameState,
  playerId: string,
  amount: number,
): GameState {
  if (!state.session.playerIds.includes(playerId)) {
    throw new Error(`Player ${playerId} not in session`);
  }
  if (amount <= 0) {
    return state;
  }

  const player = state.players[playerId];
  const reason =
    player?.role === 'bank' || playerId === state.session.bankPlayerId
      ? 'initial-bank'
      : 'initial-player';

  return allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: playerId,
    amount,
    reason,
    source: 'setup',
  });
}

export function startGame(session: GameSession): GameSession {
  if (session.playerIds.length === 0) {
    throw new Error('At least one player is required');
  }
  if (!session.gameType) {
    throw new Error('Game type is required');
  }

  const needsBank = session.gameType === 'blackjack';
  const needsDealer = session.gameType === 'texas-holdem';

  if (needsBank && !session.bankPlayerId) {
    throw new Error('Bank must be assigned before starting');
  }
  if (needsDealer && !session.dealerButtonPlayerId) {
    throw new Error('Dealer button must be assigned before starting');
  }

  return {
    ...session,
    status: 'active',
    currentRound: 1,
  };
}

export function mergeSessionUpdate(
  state: GameState,
  update: SessionPlayersLedger,
): GameState {
  return {
    ...state,
    session: update.session,
    players: update.players,
    ledger: update.ledger,
  };
}
