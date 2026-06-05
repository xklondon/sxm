import { betHoldemPlayer, callHoldemPlayer, checkHoldemPlayer, foldHoldemPlayer, raiseHoldemPlayer, } from './betting';
import { afterHoldemAction, createHoldemRound, resetHoldemRound, startHoldemHand, } from './round';
import { getVirtualHoldemAction, isVirtualHoldemPlayer } from './virtual';
function requireHoldemState(state) {
    if (state.session.gameType !== 'texas-holdem') {
        throw new Error('Not a Texas Hold\'em game');
    }
    if (!state.deck) {
        throw new Error('Shuffle the deck before playing Hold\'em');
    }
    return state;
}
export function applyHoldemUpdate(state, update) {
    return {
        ...state,
        session: update.session,
        players: update.players,
        ledger: update.ledger,
        deck: update.deck,
        holdem: update.round,
    };
}
export function createHoldemRoundOnState(state, options) {
    const s = requireHoldemState(state);
    const blinds = options ?? {
        smallBlind: s.holdemSettings.smallBlind,
        bigBlind: s.holdemSettings.bigBlind,
    };
    const update = createHoldemRound(s.session, s.players, s.ledger, s.deck, blinds);
    return applyHoldemUpdate(s, update);
}
export function startHoldemHandOnState(state) {
    const s = requireHoldemState(state);
    if (!s.holdem) {
        throw new Error('Create a Hold\'em round first');
    }
    const update = startHoldemHand(s.session, s.players, s.ledger, s.deck, s.holdem);
    return processVirtualHoldemTurns(applyHoldemUpdate(s, update));
}
export function newHoldemRoundOnState(state) {
    const s = requireHoldemState(state);
    const update = resetHoldemRound(s.session, s.players, s.ledger, s.deck, s.holdem ?? undefined);
    return applyHoldemUpdate(s, update);
}
function applyHoldemAction(state, action) {
    const s = requireHoldemState(state);
    if (!s.holdem || !s.holdem.activePlayerId) {
        throw new Error('No active Hold\'em action');
    }
    const playerId = s.holdem.activePlayerId;
    const ctx = {
        session: s.session,
        ledger: s.ledger,
        round: s.holdem,
        playerId,
    };
    const actionResult = action(ctx);
    const merged = afterHoldemAction(actionResult.session, s.players, s.deck, actionResult.ledger, actionResult.round, playerId);
    return processVirtualHoldemTurns(applyHoldemUpdate(s, merged));
}
export function checkHoldemOnState(state) {
    return applyHoldemAction(state, (ctx) => checkHoldemPlayer(ctx));
}
export function callHoldemOnState(state) {
    return applyHoldemAction(state, (ctx) => callHoldemPlayer(ctx));
}
export function foldHoldemOnState(state) {
    return applyHoldemAction(state, (ctx) => foldHoldemPlayer(ctx));
}
export function betHoldemOnState(state, amount) {
    return applyHoldemAction(state, (ctx) => betHoldemPlayer({ ...ctx, amount }));
}
export function raiseHoldemOnState(state, amount) {
    return applyHoldemAction(state, (ctx) => raiseHoldemPlayer({ ...ctx, amount }));
}
export function processVirtualHoldemTurns(state) {
    if (!state.holdem || !state.deck || state.session.gameType !== 'texas-holdem') {
        return state;
    }
    let next = state;
    let guard = 0;
    while (next.holdem?.activePlayerId &&
        ['preflop', 'flop', 'turn', 'river'].includes(next.holdem.status) &&
        isVirtualHoldemPlayer(next.players, next.holdem.activePlayerId) &&
        guard < 30) {
        guard += 1;
        const playerId = next.holdem.activePlayerId;
        const action = getVirtualHoldemAction(next.holdem, playerId, next.ledger, next.players[playerId]?.virtualStyle);
        switch (action.type) {
            case 'check':
                next = checkHoldemOnState(next);
                break;
            case 'call':
                next = callHoldemOnState(next);
                break;
            case 'fold':
                next = foldHoldemOnState(next);
                break;
            case 'bet':
                next = betHoldemOnState(next, action.amount);
                break;
            case 'raise':
                next = raiseHoldemOnState(next, action.amount);
                break;
            default:
                return next;
        }
    }
    return next;
}
