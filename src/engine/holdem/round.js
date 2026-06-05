import { createEmptyHoldemRound, nextBettingStreet, computeHoldemPot, } from '../../types/holdem';
import { drawCards } from '../deck/deck';
import { getCardById } from '../deck/deck';
import { appendActionLog, assertMinHoldemPlayers, getActivePlayers, getBigBlindSeat, getFirstPostflopActor, getFirstPreflopActor, getHoldemPlayerOrder, getSmallBlindSeat, initHoldemPlayerStates, resetStreetBets, rotateDealerButton, syncHoldemPot, } from './helpers';
import { postBlind, } from './betting';
import { payPotToWinner } from './ledgerEntries';
import { cardsFromIds } from '../blackjack/hand';
import { compareHoldemHands, evaluateBestHoldemHand, } from './handEvaluator';
function actionCtx(session, ledger, round, playerId) {
    return { session, ledger, round, playerId };
}
function syncPlayersFromRound(players, round) {
    const next = { ...players };
    for (const [id, ps] of Object.entries(round.playerStates)) {
        if (next[id]) {
            next[id] = {
                ...next[id],
                currentBet: ps.playerBetsThisStreet,
                cardIds: ps.holeCardIds,
                status: ps.actionStatus === 'folded' ? 'folded' : 'active',
            };
        }
    }
    return next;
}
export function createHoldemRound(session, players, ledger, deck, options) {
    assertMinHoldemPlayers(session);
    if (!session.dealerButtonPlayerId) {
        throw new Error('Dealer button must be assigned');
    }
    if (!deck) {
        throw new Error('Deck must be shuffled before starting Hold\'em');
    }
    const dealerId = session.dealerButtonPlayerId;
    const sbId = getSmallBlindSeat(session, dealerId);
    const bbId = getBigBlindSeat(session, dealerId);
    const round = syncHoldemPot({
        ...createEmptyHoldemRound(dealerId, sbId, bbId, options),
        playerStates: initHoldemPlayerStates(session),
        status: 'setup',
    });
    return {
        session,
        players: syncPlayersFromRound(players, round),
        ledger,
        deck,
        round,
    };
}
export function postBlinds(session, players, ledger, deck, round) {
    if (round.status !== 'setup') {
        throw new Error('Can only post blinds during setup');
    }
    let nextSession = session;
    let nextLedger = ledger;
    let nextRound = { ...round, status: 'blinds' };
    const sb = postBlind(actionCtx(nextSession, nextLedger, nextRound, round.smallBlindPlayerId), 'small', round.smallBlind);
    nextSession = sb.session;
    nextLedger = sb.ledger;
    nextRound = sb.round;
    const bb = postBlind(actionCtx(nextSession, nextLedger, nextRound, round.bigBlindPlayerId), 'big', round.bigBlind);
    nextSession = bb.session;
    nextLedger = bb.ledger;
    nextRound = syncHoldemPot({
        ...bb.round,
        status: 'blinds',
        bettingStreet: 'preflop',
        currentBet: round.bigBlind,
    });
    return {
        session: nextSession,
        players: syncPlayersFromRound(players, nextRound),
        ledger: nextLedger,
        deck,
        round: nextRound,
    };
}
function dealToAll(session, players, ledger, deck, round, countPerPlayer) {
    let nextDeck = deck;
    let nextRound = round;
    for (let c = 0; c < countPerPlayer; c += 1) {
        for (const playerId of getHoldemPlayerOrder(session)) {
            const ps = nextRound.playerStates[playerId];
            if (!ps || ps.actionStatus === 'folded') {
                continue;
            }
            const draw = drawCards(nextDeck, 1);
            nextDeck = draw.deck;
            if (draw.cards.length === 0) {
                throw new Error('Not enough cards in deck');
            }
            nextRound = {
                ...nextRound,
                playerStates: {
                    ...nextRound.playerStates,
                    [playerId]: {
                        ...ps,
                        holeCardIds: [...ps.holeCardIds, draw.cards[0].id],
                    },
                },
            };
        }
    }
    return {
        session,
        players: syncPlayersFromRound(players, nextRound),
        ledger,
        deck: nextDeck,
        round: nextRound,
    };
}
export function dealHoleCards(session, players, ledger, deck, round) {
    if (round.status !== 'blinds' && round.status !== 'setup') {
        throw new Error('Deal hole cards after blinds are posted');
    }
    const needed = session.playerIds.length * 2;
    if (deck.drawOrder.length < needed) {
        throw new Error(`Deck needs at least ${needed} cards`);
    }
    let result = dealToAll(session, players, ledger, deck, round, 2);
    const firstActor = getFirstPreflopActor(session, round.bigBlindPlayerId);
    result = {
        ...result,
        ledger,
        round: syncHoldemPot({
            ...result.round,
            status: 'preflop',
            bettingStreet: 'preflop',
            activePlayerId: firstActor,
        }),
    };
    return result;
}
function dealCommunity(session, players, ledger, deck, round, count, status, street) {
    if (deck.drawOrder.length < count) {
        throw new Error(`Deck needs at least ${count} cards for ${street}`);
    }
    const draw = drawCards(deck, count);
    let nextRound = resetStreetBets({
        ...round,
        status,
        bettingStreet: street,
        communityCardIds: [...round.communityCardIds, ...draw.cards.map((c) => c.id)],
        activePlayerId: getFirstPostflopActor(session, round.dealerButtonPlayerId, round),
    });
    nextRound = appendActionLog(nextRound, `${street} dealt`);
    return {
        session,
        players: syncPlayersFromRound(players, nextRound),
        ledger,
        deck: draw.deck,
        round: syncHoldemPot(nextRound),
    };
}
export function dealFlop(session, players, ledger, deck, round) {
    return dealCommunity(session, players, ledger, deck, round, 3, 'flop', 'flop');
}
export function dealTurn(session, players, ledger, deck, round) {
    return dealCommunity(session, players, ledger, deck, round, 1, 'turn', 'turn');
}
export function dealRiver(session, players, ledger, deck, round) {
    return dealCommunity(session, players, ledger, deck, round, 1, 'river', 'river');
}
function streetBettingComplete(_session, round) {
    const active = getActivePlayers(round);
    if (active.length <= 1) {
        return true;
    }
    return active.every((id) => {
        const ps = round.playerStates[id];
        return (ps.hasActedThisStreet &&
            ps.playerBetsThisStreet === round.currentBet);
    });
}
function findNextActor(session, round, afterPlayerId) {
    const order = getHoldemPlayerOrder(session);
    const start = order.indexOf(afterPlayerId);
    for (let i = 1; i <= order.length; i += 1) {
        const id = order[(start + i) % order.length];
        const ps = round.playerStates[id];
        if (ps &&
            ps.actionStatus !== 'folded' &&
            (!ps.hasActedThisStreet || ps.playerBetsThisStreet < round.currentBet)) {
            return id;
        }
    }
    return null;
}
export function setNextActor(session, round, afterPlayerId) {
    const nextId = findNextActor(session, round, afterPlayerId);
    return { ...round, activePlayerId: nextId };
}
export function awardPotToSingleWinner(session, players, ledger, deck, round, winnerId, reason) {
    const pot = computeHoldemPot(round);
    const paid = payPotToWinner(session, ledger, winnerId, pot, `${reason} — pot ${pot} chips`);
    const nextRound = {
        ...round,
        status: 'resolved',
        activePlayerId: null,
        winners: [winnerId],
        resultSummary: `${players[winnerId]?.displayName ?? winnerId} wins ${pot} chips (${reason})`,
    };
    return {
        session: { ...paid.session, status: 'round-complete' },
        players,
        ledger: paid.ledger,
        deck,
        round: syncHoldemPot(nextRound),
    };
}
export function resolveHoldemShowdown(session, players, ledger, deck, round) {
    if (round.status !== 'showdown' && round.status !== 'river') {
        throw new Error('Showdown not ready');
    }
    if (round.communityCardIds.length < 5) {
        throw new Error('Showdown requires 5 community cards');
    }
    const community = round.communityCardIds
        .map((id) => getCardById(deck, id))
        .filter(Boolean);
    const active = getActivePlayers(round);
    if (active.length === 0) {
        throw new Error('No active players at showdown');
    }
    const ranked = active.map((playerId) => {
        const hole = cardsFromIds(deck, round.playerStates[playerId].holeCardIds);
        const hand = evaluateBestHoldemHand(hole, community);
        return { playerId, hand };
    });
    ranked.sort((a, b) => compareHoldemHands(b.hand, a.hand));
    const best = ranked[0];
    const winners = ranked.filter((r) => compareHoldemHands(r.hand, best.hand) === 0);
    const pot = computeHoldemPot(round);
    const share = Math.floor(pot / winners.length);
    let nextSession = session;
    let nextLedger = ledger;
    for (const winner of winners) {
        const paid = payPotToWinner(nextSession, nextLedger, winner.playerId, share, `Showdown win (${winner.hand.label}) — ${share} chips`);
        nextSession = paid.session;
        nextLedger = paid.ledger;
    }
    const names = winners
        .map((w) => players[w.playerId]?.displayName ?? w.playerId)
        .join(', ');
    const nextRound = {
        ...round,
        status: 'resolved',
        activePlayerId: null,
        winners: winners.map((w) => w.playerId),
        resultSummary: `${names} win ${share} each at showdown (${best.hand.label})`,
    };
    return {
        session: { ...nextSession, status: 'round-complete' },
        players,
        ledger: nextLedger,
        deck,
        round: syncHoldemPot(nextRound),
    };
}
export function advanceHoldemStreet(session, players, deck, ledger, round) {
    const active = getActivePlayers(round);
    if (active.length === 1) {
        return awardPotToSingleWinner(session, players, ledger, deck, round, active[0], 'all others folded');
    }
    if (!streetBettingComplete(session, round)) {
        throw new Error('Betting street is not complete');
    }
    const next = nextBettingStreet(round.bettingStreet);
    if (next === 'showdown') {
        if (round.communityCardIds.length < 5) {
            throw new Error('Cannot showdown before river is dealt');
        }
        return resolveHoldemShowdown(session, players, ledger, deck, {
            ...round,
            status: 'showdown',
        });
    }
    if (next === 'preflop') {
        return dealHoleCards(session, players, ledger, deck, round);
    }
    if (next === 'flop') {
        return dealFlop(session, players, ledger, deck, round);
    }
    if (next === 'turn') {
        return dealTurn(session, players, ledger, deck, round);
    }
    if (next === 'river') {
        return dealRiver(session, players, ledger, deck, round);
    }
    throw new Error('Unable to advance street');
}
export function afterHoldemAction(session, players, deck, ledger, round, actingPlayerId) {
    let nextRound = round;
    const active = getActivePlayers(nextRound);
    if (active.length === 1) {
        return awardPotToSingleWinner(session, players, ledger, deck, nextRound, active[0], 'all others folded');
    }
    if (streetBettingComplete(session, nextRound)) {
        return advanceHoldemStreet(session, players, deck, ledger, nextRound);
    }
    nextRound = setNextActor(session, nextRound, actingPlayerId);
    return {
        session,
        players: syncPlayersFromRound(players, nextRound),
        ledger,
        deck,
        round: syncHoldemPot(nextRound),
    };
}
export function resetHoldemRound(session, players, ledger, deck, previousRound) {
    if (!deck) {
        throw new Error('Deck required for new Hold\'em round');
    }
    const newDealer = rotateDealerButton(session);
    const sbId = getSmallBlindSeat(session, newDealer);
    const bbId = getBigBlindSeat(session, newDealer);
    const round = syncHoldemPot({
        ...createEmptyHoldemRound(newDealer, sbId, bbId, {
            smallBlind: previousRound?.smallBlind ?? 5,
            bigBlind: previousRound?.bigBlind ?? 10,
        }),
        playerStates: initHoldemPlayerStates(session),
        status: 'setup',
    });
    return {
        session: {
            ...session,
            currentRound: session.currentRound + 1,
            status: 'active',
            dealerButtonPlayerId: newDealer,
        },
        players: syncPlayersFromRound(resetPlayerHands(players), round),
        ledger,
        deck,
        round,
    };
}
function resetPlayerHands(players) {
    const next = {};
    for (const [id, p] of Object.entries(players)) {
        next[id] = { ...p, cardIds: [], currentBet: 0, status: 'active' };
    }
    return next;
}
export function startHoldemHand(session, players, ledger, deck, round) {
    const blinds = postBlinds(session, players, ledger, deck, round);
    return dealHoleCards(blinds.session, blinds.players, blinds.ledger, deck, blinds.round);
}
