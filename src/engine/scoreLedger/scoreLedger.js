import { generateId } from '../utils/id';
import { appendScoreLedgerEntry, loadScoreLedgerEntries } from '../../storage/scoreLedgerStorage';
import { getLedgerBalanceForBankrollOwner, listPersonBankrollOwnerIds, } from '../session/bankroll';
import { log } from '../../utils/logger';
/** True when the bank seat is a bot (virtual) — i.e. not a human-vs-human game. */
export function isBotBankGame(state) {
    const bankId = state.session.bankPlayerId;
    const bank = bankId ? state.players[bankId] : null;
    return bank?.playerType === 'virtual';
}
/** Personal (score) ledger only applies to human-vs-human games, not Bot Bank. */
export function canAddGameToPersonalLedger(state) {
    return state.tableMeta.gameStatus === 'ended' && !isBotBankGame(state);
}
function bankShortName(state, bankId) {
    const bank = state.players[bankId];
    if (!bank) {
        return 'Bank';
    }
    if (bank.playerType === 'virtual') {
        return bank.displayName.replace(/^Bank\s+/i, '').trim() || 'Bank Bot';
    }
    return bank.controllerName?.trim() || bank.displayName;
}
function personShortName(state, personId) {
    const person = state.players[personId];
    return person?.controllerName?.trim() || person?.displayName || 'Player';
}
/** Build wager-level game-over message and optional score ledger entry. */
export function buildGameOverSummary(state) {
    if (state.tableMeta.gameStatus !== 'ended') {
        return { message: '', entry: null };
    }
    const winnerId = state.tableMeta.winnerId;
    const bankId = state.session.bankPlayerId;
    const wager = state.tableMeta.agreement?.stakeDescription?.trim() || 'the agreed wager';
    const bankIsBust = Boolean(bankId && getLedgerBalanceForBankrollOwner(state, bankId) <= 0);
    if (!winnerId) {
        return { message: bankIsBust ? 'GAME OVER\nBank is bust.' : 'Game over.', entry: null };
    }
    const winnerIsBank = Boolean(bankId && winnerId === bankId);
    const winnerName = winnerIsBank
        ? bankShortName(state, bankId)
        : personShortName(state, winnerId);
    let loserId = null;
    let loserName = '—';
    if (winnerIsBank) {
        const persons = listPersonBankrollOwnerIds(state);
        const topPerson = persons[0];
        if (topPerson) {
            loserId = topPerson;
            loserName = personShortName(state, topPerson);
        }
        else if (state.tableMeta.ownerPersonId) {
            loserId = state.tableMeta.ownerPersonId;
            loserName = personShortName(state, loserId);
        }
    }
    else if (bankId) {
        loserId = bankId;
        loserName = bankShortName(state, bankId);
    }
    const owedDescription = `${loserName} owes ${winnerName}: ${wager}`;
    const message = bankIsBust
        ? 'GAME OVER\nBank is bust.'
        : `${winnerName} won!!\n${loserName} owes you: ${wager}`;
    const playersInvolved = [
        ...new Set([
            winnerName,
            loserName,
            ...listPersonBankrollOwnerIds(state).map((id) => personShortName(state, id)),
            bankId ? bankShortName(state, bankId) : null,
        ].filter(Boolean)),
    ];
    const entry = {
        id: generateId(),
        tableId: state.session.id,
        wagerDescription: wager,
        winnerPersonId: winnerIsBank ? null : winnerId,
        winnerName,
        loserPersonId: winnerIsBank ? loserId : null,
        loserName,
        owedDescription,
        playersInvolved,
        createdAt: state.tableMeta.endedAt ?? new Date().toISOString(),
        status: 'open',
    };
    return { message, entry };
}
export function recordScoreLedgerForGameEnd(state) {
    return addGameToPersonalLedger(state);
}
/** Add a fully completed game to the personal (score) ledger — idempotent per table session. */
export function addGameToPersonalLedger(state) {
    if (state.tableMeta.gameStatus !== 'ended') {
        throw new Error('Game must be fully completed before adding to personal ledger');
    }
    // Bot Bank games are solo practice — nothing to settle person-to-person.
    if (isBotBankGame(state)) {
        return null;
    }
    const { entry } = buildGameOverSummary(state);
    if (!entry) {
        return null;
    }
    const existing = loadScoreLedgerEntries().find((e) => e.tableId === entry.tableId && e.status !== 'cancelled');
    if (existing) {
        return existing;
    }
    appendScoreLedgerEntry(entry);
    log.info('scoreLedgerGameEndRecorded', { entryId: entry.id });
    return entry;
}
export function hasPersonalLedgerEntryForTable(tableId) {
    return loadScoreLedgerEntries().some((e) => e.tableId === tableId && e.status === 'open');
}
