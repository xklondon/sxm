import { resolvePersonEndGameBalances } from '../../components/blackjackAccountingDisplay';
import { listPersonBankrollOwnerIds } from './bankroll';
import { buildGameOverSummary } from '../scoreLedger/scoreLedger';
import { formatBankHolderLabel, isChallengeTable, resolveWinnerDisplayName, } from '../scoreLedger/challengeBankDisplay';
import { resolveBankBustWinnerId, resolveEffectiveSettlementMode, } from '../scoreLedger/challengeEndAccounting';
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
        const bankBalances = resolvePersonEndGameBalances(state, bankId);
        holders.push({
            id: bankId,
            label: formatBankHolderLabel(state, bankId),
            ledger: bankBalances.ledger,
            available: bankBalances.available,
            betting: 0,
        });
    }
    for (const personId of personIds) {
        const balances = resolvePersonEndGameBalances(state, personId);
        holders.push({
            id: personId,
            label: personDisplayName(state, personId),
            ledger: balances.ledger,
            available: balances.available,
            betting: balances.betting,
        });
    }
    const totalChips = holders.reduce((sum, h) => sum + h.ledger, 0);
    if (totalChips <= 0 || holders.length === 0) {
        return none;
    }
    if (bankId) {
        const bank = holders.find((h) => h.id === bankId);
        if (bank && bank.ledger <= 0) {
            const winnerId = isChallengeTable(state)
                ? resolveBankBustWinnerId(state)
                : (() => {
                    const topPerson = [...holders]
                        .filter((h) => h.id !== bankId)
                        .sort((a, b) => b.ledger - a.ledger)[0];
                    return topPerson && topPerson.ledger > 0 ? topPerson.id : null;
                })();
            const winnerLabel = winnerId && isChallengeTable(state)
                ? resolveWinnerDisplayName(state, winnerId)
                : 'Bank is bust';
            return {
                ended: true,
                winnerId,
                winnerLabel,
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
            winnerLabel: resolveWinnerDisplayName(state, winner.id),
            reason: 'single-holder',
        };
    }
    if (bankId) {
        const bank = holders.find((h) => h.id === bankId);
        if (bank && bank.ledger >= totalChips) {
            return {
                ended: true,
                winnerId: bankId,
                winnerLabel: resolveWinnerDisplayName(state, bankId),
                reason: 'bank-has-all-chips',
            };
        }
        if (bank && bank.available <= 0 && bank.ledger <= 0) {
            const winnerId = isChallengeTable(state)
                ? resolveBankBustWinnerId(state)
                : (() => {
                    const topPerson = [...holders]
                        .filter((h) => h.id !== bankId)
                        .sort((a, b) => b.ledger - a.ledger)[0];
                    return topPerson && topPerson.ledger > 0 ? topPerson.id : null;
                })();
            if (isChallengeTable(state)
                ? listPersonBankrollOwnerIds(state).some((id) => resolvePersonEndGameBalances(state, id).ledger > 0)
                : winnerId) {
                return {
                    ended: true,
                    winnerId,
                    winnerLabel: winnerId && isChallengeTable(state)
                        ? resolveWinnerDisplayName(state, winnerId)
                        : winnerId
                            ? personDisplayName(state, winnerId)
                            : 'Bank is bust',
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
            winnerLabel: bankId
                ? isChallengeTable(state)
                    ? resolveWinnerDisplayName(state, bankId)
                    : bankDisplayName(state, bankId)
                : 'Bank',
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
            gameEndReason: evaluation.reason,
            endedAt: new Date().toISOString(),
            wagerVoucherStatus: 'pending',
            bettingLocked: true,
            awaitingNextRound: false,
        },
    };
    return {
        ...endedState,
        tableMeta: {
            ...endedState.tableMeta,
            settlementMode: resolveEffectiveSettlementMode(endedState),
        },
    };
}
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
