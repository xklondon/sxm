import { resolveTableClothName } from '../../types/tableFeltSkin';
import { generateId } from '../utils/id';
import { appendScoreLedgerEntry, loadScoreLedgerEntries, saveScoreLedgerEntries, } from '../../storage/scoreLedgerStorage';
import { getLedgerBalanceForBankrollOwner, listPersonBankrollOwnerIds, } from '../session/bankroll';
import { log } from '../../utils/logger';
import { resolveEmailForPlayerId, resolveWinnerDisplayName } from './gameEndIou';
/** True when the bank seat is a bot (virtual) — i.e. not a human-vs-human game. */
export function isBotBankGame(state) {
    const bankId = state.session.bankPlayerId;
    const bank = bankId ? state.players[bankId] : null;
    return bank?.playerType === 'virtual';
}
export function resolveTableModeFromState(state) {
    if (state.tableMeta.tableMode) {
        return state.tableMeta.tableMode;
    }
    return isBotBankGame(state) ? 'practice' : 'challenge';
}
/** Personal ledger offer when the table game has fully ended (practice or challenge). */
export function canAddGameToPersonalLedger(state) {
    return state.tableMeta.gameStatus === 'ended';
}
function bankShortName(state, bankId) {
    const bank = state.players[bankId];
    if (!bank) {
        return 'Bank';
    }
    if (bank.playerType === 'virtual') {
        return bank.displayName.replace(/^Bank\s+/i, '').trim() || 'Dealer';
    }
    return bank.controllerName?.trim() || bank.displayName;
}
function personShortName(state, personId) {
    const person = state.players[personId];
    return person?.controllerName?.trim() || person?.displayName || 'Player';
}
function buildParticipantResults(state, winnerId) {
    const seatStart = state.tableMeta.startingChipsEachSeat;
    const bankStart = state.tableMeta.startingChipsBank;
    const bankId = state.session.bankPlayerId;
    const results = [];
    for (const personId of listPersonBankrollOwnerIds(state)) {
        const ending = getLedgerBalanceForBankrollOwner(state, personId);
        results.push({
            email: '',
            name: personShortName(state, personId),
            personId,
            startingChips: seatStart,
            endingChips: ending,
            outcome: winnerId === personId ? 'winner' : ending <= 0 ? 'loser' : 'participant',
        });
    }
    if (bankId) {
        const ending = getLedgerBalanceForBankrollOwner(state, bankId);
        results.push({
            email: '',
            name: bankShortName(state, bankId),
            personId: state.players[bankId]?.playerType === 'real' ? bankId : null,
            startingChips: bankStart,
            endingChips: ending,
            outcome: winnerId === bankId ? 'winner' : ending <= 0 ? 'loser' : 'participant',
        });
    }
    return results;
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
    const winnerName = resolveWinnerDisplayName(state, winnerId);
    const roundCount = Math.max(1, state.session.currentRound || 1);
    const gameOverCommandMessage = `Game Over, congrats ${winnerName}, you won in ${roundCount} rounds.`;
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
    const message = bankIsBust ? 'GAME OVER\nBank is bust.' : gameOverCommandMessage;
    const playersInvolved = [
        ...new Set([
            winnerName,
            loserName,
            ...listPersonBankrollOwnerIds(state).map((id) => personShortName(state, id)),
            bankId ? bankShortName(state, bankId) : null,
        ].filter(Boolean)),
    ];
    const participants = buildParticipantResults(state, winnerId).map((p) => ({
        ...p,
        email: p.personId ? resolveEmailForPlayerId(state, p.personId) ?? p.email : p.email,
    }));
    const participantEmails = [
        ...new Set([
            ...(state.tableMeta.setupInvitedEmails ?? []).map((e) => e.trim().toLowerCase()),
            state.tableMeta.owner?.ownerEmail?.trim().toLowerCase() ?? '',
            ...participants.map((p) => p.email).filter(Boolean),
        ].filter(Boolean)),
    ];
    const entry = {
        id: generateId(),
        tableId: state.session.id,
        tableName: resolveTableClothName(state.tableMeta),
        roundCount,
        wagerDescription: wager,
        winnerPersonId: winnerIsBank ? null : winnerId,
        winnerName,
        loserPersonId: winnerIsBank ? loserId : bankId && !winnerIsBank ? bankId : null,
        loserName,
        owedDescription,
        playersInvolved,
        gameType: state.tableGame ?? 'blackjack',
        protocolId: state.blackjackProtocolId,
        mode: resolveTableModeFromState(state),
        bankName: bankId ? bankShortName(state, bankId) : undefined,
        participantEmails,
        participants,
        createdAt: state.tableMeta.endedAt ?? new Date().toISOString(),
        status: 'open',
    };
    return { message, entry };
}
export function recordScoreLedgerForGameEnd(state) {
    return addGameToPersonalLedger(state);
}
/** Add a fully completed game to the personal (score) ledger — idempotent per table session. */
export function addGameToPersonalLedger(state, options) {
    if (state.tableMeta.gameStatus !== 'ended') {
        throw new Error('Game must be fully completed before adding to personal ledger');
    }
    if (!canAddGameToPersonalLedger(state)) {
        return null;
    }
    const { entry } = buildGameOverSummary(state);
    if (!entry) {
        return null;
    }
    const saverEmail = options?.savedByEmail?.trim().toLowerCase() ?? '';
    const existing = loadScoreLedgerEntries().find((e) => e.tableId === entry.tableId && e.status !== 'cancelled');
    if (existing) {
        if (saverEmail && !existing.savedByEmails?.includes(saverEmail)) {
            const next = {
                ...existing,
                savedByEmails: [...(existing.savedByEmails ?? []), saverEmail],
            };
            saveScoreLedgerEntries(loadScoreLedgerEntries().map((e) => (e.id === next.id ? next : e)));
            return next;
        }
        return existing;
    }
    const toSave = saverEmail ? { ...entry, savedByEmails: [saverEmail] } : entry;
    appendScoreLedgerEntry(toSave);
    log.info('scoreLedgerGameEndRecorded', { entryId: toSave.id });
    return toSave;
}
export function hasPersonalLedgerEntryForTable(tableId) {
    return loadScoreLedgerEntries().some((e) => e.tableId === tableId && e.status === 'open');
}
