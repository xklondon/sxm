import { createEmptySession } from '../../types/session';
import { createPlayer } from '../../types/player';
import { createEmptyLedger } from '../../types/ledger';
import { createDefaultTableMeta } from '../../types/table';
import { generateId } from '../utils/id';
import { DEFAULT_BLACKJACK_SETTINGS } from '../blackjack/settings';
import { DEFAULT_HOLDEM_SETTINGS } from '../holdem/settings';
import { DEFAULT_BLACKJACK_FLOW_SETTINGS } from '../blackjack/flowSettings';
import { DEFAULT_BLACKJACK_PROTOCOL_ID } from '../blackjack/protocols';
import { DEFAULT_DESIGN_TEMPLATE_ID } from '../../design/templates';
import { DEFAULT_TABLE_ADMIN_SETTINGS } from '../../types/admin';
import { DEFAULT_ZILCH_SETTINGS } from '../zilch/settings';
import { allocateChipsToBankrollOwner } from './allocation';
export function createGameSession(gameType, options) {
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
        zilch: null,
        blackjackSettings: { ...DEFAULT_BLACKJACK_SETTINGS },
        holdemSettings: { ...DEFAULT_HOLDEM_SETTINGS },
        zilchSettings: { ...DEFAULT_ZILCH_SETTINGS },
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
export function addPlayer(session, players, ledger, playerInput) {
    const id = playerInput.id ?? generateId();
    const trimmed = playerInput.displayName.trim();
    if (!trimmed) {
        throw new Error('Player name is required');
    }
    const player = createPlayer(id, trimmed, 'real', playerInput.startingChips ?? 0, undefined, playerInput.controllerName, playerInput.role ?? 'person', playerInput.bankrollOwnerId);
    return {
        session: {
            ...session,
            playerIds: [...session.playerIds, id],
        },
        players: { ...players, [id]: player },
        ledger,
    };
}
export function addVirtualPlayer(session, players, ledger, options) {
    const id = options?.id ?? generateId();
    const style = options?.virtualStyle ?? 'normal';
    const existingVirtualCount = Object.values(players).filter((p) => p.playerType === 'virtual').length;
    const displayName = options?.displayName?.trim() ||
        `Virtual Player ${existingVirtualCount + 1}`;
    const player = createPlayer(id, displayName, 'virtual', options?.startingChips ?? 0, style);
    return {
        session: {
            ...session,
            playerIds: [...session.playerIds, id],
        },
        players: { ...players, [id]: player },
        ledger,
    };
}
export function removePlayer(session, players, ledger, playerId) {
    if (!session.playerIds.includes(playerId)) {
        throw new Error(`Player ${playerId} not in session`);
    }
    const remainingPlayers = { ...players };
    delete remainingPlayers[playerId];
    let nextSession = {
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
export function assignBankOrDealer(session, playerId) {
    if (!session.playerIds.includes(playerId)) {
        throw new Error(`Player ${playerId} not in session`);
    }
    if (session.gameType === 'texas-holdem') {
        return { ...session, dealerButtonPlayerId: playerId };
    }
    return { ...session, bankPlayerId: playerId };
}
/** @deprecated Prefer allocateChipsToBankrollOwner on full GameState. */
export function setStartingChips(state, playerId, amount) {
    if (!state.session.playerIds.includes(playerId)) {
        throw new Error(`Player ${playerId} not in session`);
    }
    if (amount <= 0) {
        return state;
    }
    const player = state.players[playerId];
    const reason = player?.role === 'bank' || playerId === state.session.bankPlayerId
        ? 'initial-bank'
        : 'initial-player';
    return allocateChipsToBankrollOwner(state, {
        bankrollOwnerId: playerId,
        amount,
        reason,
        source: 'setup',
    });
}
export function startGame(session) {
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
    if (session.gameType === 'zilch') {
        return {
            ...session,
            status: 'active',
            currentRound: 1,
        };
    }
    return {
        ...session,
        status: 'active',
        currentRound: 1,
    };
}
export function mergeSessionUpdate(state, update) {
    return {
        ...state,
        session: update.session,
        players: update.players,
        ledger: update.ledger,
    };
}
