import type { GameState } from '../../types';
import type { BlackjackFlowSettings } from './flowSettings';
import { normalizeFlowSettings, syncDealTimingFromPreset } from './flowSettings';
import { lockProtocolOnState, getBlackjackProtocolForState } from './protocolState';
import {
  createBlackjackRound,
  doubleDownBlackjackPlayer,
  hitBlackjackPlayer,
  placeBlackjackBet,
  resetBlackjackRound,
  resolveBlackjackRound,
  splitBlackjackPlayer,
  standBlackjackPlayer,
  applyBlackjackToGameState,
} from './round';
import {
  beginInitialDeal,
  dealNextInitialCard,
} from './initialDeal';
import {
  takeInsuranceBet,
  declineInsurance,
  closeInsuranceOffer,
  allInsuranceResolved,
  advanceInsurancePhaseIfComplete,
  getInsuranceFundingBlockReason,
  getInsuranceOfferForBox,
  getInsuranceDecisionPersonIdForBox,
  getPendingInsuranceBoxIdsForPerson,
} from './insurance';
import { drawSingleBankCard, enterBankingIfComplete } from './bankTurn';
import { activePlayerIdFromRound, getVirtualBlackjackAction, isVirtualPlayer } from './virtual';
import { parseBlackjackHandKey, blackjackHandKey } from './handKeys';
import { log } from '../../utils/logger';
import {
  syncConfirmedBetsToRound,
  getEligibleDealBoxes,
  getBlackjackProtocolPhase,
  getStakeForBox,
  getActiveHandKeysForDeal,
  logConfirmedBetsBeforeCards,
  logConfirmBet,
  logDealPlan,
  logDealSanity,
  ensureBettingRoundHands,
} from './protocol';
import {
  getTableMinimumBet,
} from './dealEligibility';
import {
  hasAnyStakes,
  resolveStakerAmountsByPersonId,
} from './stakes';
import { bankrollContextFromState } from '../session/bankroll';
import { applyTableGameEndIfNeeded } from '../session/tableGameEnd';
import { evaluateBlackjackGameOver } from './gameOverEvaluation';
import { incrementBlackjackCountsOnSettlement } from '../session/tableBlackjackStats';
import { syncCallersForDeal } from '../session/playerAssignment';
import { resetBlackjackRoundOwnership } from '../session/resetBlackjackRoundOwnership';
import { clearTableUiEphemeral } from '../session/inviteJoin';
import { settleBustHandOnState } from './bustSettlement';
import { shuffleGameDeck } from '../deck';
import { resolveNaturalsAfterInitialDeal, resolvePendingNaturalsAfterDealerPeek } from './naturalBlackjack';
import { applyShortStackMinBetTopUpOnState } from './shortStackTopUp';
import { getCallerPersonIdForBox } from '../session/playerAssignment';
import { getPlayFlowForPerson, shouldAutoStopPlayerHandForState } from './playFlow';
import { cardsFromIds } from './hand';
import { getBlackjackHandValue } from './hand';

function requireBlackjackState(state: GameState): GameState & { deck: NonNullable<GameState['deck']> } {
  if (state.session.gameType !== 'blackjack') {
    throw new Error('Not a Blackjack game');
  }
  if (!state.deck) {
    throw new Error('Shuffle the deck before playing Blackjack');
  }
  return state as GameState & { deck: NonNullable<GameState['deck']> };
}

function requireActiveHandKey(state: GameState): string {
  if (!state.blackjack?.activeHandKey) {
    throw new Error('No active hand');
  }
  return state.blackjack.activeHandKey;
}

function logPhase(state: GameState, detail?: string): void {
  const status = state.blackjack?.status ?? 'none';
  log.info(`Phase: ${status}${detail ? ` — ${detail}` : ''}`);
}

function applyHit(state: GameState, handKey: string): GameState {
  const s = requireBlackjackState(state);
  if (!s.blackjack) {
    throw new Error('No active Blackjack round');
  }
  const beforeHitCards = [...(s.blackjack.playerHands[handKey]?.cardIds ?? [])].filter(Boolean);
  const result = hitBlackjackPlayer(
    s.session,
    s.players,
    s.deck,
    s.blackjack,
    handKey,
  );
  const afterHitCards = [...(result.round.playerHands[handKey]?.cardIds ?? [])].filter(Boolean);
  const drawnCard = afterHitCards.length > beforeHitCards.length ? afterHitCards[afterHitCards.length - 1] : null;
  log.debug('Player action: hit', {
    handKey,
    activeHandKey: result.round.activeHandKey,
    beforeHitCards,
    drawnCard,
    afterHitCards,
  });
  let next = applyBlackjackToGameState(s, result);
  const bustedHand = next.blackjack?.playerHands[handKey];
  if (bustedHand?.actionStatus === 'busted') {
    next = settleBustHandOnState(next, handKey);
  }
  return next;
}

function applyStand(state: GameState, handKey: string): GameState {
  const s = requireBlackjackState(state);
  if (!s.blackjack) {
    throw new Error('No active Blackjack round');
  }
  const beforeStayActiveHandKey = s.blackjack.activeHandKey;
  const result = standBlackjackPlayer(s.session, s.players, s.blackjack, handKey);
  const afterStayNextActiveHandKey = result.round.activeHandKey;
  const nextPhase = result.round.status;
  log.debug('Player action: stand', {
    handKey,
    beforeStayActiveHandKey,
    afterStayNextActiveHandKey,
    nextPhase,
  });
  return applyBlackjackToGameState(s, { ...result, deck: s.deck });
}

function applyDouble(state: GameState, handKey: string): GameState {
  const s = requireBlackjackState(state);
  if (!s.blackjack) {
    throw new Error('No active Blackjack round');
  }
  const result = doubleDownBlackjackPlayer(
    s.session,
    s.players,
    s.ledger,
    s.deck,
    s.blackjack,
    handKey,
    bankrollContextFromState(s),
    s.blackjackSettings,
    getBlackjackProtocolForState(s),
  );
  log.info('Player action: double', { handKey });
  let next = applyBlackjackToGameState(s, result);
  const bustedHand = next.blackjack?.playerHands[handKey];
  if (bustedHand?.actionStatus === 'busted') {
    next = settleBustHandOnState(next, handKey);
  }
  return next;
}

function applySplit(state: GameState, handKey: string): GameState {
  const s = requireBlackjackState(state);
  if (!s.blackjack) {
    throw new Error('No active Blackjack round');
  }
  const result = splitBlackjackPlayer(
    s.session,
    s.players,
    s.ledger,
    s.deck,
    s.blackjack,
    handKey,
    bankrollContextFromState(s),
    s.blackjackSettings,
    getBlackjackProtocolForState(s),
  );
  log.info('Player action: split', { handKey });
  return applyBlackjackToGameState(s, result);
}

export function startBlackjackRound(state: GameState): GameState {
  const s = requireBlackjackState(state);
  const created = createBlackjackRound(s.session, s.players, s.deck);
  log.info('Blackjack round started');
  return {
    ...s,
    ...created,
    blackjack: created.round,
  };
}

export function placeBlackjackBetOnState(
  state: GameState,
  playerId: string,
  amount: number,
  options?: { stakerAmountsByPersonId?: Record<string, number> },
): GameState {
  let s = requireBlackjackState(state);

  if (!s.blackjack || s.blackjack.status === 'resolved') {
    if (s.blackjack?.status === 'resolved') {
      s = requireBlackjackState(newBlackjackRoundOnState(s));
    } else {
      s = requireBlackjackState(startBlackjackRound(s));
    }
  }

  const round = ensureBettingRoundHands(s.blackjack!, s.session);
  const result = placeBlackjackBet(
    s.session,
    s.players,
    s.ledger,
    round,
    playerId,
    amount,
    bankrollContextFromState(s),
    { ...s.blackjackSettings, minBet: getTableMinimumBet(s) },
    options?.stakerAmountsByPersonId
      ? { stakerAmountsByPersonId: options.stakerAmountsByPersonId }
      : undefined,
  );
  log.info('Bet confirmed', { playerId, amount, roundBet: result.round.playerHands[blackjackHandKey(playerId, 0)]?.currentBet });
  const next = { ...s, ...result, blackjack: result.round };
  logConfirmBet(next, playerId, amount);
  return next;
}

export function prepareDealState(state: GameState): GameState {
  log.info('Deal function called', { phase: getBlackjackProtocolPhase(state) });

  let s = syncConfirmedBetsToRound(state);

  if (!s.deck) {
    throw new Error('Shuffle the shoe first.');
  }

  if (!s.blackjack || s.blackjack.status === 'resolved') {
    if (s.blackjack?.status === 'resolved') {
      s = newBlackjackRoundOnState(s);
    } else if (!s.blackjack) {
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
    throw new Error(
      hasAnyStakes(s)
        ? 'Place at least minimum bet to deal.'
        : 'Place bets first.',
    );
  }

  return requireBlackjackState(s);
}

export function dealCardsFromState(state: GameState): GameState {
  logDealSanity(state);
  logConfirmedBetsBeforeCards(state);
  const prepared = prepareDealState(clearTableUiEphemeral(state));
  const plan = getActiveHandKeysForDeal(prepared);
  logDealPlan(plan);
  log.info('Cards deal starting', { mode: prepared.blackjackFlowSettings.initialDealMode, plan });

  let result: GameState;
  const dealMode = prepared.blackjackFlowSettings.initialDealMode;
  if (dealMode === 'instant' || dealMode === 'natural') {
    let next = dealInitialBlackjackOnState(prepared);
    log.info(`Initial deal complete (${dealMode} mode, authoritative)`);
    next = processVirtualTurns(syncBankPhaseOnState(next));
    logPhase(next, 'deal complete');
    result = lockProtocolOnState(next);
  } else {
    result = lockProtocolOnState(beginInitialDealOnState(prepared));
    log.info(`Initial deal begun (${dealMode} mode)`);
  }
  logDealSanity(state, { dealResult: 'ok' });
  return result;
}

export function applyBoxStakesToRound(state: GameState): GameState {
  if (!state.deck) {
    throw new Error('Shuffle the shoe first.');
  }
  if (!hasAnyStakes(state)) {
    throw new Error('Place bets first.');
  }

  let s: GameState = state;

  if (!s.blackjack || s.blackjack.status === 'resolved') {
    if (s.blackjack?.status === 'resolved') {
      s = newBlackjackRoundOnState(s);
    } else {
      s = startBlackjackRound(s);
    }
  }

  for (const boxId of getEligibleDealBoxes(s)) {
    const amount = getStakeForBox(s, boxId);
    if (amount > 0) {
      const stakerAmountsByPersonId = resolveStakerAmountsByPersonId(s, boxId);
      s = placeBlackjackBetOnState(s, boxId, amount, { stakerAmountsByPersonId });
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

export function shuffleToStartOnState(state: GameState): GameState {
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
export function lockBetsAndShuffleOnState(state: GameState): GameState {
  return shuffleToStartOnState(state);
}

export function dealCardsButtonOnState(state: GameState): GameState {
  if (state.tableMeta.bettingLocked) {
    return dealCardsFromState(state);
  }
  const locked = applyBoxStakesToRound(state);
  return dealCardsFromState(locked);
}

export function lockBetsAndStartRoundOnState(state: GameState): GameState {
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

export function shuffleFreshShoeOnState(state: GameState): GameState {
  if (state.tableMeta.bettingLocked) {
    throw new Error('Finish the current round before shuffling.');
  }
  return shuffleGameDeck(state);
}

export function beginInitialDealOnState(state: GameState): GameState {
  const s = prepareDealState(state);
  if (!s.blackjack) {
    throw new Error('Start a Blackjack round first');
  }
  const handKeys = getActiveHandKeysForDeal(s);
  const result = beginInitialDeal(s.session, s.players, s.deck!, s.blackjack, handKeys, s.blackjackSettings);
  log.info('Initial deal started');
  logPhase({ ...s, blackjack: result.round });
  return { ...s, ...result, blackjack: result.round };
}

export function dealNextInitialCardOnState(state: GameState): GameState {
  const s = requireBlackjackState(state);
  if (!s.blackjack) {
    throw new Error('No active Blackjack round');
  }
  const result = dealNextInitialCard(
    s.session,
    s.players,
    s.deck,
    s.blackjack,
    s.blackjackSettings,
    getBlackjackProtocolForState(s),
  );
  log.info('Card dealt (initial)', {
    target: result.step.type === 'box' ? result.step.handKey : 'bank',
    cardId: result.cardId,
  });
  let next: GameState = {
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
export function completeStepwiseInitialDealIfNeeded(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.blackjack?.status === 'initial-deal' && guard < 50) {
    guard += 1;
    next = dealNextInitialCardOnState(next);
  }
  return next;
}

export function dealInitialBlackjackOnState(state: GameState): GameState {
  const s = prepareDealState(state);
  if (!s.blackjack) {
    throw new Error('Start a Blackjack round first');
  }
  const handKeys = getActiveHandKeysForDeal(s);
  const protocol = getBlackjackProtocolForState(s);
  let current = beginInitialDeal(s.session, s.players, s.deck!, s.blackjack, handKeys, s.blackjackSettings);
  let guard = 0;
  while (current.round.status === 'initial-deal' && guard < 50) {
    guard += 1;
    const next = dealNextInitialCard(
      current.session,
      current.players,
      current.deck,
      current.round,
      s.blackjackSettings,
      protocol,
    );
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
  let next: GameState = { ...s, ...current, blackjack: current.round };
  next = resolveNaturalsAfterInitialDeal(next);
  next = applyInsuranceAdvanceOnState(next);
  return processVirtualTurns(syncBankPhaseOnState(next));
}

export function applyInsuranceAdvanceOnState(state: GameState): GameState {
  const round = state.blackjack;
  if (!round?.insuranceOfferPending) {
    return state;
  }
  const protocol = getBlackjackProtocolForState(state);
  const advanced = advanceInsurancePhaseIfComplete(state, round, protocol);
  if (!advanced.closed) {
    return state;
  }
  let next: GameState = { ...state, players: advanced.players, blackjack: advanced.round };
  return resolvePendingNaturalsAfterDealerPeek(next);
}

export function syncBankPhaseOnState(state: GameState): GameState {
  if (!state.blackjack || !state.deck) {
    return state;
  }
  if (state.blackjack.status === 'banking') {
    return state;
  }
  if (state.blackjack.status !== 'bank-turn') {
    return state;
  }
  const round = enterBankingIfComplete(
    state.blackjack,
    state.deck,
    state.blackjackSettings,
    getBlackjackProtocolForState(state),
    state.session,
  );
  if (round.status !== state.blackjack.status) {
    logPhase({ ...state, blackjack: round }, 'bank stands');
  }
  return { ...state, blackjack: round };
}

export function drawBankCardOnState(state: GameState): GameState {
  const s = requireBlackjackState(state);
  if (!s.blackjack) {
    throw new Error('No active Blackjack round');
  }
  const result = drawSingleBankCard(
    s.session,
    s.players,
    s.deck,
    s.blackjack,
    s.blackjackSettings,
    getBlackjackProtocolForState(s),
  );
  if (result.cardId) {
    log.info('Bank draw', { cardId: result.cardId });
  } else {
    log.info('Bank stands');
  }
  const next: GameState = {
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

export function completeBankingOnState(state: GameState): GameState {
  const s = requireBlackjackState(state);
  if (!s.blackjack) {
    throw new Error('No active Blackjack round');
  }
  if (s.blackjack.status !== 'banking') {
    throw new Error('Not in banking phase');
  }
  const resolved = resolveBlackjackRound(
    s.session,
    s.players,
    s.ledger,
    s.deck,
    s.blackjack,
    s.blackjackSettings,
    bankrollContextFromState(s),
  );
  log.info('roundComplete', {
    roundNumber: s.session.currentRound,
    outcomes: resolved.round.outcomes,
    resultMessages: resolved.round.resultMessages,
  });
  logPhase({ ...s, blackjack: resolved.round });
  let next: GameState = {
    ...s,
    session: resolved.session,
    players: resolved.players,
    ledger: resolved.ledger,
    blackjack: resolved.round,
    tableMeta: {
      ...incrementBlackjackCountsOnSettlement(
        { ...s, session: resolved.session },
        resolved.round,
      ),
      awaitingNextRound: true,
      bettingLocked: true,
    },
  };
  next = applyTableGameEndIfNeeded(next);
  const gameOver = evaluateBlackjackGameOver(next);
  if (gameOver.isGameOver) {
    log.info('blackjackGameOver', {
      reason: gameOver.reason,
      winnerPersonId: gameOver.winnerPersonId,
      winnerSide: gameOver.winnerSide,
    });
  }
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
export function resolveBankTurnAuto(state: GameState): GameState {
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

export function ensureBlackjackRoundSettled(state: GameState): GameState {
  const round = state.blackjack;
  if (!round || round.isSettled) {
    return state;
  }
  if (round.status === 'banking' || round.status === 'bank-turn') {
    return completeBankingOnState(state);
  }
  return state;
}

export function startNextRoundOnState(state: GameState): GameState {
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
  const topped = applyShortStackMinBetTopUpOnState(cleared);
  const reset = resetBlackjackRound(topped.session, topped.players, topped.deck);
  const ownershipReset = resetBlackjackRoundOwnership({
    ...topped,
    session: reset.session,
    players: reset.players,
    deck: reset.deck,
    blackjack: reset.round,
    tableMeta: {
      ...topped.tableMeta,
      awaitingNextRound: false,
    },
  });
  return ownershipReset;
}

export function takeInsuranceOnState(state: GameState, playerId: string): GameState {
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
  const bankrollOwnerId = getInsuranceDecisionPersonIdForBox(s, playerId);
  if (!bankrollOwnerId) {
    throw new Error('Insurance not offered for this box');
  }
  const result = takeInsuranceBet(
    s.session,
    s.players,
    s.ledger,
    s.blackjack,
    playerId,
    bankrollContextFromState(s),
    protocol,
    bankrollOwnerId,
  );
  let next: GameState = { ...s, session: result.session, ledger: result.ledger, blackjack: result.round };
  return finishInsurancePhaseIfComplete(next);
}

function finishInsurancePhaseIfComplete(state: GameState): GameState {
  const round = state.blackjack;
  if (!round) {
    return state;
  }
  const protocol = getBlackjackProtocolForState(state);
  if (!allInsuranceResolved(state, round, protocol)) {
    return state;
  }
  const closed = closeInsuranceOffer(state.session, state.players, round);
  let next: GameState = { ...state, players: closed.players, blackjack: closed.round };
  next = resolvePendingNaturalsAfterDealerPeek(next);
  return next;
}

/** Accept insurance on every pending eligible box for this person (one decision). */
export function takeInsuranceForPersonOnState(state: GameState, personId: string): GameState {
  const s = requireBlackjackState(state);
  if (!s.blackjack?.insuranceOfferPending) {
    throw new Error('Insurance is not offered');
  }
  const protocol = getBlackjackProtocolForState(s);
  const boxIds = getPendingInsuranceBoxIdsForPerson(s, s.blackjack, personId, protocol);
  if (boxIds.length === 0) {
    throw new Error('No pending insurance decision for this player');
  }
  let next: GameState = s;
  for (const boxId of boxIds) {
    const offer = getInsuranceOfferForBox(next, next.blackjack!, boxId, protocol);
    if (!offer) {
      continue;
    }
    if (!offer.canAfford) {
      throw new Error('Not enough chips for insurance');
    }
    const ownerId = getInsuranceDecisionPersonIdForBox(next, boxId);
    if (!ownerId || ownerId !== personId) {
      continue;
    }
    const result = takeInsuranceBet(
      next.session,
      next.players,
      next.ledger,
      next.blackjack!,
      boxId,
      bankrollContextFromState(next),
      protocol,
      ownerId,
    );
    next = { ...next, session: result.session, ledger: result.ledger, blackjack: result.round };
  }
  return finishInsurancePhaseIfComplete(next);
}

/** Decline insurance on every pending eligible box for this person (one decision). */
export function declineInsuranceForPersonOnState(state: GameState, personId: string): GameState {
  const s = requireBlackjackState(state);
  if (!s.blackjack?.insuranceOfferPending) {
    throw new Error('Insurance is not offered');
  }
  const protocol = getBlackjackProtocolForState(s);
  const boxIds = getPendingInsuranceBoxIdsForPerson(s, s.blackjack, personId, protocol);
  if (boxIds.length === 0) {
    throw new Error('No pending insurance decision for this player');
  }
  let round = s.blackjack;
  for (const boxId of boxIds) {
    round = declineInsurance(round, boxId);
  }
  const next: GameState = { ...s, blackjack: round };
  return finishInsurancePhaseIfComplete(next);
}

export function declineInsuranceOnState(state: GameState, playerId: string): GameState {
  const s = requireBlackjackState(state);
  if (!s.blackjack) {
    throw new Error('No active Blackjack round');
  }
  const blockReason = getInsuranceFundingBlockReason(s, s.blackjack, playerId);
  const round = declineInsurance(s.blackjack, playerId, blockReason ?? undefined);
  let next: GameState = { ...s, blackjack: round };
  return finishInsurancePhaseIfComplete(next);
}

export function hitBlackjackOnState(state: GameState, handKey?: string): GameState {
  const key = handKey ?? requireActiveHandKey(state);
  return afterPlayerAction(applyHit(state, key));
}

export function standBlackjackOnState(state: GameState, handKey?: string): GameState {
  const key = handKey ?? requireActiveHandKey(state);
  return afterPlayerAction(applyStand(state, key));
}

export function doubleDownBlackjackOnState(state: GameState, handKey?: string): GameState {
  const key = handKey ?? requireActiveHandKey(state);
  return afterPlayerAction(applyDouble(state, key));
}

export function splitBlackjackOnState(state: GameState, handKey?: string): GameState {
  const key = handKey ?? requireActiveHandKey(state);
  return afterPlayerAction(applySplit(state, key));
}

export { takeEvenMoneyOnState, waitForBlackjackPayoutOnState } from './naturalBlackjack';

/** @internal Round object only — use startNextRoundOnState for user next-round. */
export function newBlackjackRoundOnState(state: GameState): GameState {
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

export function updateBlackjackFlowSettings(
  state: GameState,
  patch: Partial<BlackjackFlowSettings>,
): GameState {
  const merged = normalizeFlowSettings({ ...state.blackjackFlowSettings, ...patch });
  return {
    ...state,
    blackjackFlowSettings: syncDealTimingFromPreset(merged),
  };
}

/** Auto-stand for human callers when play-flow threshold is met. */
export function processPlayFlowAutoStands(state: GameState): GameState {
  if (!state.blackjack || !state.deck || state.blackjack.status !== 'player-turns') {
    return state;
  }

  let next = state;
  let guard = 0;

  while (next.blackjack?.status === 'player-turns' && next.blackjack.activeHandKey && guard < 30) {
    guard += 1;
    const handKey = next.blackjack.activeHandKey!;
    const hand = next.blackjack.playerHands[handKey];
    if (!hand || hand.actionStatus !== 'acting' || hand.naturalSettled) {
      break;
    }
    if (next.blackjack.evenMoneyOfferHandKey) {
      break;
    }

    const cards = cardsFromIds(next.deck!, hand.cardIds.filter(Boolean));
    const { isBlackjack } = getBlackjackHandValue(cards);
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

    if (!shouldAutoStopPlayerHandForState(next, handKey, getPlayFlowForPerson(next, callerId), cards)) {
      break;
    }

    next = applyStand(next, handKey);
  }

  return next;
}

function afterPlayerAction(state: GameState): GameState {
  return syncBankPhaseOnState(processPlayFlowAutoStands(processVirtualTurns(state)));
}

/** Auto-play virtual players deterministically until a real player acts or round advances. */
export function processVirtualTurns(state: GameState): GameState {
  if (!state.blackjack || !state.deck || state.session.gameType !== 'blackjack') {
    return state;
  }

  let next = state;
  let guard = 0;

  while (
    next.blackjack?.status === 'player-turns' &&
    next.blackjack.activeHandKey &&
    guard < 30
  ) {
    guard += 1;
    const handKey = next.blackjack.activeHandKey!;
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
    } else {
      next = applyStand(next, handKey);
    }
  }

  return syncBankPhaseOnState(next);
}

export function advanceBlackjackProtocol(state: GameState): GameState {
  if (state.blackjack?.status === 'resolved') {
    return newBlackjackRoundOnState(state);
  }
  return state;
}

export { activePlayerIdFromRound };
