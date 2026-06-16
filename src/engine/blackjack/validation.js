import { createEmptySession } from '../../types/session';
import { createEmptyBlackjackRound, createBlackjackPlayerHand } from '../../types/blackjack';
import { getAvailableChipsForBankrollOwner, resolveBankrollOwnerIdForBox } from '../session/bankroll';
import { DEFAULT_BLACKJACK_SETTINGS } from './settings';
import { runBlackjackRulesAudit } from './rules';
import { blackjackHandKey, parseBlackjackHandKey } from './handKeys';
import { getBettingPlayerIds, hasAnyConfirmedBets } from './helpers';
import { getBlackjackProtocolForState } from './protocolState';
import { buildActiveRulesHandContext, canDoubleUnderProtocol, canHitUnderProtocol, canSplitUnderProtocol, canStandUnderProtocol, } from './protocols/activeRules';
export function canPlaceBlackjackBet(round) {
    return round.status === 'betting';
}
export function canDrawBankCard(round) {
    return round.status === 'bank-turn';
}
export function canCompleteBanking(round) {
    return round.status === 'banking';
}
export function canDealNextInitialCard(round) {
    return round.status === 'initial-deal';
}
export function canDealInitialBlackjack(session, round) {
    return round.status === 'betting' && hasAnyConfirmedBets(session, round);
}
function rulesContextForHand(state, handKey) {
    const round = state.blackjack;
    const deck = state.deck;
    if (!round || !deck) {
        return null;
    }
    const protocol = getBlackjackProtocolForState(state);
    const { playerId } = parseBlackjackHandKey(handKey);
    const ownerId = resolveBankrollOwnerIdForBox(state, playerId);
    const ctx = buildActiveRulesHandContext(protocol, state.ledger, round, handKey, deck, ownerId, getAvailableChipsForBankrollOwner(state, ownerId));
    return ctx ? { protocol, ctx, deck } : null;
}
export function canHitBlackjack(round, handKey) {
    if (round.evenMoneyOfferHandKey || round.insuranceOfferPending) {
        return false;
    }
    if (round.status !== 'player-turns' || round.activeHandKey !== handKey) {
        return false;
    }
    const hand = round.playerHands[handKey];
    return hand?.actionStatus === 'acting' && !hand.doubled && !hand.naturalSettled;
}
export function canStandBlackjack(round, handKey) {
    if (round.insuranceOfferPending) {
        return false;
    }
    if (round.status !== 'player-turns' || round.activeHandKey !== handKey) {
        return false;
    }
    return round.playerHands[handKey]?.actionStatus === 'acting';
}
export function canDoubleBlackjack(_ledger, _round, handKey, _settings, deck, _bankrollOwnerId, state) {
    if (!state || !deck) {
        return false;
    }
    const built = rulesContextForHand(state, handKey);
    return built ? canDoubleUnderProtocol(built.protocol, built.ctx.hand, built.ctx) : false;
}
export function canDoubleBlackjackForState(state, handKey) {
    const built = rulesContextForHand(state, handKey);
    return built ? canDoubleUnderProtocol(built.protocol, built.ctx.hand, built.ctx) : false;
}
export function canSplitBlackjack(_ledger, deck, _round, handKey, _settings, _bankrollOwnerId, state) {
    if (!state) {
        return false;
    }
    const built = rulesContextForHand(state, handKey);
    return built
        ? canSplitUnderProtocol(built.protocol, built.ctx.hand, { ...built.ctx, deck })
        : false;
}
export function canSplitBlackjackForState(state, handKey) {
    const built = rulesContextForHand(state, handKey);
    return built
        ? canSplitUnderProtocol(built.protocol, built.ctx.hand, { ...built.ctx, deck: built.deck })
        : false;
}
/** Split/Double legality as if the hand were still acting — for auto-stop hold retrospection. */
export function getPlayerOptionalActionGateIfActing(state, handKey) {
    const built = rulesContextForHand(state, handKey);
    if (!built) {
        return { canSplit: false, canDouble: false };
    }
    const hand = { ...built.ctx.hand, actionStatus: 'acting' };
    return {
        canSplit: canSplitUnderProtocol(built.protocol, hand, { ...built.ctx, deck: built.deck }),
        canDouble: canDoubleUnderProtocol(built.protocol, hand, built.ctx),
    };
}
export function canHitBlackjackForState(state, handKey) {
    if (!state.blackjack || !canHitBlackjack(state.blackjack, handKey)) {
        return false;
    }
    const built = rulesContextForHand(state, handKey);
    return built ? canHitUnderProtocol(built.protocol, built.ctx.hand, built.ctx) : false;
}
export function canStandBlackjackForState(state, handKey) {
    if (!state.blackjack || !canStandBlackjack(state.blackjack, handKey)) {
        return false;
    }
    const built = rulesContextForHand(state, handKey);
    return built ? canStandUnderProtocol(built.protocol, built.ctx.hand, built.ctx) : false;
}
export function runBlackjackEngineChecks() {
    const results = [];
    results.push({
        name: 'getBettingPlayerIds excludes bank and sorts RTL',
        passed: getBettingPlayerIds({
            ...createEmptySession('blackjack'),
            playerIds: ['a', 'b', 'c'],
            bankPlayerId: 'b',
            boxSlotNumbers: { a: 2, c: 1 },
        }).join(',') === 'c,a',
    });
    results.push({
        name: 'cannot bet after deal starts',
        passed: !canPlaceBlackjackBet({ status: 'player-turns' }),
    });
    results.push({
        name: 'primary hand key format',
        passed: blackjackHandKey('p1', 0) === 'p1:0',
    });
    const rulesAudit = runBlackjackRulesAudit(DEFAULT_BLACKJACK_SETTINGS);
    results.push({
        name: 'Las Vegas rules audit',
        passed: rulesAudit.passed,
        detail: rulesAudit.results.filter((r) => !r.passed).map((r) => r.name).join(', ') || undefined,
    });
    results.push({
        name: 'cannot deal before all bets placed',
        passed: !canDealInitialBlackjack({ bankPlayerId: 'd', playerIds: ['a', 'd'] }, {
            ...createEmptyBlackjackRound(),
            playerHands: {
                'a:0': {
                    ...createBlackjackPlayerHand('a', 0),
                    currentBet: 0,
                },
            },
        }),
    });
    const passed = results.every((r) => r.passed);
    return { passed, results };
}
