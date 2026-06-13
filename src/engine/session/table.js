import { createEmptyLedger } from '../../types/ledger';
import { createEmptySession } from '../../types/session';
import { createDefaultTableMeta } from '../../types/table';
import { addPlayer, mergeSessionUpdate, removePlayer, } from './session';
import { log } from '../../utils/logger';
import { getStartingChipsBank, getStartingChipsEachSeat, logSetupValues, logTableMetaStartingChips, } from './tokens';
import { allocateChipsToBankrollOwner } from './allocation';
import { listPersonBankrollOwnerIds } from './bankroll';
import { personsShareOneChipPot } from './sharedBankroll';
import { appendLedgerEntry, derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { generateId } from '../utils/id';
import { DEFAULT_BLACKJACK_SETTINGS } from '../blackjack/settings';
import { DEFAULT_HOLDEM_SETTINGS } from '../holdem/settings';
import { DEFAULT_BLACKJACK_FLOW_SETTINGS } from '../blackjack/flowSettings';
import { DEFAULT_BLACKJACK_PROTOCOL_ID } from '../blackjack/protocols';
import { DEFAULT_DESIGN_TEMPLATE_ID } from '../../design/templates';
import { DEFAULT_TABLE_ADMIN_SETTINGS } from '../../types/admin';
import { DEFAULT_ZILCH_SETTINGS } from '../zilch/settings';
const DEFAULT_TABLE_CHIPS = 500;
/** Open a new Blackjack table — bank + empty box slots only. */
export function createNewBlackjackTable() {
    const id = generateId();
    const state = {
        session: {
            ...createEmptySession(id),
            gameType: 'blackjack',
            status: 'active',
            currentRound: 1,
            boxSlotNumbers: {},
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
        tableGame: 'blackjack',
        tableViewMode: 'full',
        selectedSeatId: null,
        tableMeta: createDefaultTableMeta(),
        blackjackFlowSettings: { ...DEFAULT_BLACKJACK_FLOW_SETTINGS },
        blackjackProtocolId: DEFAULT_BLACKJACK_PROTOCOL_ID,
        tableAdminSettings: { ...DEFAULT_TABLE_ADMIN_SETTINGS },
        designTemplateId: DEFAULT_DESIGN_TEMPLATE_ID,
    };
    log.info('Blackjack table created (empty boxes)', { sessionId: id });
    return state;
}
/** Open a new Zilch dice table — same session/ledger shell as cards. */
export function createNewZilchTable() {
    const id = generateId();
    const state = {
        session: {
            ...createEmptySession(id),
            gameType: 'zilch',
            status: 'active',
            currentRound: 1,
            boxSlotNumbers: {},
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
        tableGame: 'zilch',
        tableViewMode: 'full',
        selectedSeatId: null,
        tableMeta: {
            ...createDefaultTableMeta(),
            gameCategory: 'dice',
            diceGame: 'zilch',
        },
        blackjackFlowSettings: { ...DEFAULT_BLACKJACK_FLOW_SETTINGS },
        blackjackProtocolId: DEFAULT_BLACKJACK_PROTOCOL_ID,
        tableAdminSettings: { ...DEFAULT_TABLE_ADMIN_SETTINGS },
        designTemplateId: DEFAULT_DESIGN_TEMPLATE_ID,
    };
    log.info('Zilch table created', { sessionId: id });
    return state;
}
/** Fresh table ledger for the same seats — balances reset via canonical allocation. */
export function startNewTable(state) {
    const sessionId = state.session.id;
    const ledger = createEmptyLedger(sessionId);
    const session = {
        ...state.session,
        currentRound: 1,
        ledgerEntryIds: [],
        deckId: null,
        dealingStatus: 'no-deck',
        status: 'active',
    };
    let next = {
        ...state,
        session,
        ledger,
        deck: null,
        blackjack: null,
        holdem: null,
        zilch: null,
        tableMeta: {
            ...state.tableMeta,
            outcome: null,
            status: 'open',
        },
        selectedSeatId: state.selectedSeatId,
    };
    const bankId = next.session.bankPlayerId;
    if (bankId) {
        const bankChips = getStartingChipsBank(next);
        if (bankChips > 0) {
            next = allocateChipsToBankrollOwner(next, {
                bankrollOwnerId: bankId,
                amount: bankChips,
                reason: 'initial-bank',
                source: 'setup',
            });
        }
    }
    for (const personId of listPersonBankrollOwnerIds(next)) {
        const seatChips = getStartingChipsEachSeat(next);
        const bankIdForPot = next.session.bankPlayerId;
        if (bankIdForPot &&
            personsShareOneChipPot(next, personId, bankIdForPot) &&
            derivePlayerBalanceFromLedger(bankIdForPot, next.ledger) > 0) {
            continue;
        }
        if (seatChips > 0) {
            next = allocateChipsToBankrollOwner(next, {
                bankrollOwnerId: personId,
                amount: seatChips,
                reason: 'initial-player',
                source: 'setup',
            });
        }
    }
    return next;
}
export function confirmTableAgreement(state, stakeDescription, startingChipsEachSeat = DEFAULT_TABLE_CHIPS, startingChipsBank) {
    const bankChips = startingChipsBank ?? startingChipsEachSeat;
    const agreement = {
        stakeDescription: stakeDescription.trim() || 'Friendly game',
        defaultChips: startingChipsEachSeat,
        agreedAt: new Date().toISOString(),
    };
    logSetupValues(agreement.stakeDescription, startingChipsEachSeat, bankChips);
    log.info('Table setup confirmed', {
        stakeDescription: agreement.stakeDescription,
        startingChipsEachSeat,
        startingChipsBank: bankChips,
    });
    const next = {
        ...state,
        tableMeta: {
            ...state.tableMeta,
            agreement,
            startingChipsEachSeat,
            startingChipsBank: bankChips,
            minimumBet: state.tableMeta.minimumBet ?? 5,
            awaitingNextRound: false,
            showStakeSetup: false,
            showBankerSetup: true,
            bankerSetup: {
                ...state.tableMeta.bankerSetup,
                startBalance: bankChips,
            },
        },
    };
    log.info('tableMetaStartingChipsSaved', {
        context: 'confirmTableAgreement',
        startingChipsEachSeat,
        startingChipsBank: bankChips,
        agreementDefault: agreement.defaultChips,
    });
    logTableMetaStartingChips(next, 'confirmTableAgreement');
    return next;
}
export function recordTableOutcome(state, winnerId, loserId) {
    const stake = state.tableMeta.agreement?.stakeDescription ?? 'Agreed stake';
    const outcome = {
        winnerId,
        loserId,
        stakeDescription: stake,
        note: 'Carry to personal ledger later',
        recordedAt: new Date().toISOString(),
    };
    let session = state.session;
    let ledger = state.ledger;
    const winnerName = winnerId ? state.players[winnerId]?.displayName : '—';
    const loserName = loserId ? state.players[loserId]?.displayName : '—';
    const description = `Table outcome: ${winnerName} vs ${loserName} · ${stake} · ${outcome.note}`;
    const anchorId = winnerId ?? loserId ?? session.playerIds[0];
    if (anchorId) {
        const appended = appendLedgerEntry(session, ledger, {
            playerId: anchorId,
            entryType: 'table-outcome-recorded',
            amount: 0,
            description,
            roundNumber: session.currentRound,
        });
        session = appended.session;
        ledger = appended.ledger;
    }
    return {
        ...state,
        session,
        ledger,
        tableMeta: {
            ...state.tableMeta,
            outcome,
            status: 'complete',
        },
    };
}
export function switchGameType(state, gameType) {
    if (state.session.gameType === gameType && state.tableGame === gameType) {
        return state;
    }
    const session = {
        ...state.session,
        gameType,
        deckId: null,
        dealingStatus: 'no-deck',
        status: 'active',
    };
    return {
        ...state,
        session,
        deck: null,
        blackjack: null,
        holdem: null,
        zilch: null,
        tableGame: gameType,
    };
}
export function selectTableGame(state, gameType) {
    if (state.tableGame === gameType) {
        return state;
    }
    return switchGameType(state, gameType);
}
export function nextBoxDisplayName(state) {
    const used = new Set(Object.values(state.session.boxSlotNumbers ?? {}));
    for (let n = 1; n <= 7; n += 1) {
        if (!used.has(n)) {
            return `Box ${n}`;
        }
    }
    return 'Box';
}
export function addSeatAtTable(state, input) {
    return mergeSessionUpdate(state, addPlayer(state.session, state.players, state.ledger, input));
}
export function removeSeatFromTable(state, boxId) {
    if (boxId === state.session.bankPlayerId) {
        throw new Error('Cannot remove the dealer/bank seat');
    }
    const slotNum = state.session.boxSlotNumbers?.[boxId];
    const update = removePlayer(state.session, state.players, state.ledger, boxId);
    const restSlots = { ...state.session.boxSlotNumbers };
    delete restSlots[boxId];
    const boxSlots = slotNum !== undefined
        ? state.tableMeta.boxSlots.map((s) => s.slotNumber === slotNum ? { ...s, playerId: null, passiveNames: [] } : s)
        : state.tableMeta.boxSlots;
    const nextSelected = state.selectedSeatId === boxId ? null : state.selectedSeatId;
    return {
        ...mergeSessionUpdate(state, update),
        session: { ...update.session, boxSlotNumbers: restSlots },
        tableMeta: { ...state.tableMeta, boxSlots },
        selectedSeatId: nextSelected,
    };
}
export function defaultBlackjackSeatId(state) {
    const ordered = state.tableMeta.boxSlots
        .filter((s) => s.playerId)
        .sort((a, b) => a.slotNumber - b.slotNumber);
    return ordered[0]?.playerId ?? null;
}
export { DEFAULT_TABLE_CHIPS };
