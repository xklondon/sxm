import { createEmptyBlackjackRound, createBlackjackPlayerHand, } from '../../types/blackjack';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { getBlackjackProtocolOrDefault } from './protocols';
import { isBetValidUnderProtocol } from './protocols/activeRules';
import { blackjackHandKey, listHandKeysForPlayer, parseBlackjackHandKey, } from './handKeys';
export function getBettingPlayerIds(session) {
    const bankId = session.bankPlayerId;
    const ids = session.playerIds.filter((id) => id !== bankId);
    const slots = session.boxSlotNumbers ?? {};
    if (Object.keys(slots).length > 0) {
        return [...ids].sort((a, b) => (slots[a] ?? 99) - (slots[b] ?? 99));
    }
    return [...ids].reverse();
}
/** Slot number for a box player (1 = rightmost). */
export function getBoxSlotNumber(session, playerId) {
    return session.boxSlotNumbers?.[playerId] ?? null;
}
export function syncActivePlayerId(round) {
    const playerId = round.activeHandKey
        ? parseBlackjackHandKey(round.activeHandKey).playerId
        : null;
    return { ...round, activePlayerId: playerId };
}
export function getHand(round, handKey) {
    return round.playerHands[handKey];
}
export function assertRoundStatus(round, allowed, action) {
    if (!allowed.includes(round.status)) {
        throw new Error(`Cannot ${action} while round status is "${round.status}"`);
    }
}
export function assertHandCanAct(round, handKey, action) {
    const hand = round.playerHands[handKey];
    if (!hand) {
        throw new Error(`Hand ${handKey} not found`);
    }
    if (hand.actionStatus !== 'acting') {
        throw new Error(`Cannot ${action}: hand is ${hand.actionStatus}`);
    }
    if (round.activeHandKey !== handKey) {
        throw new Error(`Cannot ${action}: not this hand's turn`);
    }
    return hand;
}
export function validateBetAmount(ledger, playerId, amount, settings, protocolId) {
    const protocol = getBlackjackProtocolOrDefault(protocolId);
    const minBet = settings?.minBet ?? protocol.defaultMinBet;
    const validation = isBetValidUnderProtocol(protocol, amount, minBet);
    if (!validation.valid) {
        throw new Error(validation.reason ?? 'Invalid bet');
    }
    const balance = derivePlayerBalanceFromLedger(playerId, ledger);
    if (amount > balance) {
        throw new Error(`Bet ${amount} exceeds table balance ${balance}`);
    }
}
export function hasAnyConfirmedBets(session, round) {
    return getBettingPlayerIds(session).some((id) => {
        const hand = round.playerHands[blackjackHandKey(id, 0)];
        return (hand?.currentBet ?? 0) > 0;
    });
}
export function handKeysWithConfirmedBets(session, round) {
    return orderedHandKeys(session, round).filter((key) => {
        const hand = round.playerHands[key];
        return (hand?.currentBet ?? 0) > 0;
    });
}
export function allBetsPlaced(session, round) {
    const bettingPlayers = getBettingPlayerIds(session);
    if (bettingPlayers.length === 0) {
        return false;
    }
    return bettingPlayers.every((id) => {
        const hand = round.playerHands[blackjackHandKey(id, 0)];
        return (hand?.currentBet ?? 0) > 0;
    });
}
export function initPlayerHandsForRound(session) {
    const hands = {};
    for (const playerId of getBettingPlayerIds(session)) {
        const key = blackjackHandKey(playerId, 0);
        hands[key] = createBlackjackPlayerHand(playerId, 0);
    }
    return hands;
}
export function createInitialBlackjackRound(session) {
    return syncActivePlayerId({
        ...createEmptyBlackjackRound(),
        playerHands: initPlayerHandsForRound(session),
    });
}
export function resetPlayerRoundFields(players) {
    const next = {};
    for (const [id, player] of Object.entries(players)) {
        next[id] = {
            ...player,
            currentBet: 0,
            cardIds: [],
            status: 'active',
        };
    }
    return next;
}
export function syncPlayerBetsFromRound(players, round) {
    const next = { ...players };
    for (const playerId of Object.keys(next)) {
        const keys = listHandKeysForPlayer(round.playerHands, playerId);
        if (keys.length === 0) {
            continue;
        }
        const totalBet = keys.reduce((sum, k) => sum + (round.playerHands[k]?.currentBet ?? 0), 0);
        const allCards = keys.flatMap((k) => round.playerHands[k]?.cardIds ?? []);
        next[playerId] = {
            ...next[playerId],
            currentBet: totalBet,
            cardIds: allCards,
        };
    }
    return next;
}
export function dealerNeedsCards(deck) {
    if (!deck || deck.drawOrder.length < 2) {
        throw new Error('Deck needs at least 2 cards to deal');
    }
}
export function orderedHandKeys(session, round) {
    const keys = [];
    for (const playerId of getBettingPlayerIds(session)) {
        keys.push(...listHandKeysForPlayer(round.playerHands, playerId));
    }
    return keys;
}
export function ranksMatchForSplit(rankA, rankB) {
    return rankA === rankB;
}
