import { normalizeFlowSettings, syncDealTimingFromPreset } from './flowSettings';
import { lockProtocolOnState, getBlackjackProtocolForState } from './protocolState';
import { createBlackjackRound, doubleDownBlackjackPlayer, hitBlackjackPlayer, placeBlackjackBet, resetBlackjackRound, resolveBlackjackRound, splitBlackjackPlayer, standBlackjackPlayer, applyBlackjackToGameState, } from './round';
import { beginInitialDeal, dealNextInitialCard, } from './initialDeal';
import { takeInsuranceBet, declineInsurance, closeInsuranceOffer, allInsuranceResolved, advanceInsurancePhaseIfComplete, getInsuranceOfferForBox, } from './insurance';
import { drawSingleBankCard, enterBankingIfComplete } from './bankTurn';
import { activePlayerIdFromRound, getVirtualBlackjackAction, isVirtualPlayer } from './virtual';
import { parseBlackjackHandKey, blackjackHandKey } from './handKeys';
import { log } from '../../utils/logger';
import { isDevEnv } from '../../utils/isDevEnv';
import { syncConfirmedBetsToRound, getEligibleDealBoxes, getBlackjackProtocolPhase, getStakeForBox, getActiveHandKeysForDeal, logConfirmedBetsBeforeCards, logConfirmBet, logDealPlan, logDealSanity, ensureBettingRoundHands, } from './protocol';
import { getTableMinimumBet, } from './dealEligibility';
import { hasAnyStakes, } from './stakes';
import { bankrollContextFromState } from '../session/bankroll';
import { applyTableGameEndIfNeeded } from '../session/tableGameEnd';
import { syncCallersForDeal } from '../session/playerAssignment';
import { clearTableUiEphemeral } from '../session/inviteJoin';
import { settleBustHandOnState } from './bustSettlement';
import { shuffleGameDeck } from '../deck';
import { resolveNaturalsAfterInitialDeal, resolvePendingNaturalsAfterDealerPeek } from './naturalBlackjack';
import { getCallerPersonIdForBox } from '../session/playerAssignment';
import { autoStandThreshold, getPlayFlowForPerson } from './playFlow';
import { cardsFromIds } from './hand';
import { getBlackjackHandValue } from './hand';
function requireBlackjackState(state) {
    if (state.session.gameType !== 'blackjack') {
        throw new Error('Not a Blackjack game');
    }
    if (!state.deck) {
        throw new Error('Shuffle the deck before playing Blackjack');
    }
    return state;
}
function requireActiveHandKey(state) {
    if (!state.blackjack?.activeHandKey) {
        throw new Error('No active hand');
    }
    return state.blackjack.activeHandKey;
}
function logPhase(state, detail) {
    const status = state.blackjack?.status ?? 'none';
    log.info(`Phase: ${status}${detail ? ` — ${detail}` : ''}`);
}
function applyHit(state, handKey) {
    const s = requireBlackjackState(state);
    if (!s.blackjack) {
        throw new Error('No active Blackjack round');
    }
    const beforeHitCards = [...(s.blackjack.playerHands[handKey]?.cardIds ?? [])].filter(Boolean);
    const result = hitBlackjackPlayer(s.session, s.players, s.deck, s.blackjack, handKey);
    const afterHitCards = [...(result.round.playerHands[handKey]?.cardIds ?? [])].filter(Boolean);
    const drawnCard = afterHitCards.length > beforeHitCards.length ? afterHitCards[afterHitCards.length - 1] : null;
    log.info('Player action: hit', {
        handKey,
        activeHandKey: result.round.activeHandKey,
        beforeHitCards,
        drawnCard,
        afterHitCards,
    });
    if (isDevEnv()) {
        console.log('[SXMCards] hit', {
            activeHandKey: handKey,
            beforeHitCards,
            drawnCard,
            afterHitCards,
        });
    }
    let next = applyBlackjackToGameState(s, result);
    const bustedHand = next.blackjack?.playerHands[handKey];
    if (bustedHand?.actionStatus === 'busted') {
        next = settleBustHandOnState(next, handKey);
    }
    return next;
}
function applyStand(state, handKey) {
    const s = requireBlackjackState(state);
    if (!s.blackjack) {
        throw new Error('No active Blackjack round');
    }
    const beforeStayActiveHandKey = s.blackjack.activeHandKey;
    const result = standBlackjackPlayer(s.session, s.players, s.blackjack, handKey);
    const afterStayNextActiveHandKey = result.round.activeHandKey;
    const nextPhase = result.round.status;
    log.info('Player action: stand', {
        handKey,
        beforeStayActiveHandKey,
        afterStayNextActiveHandKey,
        nextPhase,
    });
    if (isDevEnv()) {
        console.log('[SXMCards] stay', {
            beforeStayActiveHandKey,
            afterStayNextActiveHandKey,
            nextPhase,
        });
    }
    return applyBlackjackToGameState(s, { ...result, deck: s.deck });
}
function applyDouble(state, handKey) {
    const s = requireBlackjackState(state);
    if (!s.blackjack) {
        throw new Error('No active Blackjack round');
    }
    const result = doubleDownBlackjackPlayer(s.session, s.players, s.ledger, s.deck, s.blackjack, handKey, bankrollContextFromState(s), s.blackjackSettings, getBlackjackProtocolForState(s));
    log.info('Player action: double', { handKey });
    let next = applyBlackjackToGameState(s, result);
    const bustedHand = next.blackjack?.playerHands[handKey];
    if (bustedHand?.actionStatus === 'busted') {
        next = settleBustHandOnState(next, handKey);
    }
    return next;
}
function applySplit(state, handKey) {
    const s = requireBlackjackState(state);
    if (!s.blackjack) {
        throw new Error('No active Blackjack round');
    }
    const result = splitBlackjackPlayer(s.session, s.players, s.ledger, s.deck, s.blackjack, handKey, bankrollContextFromState(s), s.blackjackSettings, getBlackjackProtocolForState(s));
    log.info('Player action: split', { handKey });
    return applyBlackjackToGameState(s, result);
}
export function startBlackjackRound(state) {
    const s = requireBlackjackState(state);
    const created = createBlackjackRound(s.session, s.players, s.deck);
    log.info('Blackjack round started');
    return {
        ...s,
        ...created,
        blackjack: created.round,
    };
}
export function placeBlackjackBetOnState(state, playerId, amount) {
    let s = requireBlackjackState(state);
    if (!s.blackjack || s.blackjack.status === 'resolved') {
        if (s.blackjack?.status === 'resolved') {
            s = requireBlackjackState(newBlackjackRoundOnState(s));
        }
        else {
            s = requireBlackjackState(startBlackjackRound(s));
        }
    }
    const round = ensureBettingRoundHands(s.blackjack, s.session);
    const result = placeBlackjackBet(s.session, s.players, s.ledger, round, playerId, amount, bankrollContextFromState(s), { ...s.blackjackSettings, minBet: getTableMinimumBet(s) });
    log.info('Bet confirmed', { playerId, amount, roundBet: result.round.playerHands[blackjackHandKey(playerId, 0)]?.currentBet });
    const next = { ...s, ...result, blackjack: result.round };
    logConfirmBet(next, playerId, amount);
    return next;
}
export function prepareDealState(state) {
    log.info('Deal function called', { phase: getBlackjackProtocolPhase(state) });
    let s = syncConfirmedBetsToRound(state);
    if (!s.deck) {
        throw new Error('Shuffle the shoe first.');
    }
    if (!s.blackjack || s.blackjack.status === 'resolved') {
        if (s.blackjack?.status === 'resolved') {
            s = newBlackjackRoundOnState(s);
        }
        else if (!s.blackjack) {
            s = startBlackjackRound(s);
        }
        s = syncConfirmedBetsToRound(s);
    }
    const active = getEligibleDealBoxes(s);
    log.info('Confirmed betting boxes', {
        boxes: active,
        minBet: getTableMinimumBet(s),
        stakes: active.map((id) => ({ id, stake: getStakeForBox(s, id) })),
    });
    log.info('Active boxes for round', { active });
    if (active.length === 0) {
        log.info('Deal blocked: no eligible bets on hands');
        throw new Error(hasAnyStakes(s)
            ? 'Place at least minimum bet to deal.'
            : 'Place bets first.');
    }
    return requireBlackjackState(s);
}
export function dealCardsFromState(state) {
    logDealSanity(state);
    logConfirmedBetsBeforeCards(state);
    const prepared = prepareDealState(clearTableUiEphemeral(state));
    const plan = getActiveHandKeysForDeal(prepared);
    logDealPlan(plan);
    log.info('Cards deal starting', { mode: prepared.blackjackFlowSettings.initialDealMode, plan });
    let result;
    const dealMode = prepared.blackjackFlowSettings.initialDealMode;
    if (dealMode === 'instant' || dealMode === 'natural') {
        let next = dealInitialBlackjackOnState(prepared);
        log.info(`Initial deal complete (${dealMode} mode, authoritative)`);
        next = processVirtualTurns(syncBankPhaseOnState(next));
        logPhase(next, 'deal complete');
        result = lockProtocolOnState(next);
    }
    else {
        result = lockProtocolOnState(beginInitialDealOnState(prepared));
        log.info(`Initial deal begun (${dealMode} mode)`);
    }
    logDealSanity(state, { dealResult: 'ok' });
    return result;
}
export function applyBoxStakesToRound(state) {
    if (!state.deck) {
        throw new Error('Shuffle the shoe first.');
    }
    if (!hasAnyStakes(state)) {
        throw new Error('Place bets first.');
    }
    let s = state;
    if (!s.blackjack || s.blackjack.status === 'resolved') {
        if (s.blackjack?.status === 'resolved') {
            s = newBlackjackRoundOnState(s);
        }
        else {
            s = startBlackjackRound(s);
        }
    }
    for (const boxId of getEligibleDealBoxes(s)) {
        const amount = getStakeForBox(s, boxId);
        if (amount > 0) {
            s = placeBlackjackBetOnState(s, boxId, amount);
        }
    }
    const eligible = getEligibleDealBoxes(s);
    s = syncCallersForDeal(s, eligible);
    log.info('Bets locked', {
        boxes: eligible,
        stakes: eligible.map((id) => ({ id, stake: getStakeForBox(s, id) })),
    });
    return {
        ...s,
        tableMeta: { ...s.tableMeta, bettingLocked: true },
    };
}
export function shuffleToStartOnState(state) {
    if (state.tableMeta.bettingLocked) {
        throw new Error('Finish the current round before shuffling.');
    }
    const s = shuffleGameDeck(clearTableUiEphemeral(state));
    return {
        ...s,
        tableMeta: { ...s.tableMeta, shoeStarted: true },
    };
}
/** @deprecated Use shuffleToStartOnState — shuffle only, does not lock bets. */
export function lockBetsAndShuffleOnState(state) {
    return shuffleToStartOnState(state);
}
export function dealCardsButtonOnState(state) {
    if (state.tableMeta.bettingLocked) {
        return dealCardsFromState(state);
    }
    const locked = applyBoxStakesToRound(state);
    return dealCardsFromState(locked);
}
export function lockBetsAndStartRoundOnState(state) {
    if (state.tableMeta.bettingLocked) {
        throw new Error('Bets already locked.');
    }
    if (!state.deck) {
        throw new Error('Shuffle the shoe first.');
    }
    if (!hasAnyStakes(state)) {
        throw new Error('Place bets first.');
    }
    return applyBoxStakesToRound(state);
}
export function shuffleFreshShoeOnState(state) {
    if (state.tableMeta.bettingLocked) {
        throw new Error('Finish the current round before shuffling.');
    }
    return shuffleGameDeck(state);
}
export function beginInitialDealOnState(state) {
    const s = prepareDealState(state);
    if (!s.blackjack) {
        throw new Error('Start a Blackjack round first');
    }
    const handKeys = getActiveHandKeysForDeal(s);
    const result = beginInitialDeal(s.session, s.players, s.deck, s.blackjack, handKeys, s.blackjackSettings);
    log.info('Initial deal started');
    logPhase({ ...s, blackjack: result.round });
    return { ...s, ...result, blackjack: result.round };
}
export function dealNextInitialCardOnState(state) {
    const s = requireBlackjackState(state);
    if (!s.blackjack) {
        throw new Error('No active Blackjack round');
    }
    const result = dealNextInitialCard(s.session, s.players, s.deck, s.blackjack, s.blackjackSettings, getBlackjackProtocolForState(s));
    log.info('Card dealt (initial)', {
        target: result.step.type === 'box' ? result.step.handKey : 'bank',
        cardId: result.cardId,
    });
    let next = {
        ...s,
        session: result.session,
        players: result.players,
        deck: result.deck,
        blackjack: result.round,
    };
    if (result.complete) {
        logPhase(next, 'initial deal complete');
        next = resolveNaturalsAfterInitialDeal(next);
        next = applyInsuranceAdvanceOnState(next);
        next = processVirtualTurns(syncBankPhaseOnState(next));
    }
    return next;
}
/** Finish staged/natural initial deals — used by server-authoritative actions, not offline UI pacing. */
export function completeStepwiseInitialDealIfNeeded(state) {
    let next = state;
    let guard = 0;
    while (next.blackjack?.status === 'initial-deal' && guard < 50) {
        guard += 1;
        next = dealNextInitialCardOnState(next);
    }
    return next;
}
export function dealInitialBlackjackOnState(state) {
    const s = prepareDealState(state);
    if (!s.blackjack) {
        throw new Error('Start a Blackjack round first');
    }
    const handKeys = getActiveHandKeysForDeal(s);
    const protocol = getBlackjackProtocolForState(s);
    let current = beginInitialDeal(s.session, s.players, s.deck, s.blackjack, handKeys, s.blackjackSettings);
    let guard = 0;
    while (current.round.status === 'initial-deal' && guard < 50) {
        guard += 1;
        const next = dealNextInitialCard(current.session, current.players, current.deck, current.round, s.blackjackSettings, protocol);
        if (guard === 1) {
            log.info('First card dealt', { cardId: next.cardId, target: next.step.type });
        }
        current = {
            session: next.session,
            players: next.players,
            deck: next.deck,
            round: next.round,
        };
    }
    let next = { ...s, ...current, blackjack: current.round };
    next = resolveNaturalsAfterInitialDeal(next);
    next = applyInsuranceAdvanceOnState(next);
    return processVirtualTurns(syncBankPhaseOnState(next));
}
export function applyInsuranceAdvanceOnState(state) {
    const round = state.blackjack;
    if (!round?.insuranceOfferPending) {
        return state;
    }
    const protocol = getBlackjackProtocolForState(state);
    const advanced = advanceInsurancePhaseIfComplete(state, round, protocol);
    if (!advanced.closed) {
        return state;
    }
    let next = { ...state, players: advanced.players, blackjack: advanced.round };
    return resolvePendingNaturalsAfterDealerPeek(next);
}
export function syncBankPhaseOnState(state) {
    if (!state.blackjack || !state.deck) {
        return state;
    }
    if (state.blackjack.status === 'banking') {
        return state;
    }
    if (state.blackjack.status !== 'bank-turn') {
        return state;
    }
    const round = enterBankingIfComplete(state.blackjack, state.deck, state.blackjackSettings, getBlackjackProtocolForState(state), state.session);
    if (round.status !== state.blackjack.status) {
        logPhase({ ...state, blackjack: round }, 'bank stands');
    }
    return { ...state, blackjack: round };
}
export function drawBankCardOnState(state) {
    const s = requireBlackjackState(state);
    if (!s.blackjack) {
        throw new Error('No active Blackjack round');
    }
    const result = drawSingleBankCard(s.session, s.players, s.deck, s.blackjack, s.blackjackSettings, getBlackjackProtocolForState(s));
    if (result.cardId) {
        log.info('Bank draw', { cardId: result.cardId });
    }
    else {
        log.info('Bank stands');
    }
    const next = {
        ...s,
        session: result.session,
        players: result.players,
        deck: result.deck,
        blackjack: result.round,
    };
    if (result.complete) {
        logPhase(next, 'bank turn complete');
    }
    return next;
}
export function completeBankingOnState(state) {
    const s = requireBlackjackState(state);
    if (!s.blackjack) {
        throw new Error('No active Blackjack round');
    }
    if (s.blackjack.status !== 'banking') {
        throw new Error('Not in banking phase');
    }
    const resolved = resolveBlackjackRound(s.session, s.players, s.ledger, s.deck, s.blackjack, s.blackjackSettings, bankrollContextFromState(s));
    log.info('roundComplete', {
        roundNumber: s.session.currentRound,
        outcomes: resolved.round.outcomes,
        resultMessages: resolved.round.resultMessages,
    });
    logPhase({ ...s, blackjack: resolved.round });
    let next = {
        ...s,
        session: resolved.session,
        players: resolved.players,
        ledger: resolved.ledger,
        blackjack: resolved.round,
        tableMeta: {
            ...s.tableMeta,
            awaitingNextRound: true,
            bettingLocked: true,
        },
    };
    next = applyTableGameEndIfNeeded(next);
    if (next.tableMeta.gameStatus === 'ended') {
        next = {
            ...next,
            tableMeta: {
                ...next.tableMeta,
                awaitingNextRound: false,
            },
        };
    }
    return next;
}
/**
 * Server-authoritative play-out of an auto bank turn + settlement. Offline keeps
 * the timed, card-by-card bank-draw animation (driven by a client effect);
 * online resolves the bank in the same action that ended player turns so every
 * client receives one identical settled state and never mutates bank/settlement
 * locally. The resulting state is byte-for-byte equivalent to the offline
 * animation's final frame (same engine functions, same order).
 */
export function resolveBankTurnAuto(state) {
    if (!state.blackjack || !state.deck) {
        return state;
    }
    if (state.blackjackFlowSettings.bankDrawMode !== 'auto') {
        return state;
    }
    let s = state;
    let guard = 0;
    while (s.blackjack?.status === 'bank-turn' && guard < 60) {
        guard += 1;
        s = drawBankCardOnState(s);
    }
    if (s.blackjack?.status === 'banking') {
        s = completeBankingOnState(s);
    }
    return s;
}
export function ensureBlackjackRoundSettled(state) {
    const round = state.blackjack;
    if (!round || round.isSettled) {
        return state;
    }
    if (round.status === 'banking' || round.status === 'bank-turn') {
        return completeBankingOnState(state);
    }
    return state;
}
export function startNextRoundOnState(state) {
    if (state.tableMeta.gameStatus === 'ended') {
        throw new Error('Table game has ended — no further rounds.');
    }
    if (!state.tableMeta.awaitingNextRound) {
        throw new Error('No completed round awaiting Next Round.');
    }
    if (!state.deck) {
        throw new Error('Shoe required to continue.');
    }
    const settled = ensureBlackjackRoundSettled(state);
    log.info('nextRoundClicked', {
        previousRound: settled.session.currentRound,
        shoeStarted: settled.tableMeta.shoeStarted,
        wasSettled: settled.blackjack?.isSettled ?? false,
    });
    const cleared = clearTableUiEphemeral(settled);
    const reset = resetBlackjackRound(cleared.session, cleared.players, cleared.deck);
    return {
        ...cleared,
        session: reset.session,
        players: reset.players,
        deck: reset.deck,
        blackjack: reset.round,
        tableMeta: {
            ...cleared.tableMeta,
            boxStakes: {},
            bettingLocked: false,
            awaitingNextRound: false,
            boxSlots: cleared.tableMeta.boxSlots.map((slot) => slot.nativeAssignedPersonId ? slot : { ...slot, callerPersonId: null }),
        },
    };
}
export function takeInsuranceOnState(state, playerId) {
    const s = requireBlackjackState(state);
    if (!s.blackjack) {
        throw new Error('No active Blackjack round');
    }
    const protocol = getBlackjackProtocolForState(s);
    const offer = getInsuranceOfferForBox(s, s.blackjack, playerId, protocol);
    if (!offer) {
        throw new Error('Insurance not offered for this box');
    }
    if (!offer.canAfford) {
        throw new Error('Not enough chips for insurance');
    }
    const result = takeInsuranceBet(s.session, s.players, s.ledger, s.blackjack, playerId, bankrollContextFromState(s), getBlackjackProtocolForState(s));
    let next = { ...s, session: result.session, ledger: result.ledger, blackjack: result.round };
    if (allInsuranceResolved(next, result.round, getBlackjackProtocolForState(next))) {
        const closed = closeInsuranceOffer(next.session, next.players, result.round);
        next = { ...next, players: closed.players, blackjack: closed.round };
        next = resolvePendingNaturalsAfterDealerPeek(next);
    }
    return next;
}
export function declineInsuranceOnState(state, playerId) {
    const s = requireBlackjackState(state);
    if (!s.blackjack) {
        throw new Error('No active Blackjack round');
    }
    const round = declineInsurance(s.blackjack, playerId);
    let next = { ...s, blackjack: round };
    if (allInsuranceResolved(next, round, getBlackjackProtocolForState(next))) {
        const closed = closeInsuranceOffer(next.session, next.players, round);
        next = { ...next, players: closed.players, blackjack: closed.round };
        next = resolvePendingNaturalsAfterDealerPeek(next);
    }
    return next;
}
export function hitBlackjackOnState(state, handKey) {
    const key = handKey ?? requireActiveHandKey(state);
    return afterPlayerAction(applyHit(state, key));
}
export function standBlackjackOnState(state, handKey) {
    const key = handKey ?? requireActiveHandKey(state);
    return afterPlayerAction(applyStand(state, key));
}
export function doubleDownBlackjackOnState(state, handKey) {
    const key = handKey ?? requireActiveHandKey(state);
    return afterPlayerAction(applyDouble(state, key));
}
export function splitBlackjackOnState(state, handKey) {
    const key = handKey ?? requireActiveHandKey(state);
    return afterPlayerAction(applySplit(state, key));
}
export { takeEvenMoneyOnState, waitForBlackjackPayoutOnState } from './naturalBlackjack';
export function newBlackjackRoundOnState(state) {
    const s = requireBlackjackState(state);
    const result = resetBlackjackRound(s.session, s.players, s.deck);
    log.info('New betting round');
    return {
        ...s,
        session: result.session,
        players: result.players,
        deck: result.deck,
        blackjack: result.round,
    };
}
export function updateBlackjackFlowSettings(state, patch) {
    const merged = normalizeFlowSettings({ ...state.blackjackFlowSettings, ...patch });
    return {
        ...state,
        blackjackFlowSettings: syncDealTimingFromPreset(merged),
    };
}
/** Auto-stand for human callers when play-flow threshold is met. */
export function processPlayFlowAutoStands(state) {
    if (!state.blackjack || !state.deck || state.blackjack.status !== 'player-turns') {
        return state;
    }
    let next = state;
    let guard = 0;
    while (next.blackjack?.status === 'player-turns' && next.blackjack.activeHandKey && guard < 30) {
        guard += 1;
        const handKey = next.blackjack.activeHandKey;
        const hand = next.blackjack.playerHands[handKey];
        if (!hand || hand.actionStatus !== 'acting' || hand.naturalSettled) {
            break;
        }
        if (next.blackjack.evenMoneyOfferHandKey) {
            break;
        }
        const cards = cardsFromIds(next.deck, hand.cardIds.filter(Boolean));
        const { value, isBlackjack } = getBlackjackHandValue(cards);
        if (isBlackjack) {
            break;
        }
        const { playerId } = parseBlackjackHandKey(handKey);
        if (isVirtualPlayer(next.players, playerId)) {
            break;
        }
        const callerId = getCallerPersonIdForBox(next, playerId);
        if (!callerId) {
            break;
        }
        const threshold = autoStandThreshold(getPlayFlowForPerson(next, callerId));
        if (threshold === null) {
            break;
        }
        if (value > 21 || value < threshold) {
            break;
        }
        next = applyStand(next, handKey);
    }
    return next;
}
function afterPlayerAction(state) {
    return syncBankPhaseOnState(processPlayFlowAutoStands(processVirtualTurns(state)));
}
/** Auto-play virtual players deterministically until a real player acts or round advances. */
export function processVirtualTurns(state) {
    if (!state.blackjack || !state.deck || state.session.gameType !== 'blackjack') {
        return state;
    }
    let next = state;
    let guard = 0;
    while (next.blackjack?.status === 'player-turns' &&
        next.blackjack.activeHandKey &&
        guard < 30) {
        guard += 1;
        const handKey = next.blackjack.activeHandKey;
        const { playerId } = parseBlackjackHandKey(handKey);
        if (!isVirtualPlayer(next.players, playerId)) {
            break;
        }
        if (!next.deck) {
            break;
        }
        const action = getVirtualBlackjackAction(next.blackjack, handKey, next.deck);
        if (action === 'hit') {
            next = applyHit(next, handKey);
        }
        else {
            next = applyStand(next, handKey);
        }
    }
    return syncBankPhaseOnState(next);
}
export function advanceBlackjackProtocol(state) {
    if (state.blackjack?.status === 'resolved') {
        return newBlackjackRoundOnState(state);
    }
    return state;
}
export { activePlayerIdFromRound };
