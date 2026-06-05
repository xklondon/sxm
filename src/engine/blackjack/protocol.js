import { isTableGameActive } from '../session/tableGameEnd';
import { createBlackjackPlayerHand } from '../../types/blackjack';
import { isBankerReady } from '../session/boxOps';
import { log } from '../../utils/logger';
import { isDevEnv } from '../../utils/isDevEnv';
import { blackjackHandKey } from './handKeys';
import { getBettingPlayerIds } from './helpers';
import { getProtocolMessage } from './protocolMessages';
import { getRemainingCardCount } from '../deck/deck';
import { cardsFromIds, getBlackjackHandValue } from './hand';
import { getStakeForBox, getBoxesWithStakes, hasAnyStakes, isBettingOpen, } from './stakes';
import { isStagedInitialDeal } from './dealing/dealingModes';
import { isInitialDealRoundComplete } from './initialDealGuards';
import { getEligibleDealBoxes, getDealBlockReason, getTableMinimumBet, hasEligibleDealBoxes, } from './dealEligibility';
/** Occupied box player ids from table layout (UI source of truth). */
export function getOccupiedBoxPlayerIds(state) {
    return state.tableMeta.boxSlots
        .map((s) => s.playerId)
        .filter((id) => id !== null);
}
export { getStakeForBox, getStakeChipsForBox, getBoxesWithStakes, hasAnyStakes, isBettingOpen } from './stakes';
export { getEligibleDealBoxes, getDealBlockReason, getTableMinimumBet, hasEligibleDealBoxes, isStakeBelowMinimum, canChangeMinimumBet, setTableMinimumBet, logDealCardsAudit, } from './dealEligibility';
/** @deprecated Use getBoxesWithStakes */
export function getBoxesWithConfirmedBets(state) {
    return getBoxesWithStakes(state);
}
/** @deprecated Use getStakeForBox */
export function getConfirmedBetForBox(state, boxPlayerId) {
    return getStakeForBox(state, boxPlayerId);
}
/** @deprecated Use getBoxesWithStakes */
export function getActiveBettingBoxes(state) {
    return getBoxesWithStakes(state);
}
export function hasAnyConfirmedBetsFromState(state) {
    return hasAnyStakes(state);
}
export function canStartCards(state) {
    if (state.tableMeta.gameStatus === 'ended' || !isTableGameActive(state)) {
        log.info('canStartCards', { ok: false, reason: 'game ended' });
        return false;
    }
    if (state.tableMeta.awaitingNextRound) {
        log.info('canStartCards', { ok: false, reason: 'awaiting next round' });
        return false;
    }
    if (!isBankerReady(state)) {
        log.info('canStartCards', { ok: false, reason: 'banker not ready' });
        return false;
    }
    if (!state.deck) {
        log.info('canStartCards', { ok: false, reason: 'no shoe' });
        return false;
    }
    if (state.tableMeta.bettingLocked) {
        log.info('canStartCards', { ok: false, reason: 'bets already locked' });
        return false;
    }
    const phase = getBlackjackProtocolPhase(state);
    if (phase !== 'betting') {
        log.info('canStartCards', { ok: false, reason: 'not betting phase', phase });
        return false;
    }
    const roundStatus = state.blackjack?.status;
    if (roundStatus &&
        roundStatus !== 'betting' &&
        roundStatus !== 'resolved') {
        log.info('canStartCards', { ok: false, reason: 'round in play', roundStatus });
        return false;
    }
    const boxes = getEligibleDealBoxes(state);
    const ok = boxes.length > 0;
    log.info('canStartCards', {
        ok,
        minBet: getTableMinimumBet(state),
        eligibleBoxes: boxes,
        stakes: boxes.map((id) => ({ id, stake: getStakeForBox(state, id) })),
    });
    return ok;
}
/** @deprecated Use canStartCards */
export function canDealCards(state) {
    return canStartCards(state);
}
export function getCardsBlockReason(state) {
    return getDealBlockReason(state);
}
export function logPendingBet(boxId, amount, total) {
    log.info('pendingBet', { boxId, amount, total });
}
export function logConfirmBet(state, boxId, amount) {
    log.info('confirmBet', {
        boxId,
        amount,
        stake: getStakeForBox(state, boxId),
        boxes: getBoxesWithStakes(state),
    });
}
export function logConfirmedBetsBeforeCards(state) {
    const boxes = getBoxesWithStakes(state);
    log.info('confirmedBetsBeforeCards', {
        boxes,
        stakes: boxes.map((id) => ({ id, stake: getStakeForBox(state, id) })),
        roundStatus: state.blackjack?.status ?? null,
    });
}
export function logDealPlan(handKeys) {
    log.info('dealPlan', { handKeys, count: handKeys.length });
}
export function logDealSanity(state, extra) {
    const occupied = getOccupiedBoxPlayerIds(state);
    const stakes = occupied.map((id) => ({
        id,
        slot: state.session.boxSlotNumbers?.[id] ?? null,
        stake: getStakeForBox(state, id),
        chips: state.tableMeta.boxStakes[id]?.chips ?? [],
    }));
    const dealPlan = getEligibleDealBoxes(state).map((id) => blackjackHandKey(id, 0));
    const shoe = state.deck
        ? { exists: true, remaining: getRemainingCardCount(state.deck) }
        : { exists: false, remaining: 0 };
    const payload = {
        event: 'Cards clicked',
        occupiedBoxes: occupied,
        stakes,
        bankerReady: isBankerReady(state),
        shoe,
        roundExists: state.blackjack !== null,
        roundStatus: state.blackjack?.status ?? null,
        bettingLocked: state.tableMeta.bettingLocked,
        shoeStarted: state.tableMeta.shoeStarted,
        dealPlan,
        canStartCards: canStartCards(state),
        dealResult: extra?.dealResult ?? null,
    };
    log.info('dealSanity', payload);
    if (isDevEnv()) {
        console.log('[SXMCards] dealSanity', payload);
    }
}
/** @deprecated Use logDealSanity */
export function logDealDiagnostics(state) {
    logDealSanity(state);
}
export function getBlackjackProtocolPhase(state) {
    if (state.tableMeta.awaitingNextRound && state.blackjack?.status === 'resolved') {
        return 'round-complete';
    }
    if (state.blackjack?.insuranceOfferPending) {
        const round = state.blackjack;
        if (isInitialDealRoundComplete(state.session, round)) {
            return 'insurance';
        }
        return 'dealing';
    }
    const status = state.blackjack?.status;
    switch (status) {
        case 'initial-deal':
            return 'dealing';
        case 'player-turns':
            return 'player';
        case 'bank-turn':
            return 'bank';
        case 'banking':
            return 'banking';
        case 'resolved':
            return 'betting';
        case 'betting':
        default:
            return 'betting';
    }
}
/**
 * UI-facing phase: defers insurance (and other post-deal phases) until card reveal catches up.
 */
export function getDisplayBlackjackProtocolPhase(state, cardRevealComplete) {
    const phase = getBlackjackProtocolPhase(state);
    if (!cardRevealComplete && phase === 'insurance') {
        return 'dealing';
    }
    if (!cardRevealComplete && phase === 'player' && state.blackjack) {
        const round = state.blackjack;
        if (round.insuranceOfferPending ||
            !isInitialDealRoundComplete(state.session, round)) {
            return 'dealing';
        }
    }
    return phase;
}
export function getAllowedBlackjackActionsForPhase(state) {
    const phase = getBlackjackProtocolPhase(state);
    switch (phase) {
        case 'betting': {
            const actions = [];
            if (isBettingOpen(state)) {
                actions.push('place-bet', 'clear-bet');
            }
            if (!state.tableMeta.shoeStarted && isBettingOpen(state)) {
                actions.push('shuffle');
            }
            else if (isBettingOpen(state) && hasEligibleDealBoxes(state) && state.deck) {
                actions.push('deal-cards');
            }
            if (state.tableMeta.shoeStarted && isBettingOpen(state)) {
                actions.push('shuffle');
            }
            return actions;
        }
        case 'round-complete':
            return ['none'];
        case 'dealing':
            return isStagedInitialDeal(state.blackjackFlowSettings.initialDealMode)
                ? ['deal-next-card']
                : ['none'];
        case 'insurance':
            return ['player-insurance'];
        case 'player':
            return ['player-card', 'player-stay', 'player-double', 'player-split', 'player-aid'];
        case 'bank':
            return state.blackjackFlowSettings.bankDrawMode === 'manual' ? ['bank-draw'] : ['none'];
        case 'banking':
            return ['none'];
        default:
            return ['none'];
    }
}
export function getProtocolTableMessage(state) {
    return getProtocolMessage(state, getBlackjackProtocolPhase(state));
}
export function getCenterStatusMessage(state, cardTimer) {
    if (cardTimer > 0 &&
        state.tableMeta.bettingLocked &&
        getBlackjackProtocolPhase(state) === 'betting') {
        return `Cards in ${cardTimer}`;
    }
    return getProtocolTableMessage(state);
}
/** Bank stand/bust message after dealer play completes. */
export function getBankFinalMessage(state) {
    const round = state.blackjack;
    if (!round || !state.deck) {
        return 'Bank stands.';
    }
    const ids = round.dealerCardIds.filter(Boolean);
    if (ids.length === 0) {
        return 'Bank stands.';
    }
    const cards = cardsFromIds(state.deck, ids);
    const { value } = getBlackjackHandValue(cards);
    if (value > 21) {
        return 'Bank busts.';
    }
    return `Bank stands on ${value}.`;
}
export function getActiveHandKeysForDeal(state) {
    const keys = getEligibleDealBoxes(state).map((id) => blackjackHandKey(id, 0));
    logDealPlan(keys);
    return keys;
}
export function syncConfirmedBetsToRound(state) {
    const { session, blackjack: round } = state;
    if (!round || round.status !== 'betting') {
        return state;
    }
    const nextRound = ensureBettingRoundHands(round, session);
    const hands = { ...nextRound.playerHands };
    for (const playerId of getEligibleDealBoxes(state)) {
        const key = blackjackHandKey(playerId, 0);
        const stake = getStakeForBox(state, playerId);
        if (stake > 0) {
            hands[key] = {
                ...(hands[key] ?? createBlackjackPlayerHand(playerId, 0)),
                currentBet: stake,
                actionStatus: 'betting',
            };
        }
    }
    return { ...state, blackjack: { ...nextRound, playerHands: hands } };
}
export function ensureBettingRoundHands(round, session) {
    if (round.status !== 'betting') {
        return round;
    }
    const hands = { ...round.playerHands };
    for (const playerId of getBettingPlayerIds(session)) {
        const key = blackjackHandKey(playerId, 0);
        if (!hands[key]) {
            hands[key] = createBlackjackPlayerHand(playerId, 0);
        }
    }
    return { ...round, playerHands: hands };
}
