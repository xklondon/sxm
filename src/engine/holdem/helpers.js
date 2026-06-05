import { computeHoldemPot } from '../../types/holdem';
export function getHoldemPlayerOrder(session) {
    return [...session.playerIds];
}
export function getSeatAfter(session, playerId, steps = 1) {
    const order = getHoldemPlayerOrder(session);
    const index = order.indexOf(playerId);
    if (index === -1) {
        throw new Error(`Player ${playerId} not at table`);
    }
    return order[(index + steps) % order.length];
}
export function getSmallBlindSeat(session, dealerId) {
    return getSeatAfter(session, dealerId, 1);
}
export function getBigBlindSeat(session, dealerId) {
    return getSeatAfter(session, dealerId, 2);
}
export function getFirstPreflopActor(session, bigBlindId) {
    return getSeatAfter(session, bigBlindId, 1);
}
export function getFirstPostflopActor(session, dealerId, round) {
    const order = getHoldemPlayerOrder(session);
    const dealerIndex = order.indexOf(dealerId);
    for (let i = 1; i <= order.length; i += 1) {
        const id = order[(dealerIndex + i) % order.length];
        const ps = round.playerStates[id];
        if (ps && ps.actionStatus !== 'folded') {
            return id;
        }
    }
    return null;
}
export function getActivePlayers(round) {
    return Object.entries(round.playerStates)
        .filter(([, ps]) => ps.actionStatus !== 'folded')
        .map(([id]) => id);
}
export function initHoldemPlayerStates(session) {
    const states = {};
    for (const playerId of session.playerIds) {
        states[playerId] = {
            holeCardIds: [],
            actionStatus: 'waiting',
            playerBetsThisStreet: 0,
            playerTotalCommitted: 0,
            hasActedThisStreet: false,
        };
    }
    return states;
}
export function syncHoldemPot(round) {
    return { ...round, pot: computeHoldemPot(round) };
}
export function resetStreetBets(round) {
    const playerStates = {};
    for (const [id, ps] of Object.entries(round.playerStates)) {
        playerStates[id] = {
            ...ps,
            playerBetsThisStreet: 0,
            hasActedThisStreet: false,
            actionStatus: ps.actionStatus === 'folded' ? 'folded' : 'active',
        };
    }
    return syncHoldemPot({
        ...round,
        playerStates,
        currentBet: 0,
        lastRaiseSize: round.bigBlind,
    });
}
export function appendActionLog(round, message) {
    return {
        ...round,
        actionLog: [...round.actionLog, message],
    };
}
export function assertMinHoldemPlayers(session) {
    if (session.playerIds.length < 2) {
        throw new Error('Texas Hold\'em requires at least 2 players');
    }
}
export function rotateDealerButton(session) {
    const current = session.dealerButtonPlayerId ?? session.playerIds[0];
    return getSeatAfter(session, current, 1);
}
