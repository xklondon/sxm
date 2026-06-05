import { getAvailableChipsForBankrollOwner, getLedgerBalanceForBankrollOwner, getTotalBettingExposureForBankrollOwner, listPersonBankrollOwnerIds, } from './bankroll';
import { buildGameOverSummary } from '../scoreLedger/scoreLedger';
import { log } from '../../utils/logger';
function bankDisplayName(state, bankId) {
    const bank = state.players[bankId];
    if (!bank) {
        return 'Bank';
    }
    if (bank.playerType === 'virtual') {
        return bank.displayName.replace(/^Bank\s+/i, '').trim() || 'Bot';
    }
    return bank.controllerName?.trim() || bank.displayName;
}
function personDisplayName(state, personId) {
    const person = state.players[personId];
    return person?.controllerName?.trim() || person?.displayName || 'Player';
}
/** Meaningful end: one side holds all table chips or all players are eliminated. */
export function evaluateTableGameEnd(state) {
    const none = {
        ended: false,
        winnerId: null,
        winnerLabel: '',
        reason: '',
    };
    const bankId = state.session.bankPlayerId;
    const personIds = listPersonBankrollOwnerIds(state);
    const holders = [];
    if (bankId && state.players[bankId]) {
        holders.push({
            id: bankId,
            label: `Bank (${bankDisplayName(state, bankId)})`,
            ledger: getLedgerBalanceForBankrollOwner(state, bankId),
            available: getAvailableChipsForBankrollOwner(state, bankId),
            betting: 0,
        });
    }
    for (const personId of personIds) {
        holders.push({
            id: personId,
            label: personDisplayName(state, personId),
            ledger: getLedgerBalanceForBankrollOwner(state, personId),
            available: getAvailableChipsForBankrollOwner(state, personId),
            betting: getTotalBettingExposureForBankrollOwner(state, personId),
        });
    }
    const totalChips = holders.reduce((sum, h) => sum + h.ledger, 0);
    if (totalChips <= 0 || holders.length === 0) {
        return none;
    }
    // Bank bankruptcy ends the game outright (bot bank or human banker). Checked
    // before single-holder so the message reads "Bank is bust", not a player win.
    if (bankId) {
        const bank = holders.find((h) => h.id === bankId);
        if (bank && bank.ledger <= 0) {
            const topPerson = [...holders]
                .filter((h) => h.id !== bankId)
                .sort((a, b) => b.ledger - a.ledger)[0];
            return {
                ended: true,
                winnerId: topPerson && topPerson.ledger > 0 ? topPerson.id : null,
                winnerLabel: 'Bank is bust',
                reason: 'bank-bust',
            };
        }
    }
    const withChips = holders.filter((h) => h.ledger > 0);
    if (withChips.length === 1) {
        const winner = withChips[0];
        return {
            ended: true,
            winnerId: winner.id,
            winnerLabel: winner.label,
            reason: 'single-holder',
        };
    }
    if (bankId) {
        const bank = holders.find((h) => h.id === bankId);
        if (bank && bank.ledger >= totalChips) {
            return {
                ended: true,
                winnerId: bankId,
                winnerLabel: bank.label,
                reason: 'bank-has-all-chips',
            };
        }
        if (bank && bank.available <= 0 && bank.ledger <= 0) {
            const topPerson = [...holders]
                .filter((h) => h.id !== bankId)
                .sort((a, b) => b.ledger - a.ledger)[0];
            if (topPerson && topPerson.ledger > 0) {
                return {
                    ended: true,
                    winnerId: topPerson.id,
                    winnerLabel: topPerson.label,
                    reason: 'bank-empty',
                };
            }
        }
    }
    const nonBankPersons = holders.filter((h) => h.id !== bankId);
    if (nonBankPersons.length > 0 &&
        nonBankPersons.every((h) => h.available <= 0 && h.betting <= 0 && h.ledger <= 0)) {
        return {
            ended: true,
            winnerId: bankId,
            winnerLabel: bankId ? bankDisplayName(state, bankId) : 'Bank',
            reason: 'all-players-eliminated',
        };
    }
    return none;
}
export function isTableGameActive(state) {
    return (state.tableMeta.gameStatus ?? 'active') === 'active';
}
export function applyTableGameEndIfNeeded(state) {
    if (state.tableMeta.gameStatus === 'ended') {
        return state;
    }
    const evaluation = evaluateTableGameEnd(state);
    if (!evaluation.ended) {
        return state;
    }
    log.info('tableGameEnded', {
        winnerId: evaluation.winnerId,
        winnerLabel: evaluation.winnerLabel,
        reason: evaluation.reason,
    });
    const endedState = {
        ...state,
        tableMeta: {
            ...state.tableMeta,
            gameStatus: 'ended',
            winnerId: evaluation.winnerId,
            endedAt: new Date().toISOString(),
            wagerVoucherStatus: 'pending',
            bettingLocked: true,
            awaitingNextRound: false,
        },
    };
    return endedState;
}
/** Placeholder — future wager voucher flow; logs only for now. */
export function recordWagerResultPlaceholder(state) {
    if (state.tableMeta.gameStatus !== 'ended') {
        throw new Error('Table game has not ended yet');
    }
    log.info('recordWagerResultPlaceholder', {
        winnerId: state.tableMeta.winnerId,
        wagerVoucherStatus: state.tableMeta.wagerVoucherStatus,
    });
    return {
        ...state,
        tableMeta: {
            ...state.tableMeta,
            wagerVoucherStatus: 'pending',
        },
    };
}
export function getGameOverMessage(state) {
    return buildGameOverSummary(state).message;
}
