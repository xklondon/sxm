/** True when this table session is a dice Zilch game (any authoritative marker). */
export function isZilchTable(state) {
    return (state.tableGame === 'zilch' ||
        state.session.gameType === 'zilch' ||
        state.tableMeta.diceGame === 'zilch' ||
        state.tableMeta.gameCategory === 'dice');
}
/** Align tableGame, session.gameType, and table meta for dice/Zilch tables. */
export function ensureZilchTableIdentity(state) {
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
export function isBlackjackTable(state) {
    if (isZilchTable(state)) {
        return false;
    }
    return state.tableGame === 'blackjack' || state.session.gameType === 'blackjack';
}
export function isHoldemTable(state) {
    if (isZilchTable(state)) {
        return false;
    }
    return state.tableGame === 'texas-holdem' || state.session.gameType === 'texas-holdem';
}
/** Normalize loaded/saved/hydrated state before render. */
export function normalizeLoadedGameState(state) {
    return ensureZilchTableIdentity(state);
}
