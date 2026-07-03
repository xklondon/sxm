import type { GameState } from '../../types';

import type { BlackjackProtocolPhase } from './protocol';

import { getRemainingCardCount } from '../deck/deck';

import { isBankerReady } from '../session/boxOps';

import { isTableGameActive } from '../session/tableGameEnd';

import { log } from '../../utils/logger';

import { blackjackHandKey } from './handKeys';

import { getBettingPlayerIds } from './helpers';

import { getStakeForBox, hasAnyStakes, isBoxStakeConfirmed } from './stakes';

import { resolvePlayableBoxes } from '../session/playableBoxes';

export type CanDealBlackjackReason =
  | 'allowed'
  | 'owner_not_hydrated'
  | 'viewer_unknown'
  | 'not_table_host'
  | 'game_ended'
  | 'awaiting_next_round'
  | 'banker_not_ready'
  | 'no_shoe'
  | 'betting_locked'
  | 'wrong_phase'
  | 'round_in_play'
  | 'no_playable_boxes'
  | 'place_bets_first';

export interface CanDealBlackjackResult {
  allowed: boolean;
  reason: CanDealBlackjackReason;
  message: string | null;
}

export interface CanDealBlackjackOptions {
  /** First shoe start may shuffle before a deck exists. */
  allowPreShuffle?: boolean;
}

const ENGINE_REASON_MESSAGES: Record<Exclude<CanDealBlackjackReason, 'allowed'>, string> = {
  owner_not_hydrated: 'Table owner not loaded yet.',
  viewer_unknown: 'Cannot identify viewer — only the table host can deal cards.',
  not_table_host: 'Only the table host can deal cards.',
  game_ended: 'Game has ended.',
  awaiting_next_round: 'Start the next round first.',
  banker_not_ready: 'Choose banker first.',
  no_shoe: 'Shuffle the shoe first.',
  betting_locked: 'Dealing in progress.',
  wrong_phase: 'Deal is only allowed during betting.',
  round_in_play: 'Round is already in play.',
  no_playable_boxes: 'Place at least minimum bet to deal.',
  place_bets_first: 'Place bets first.',
};

function engineFail(
  reason: Exclude<CanDealBlackjackReason, 'allowed'>,
  message?: string,
): CanDealBlackjackResult {
  return {
    allowed: false,
    reason,
    message: message ?? ENGINE_REASON_MESSAGES[reason],
  };
}

/** Engine-only deal readiness (host-agnostic). */
export function evaluateBlackjackDealEngine(
  state: GameState,
  options?: CanDealBlackjackOptions,
): CanDealBlackjackResult {
  if (state.tableMeta.gameStatus === 'ended' || !isTableGameActive(state)) {
    return engineFail('game_ended');
  }
  if (state.tableMeta.awaitingNextRound) {
    return engineFail('awaiting_next_round');
  }
  if (!isBankerReady(state)) {
    return engineFail('banker_not_ready');
  }
  const requireDeck = Boolean(state.tableMeta.shoeStarted) || !options?.allowPreShuffle;
  if (requireDeck && !state.deck) {
    return engineFail(
      'no_shoe',
      state.tableMeta.shoeStarted ? 'Shuffle the shoe first.' : 'Press Shuffle to start first.',
    );
  }
  if (state.tableMeta.bettingLocked) {
    return engineFail('betting_locked');
  }
  const phase = getProtocolPhase(state);
  if (phase !== 'betting') {
    return engineFail('wrong_phase');
  }
  if (isRoundInPlay(state)) {
    return engineFail('round_in_play');
  }
  if (!hasEligibleDealBoxes(state)) {
    if (hasAnyStakes(state)) {
      return engineFail('no_playable_boxes');
    }
    return engineFail('place_bets_first');
  }
  return { allowed: true, reason: 'allowed', message: null };
}

/** @deprecated Use evaluateBlackjackDealEngine().message */
export function getDealBlockReason(
  state: GameState,
  options?: CanDealBlackjackOptions,
): string | null {
  return evaluateBlackjackDealEngine(state, options).message;
}



function getProtocolPhase(state: GameState): BlackjackProtocolPhase {

  if (state.tableMeta.awaitingNextRound && state.blackjack?.status === 'resolved') {

    return 'round-complete';

  }

  if (state.blackjack?.insuranceOfferPending) {

    return 'insurance';

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

      return 'round-complete';

    case 'betting':
    default:
      return 'betting';
  }
}



/** Table minimum bet — tableMeta overrides blackjackSettings default (5). */

export function getTableMinimumBet(state: GameState): number {

  const tableMin = state.tableMeta.minimumBet;

  if (typeof tableMin === 'number' && tableMin > 0) {

    return Math.floor(tableMin);

  }

  return state.blackjackSettings.minBet;

}



function isRoundInPlay(state: GameState): boolean {

  const status = state.blackjack?.status;

  return Boolean(status && status !== 'betting' && status !== 'resolved');

}



function buildStakesByBox(state: GameState) {

  return resolvePlayableBoxes(state).map((box) => ({

    boxId: box.boxId,

    slot: state.session.boxSlotNumbers?.[box.boxId] ?? null,

    stake: getStakeForBox(state, box.boxId),

    confirmed: isBoxStakeConfirmed(state, box.boxId),

    activePlayer: box.activePlayer,

    designatedOwner: box.designatedOwner,

  }));

}



/**

 * Single source of truth for which boxes receive cards on Deal Cards.

 * Playable box · confirmed stake >= minimum · round not in play.

 * Caller/box-commander ownership is resolved after deal for player turns only.

 */

export function getEligibleDealBoxes(state: GameState): string[] {

  if (isRoundInPlay(state)) {

    return [];

  }



  const minBet = getTableMinimumBet(state);

  const bankId = state.session.bankPlayerId;

  const eligible = resolvePlayableBoxes(state)
    .map((box) => box.boxId)
    .filter((boxPlayerId) => {
    if (!state.players[boxPlayerId]) {
      return false;
    }
    if (boxPlayerId === bankId || state.players[boxPlayerId]?.role === 'bank') {
      return false;
    }
    if (!isBoxStakeConfirmed(state, boxPlayerId)) {
      return false;
    }
    const stake = getStakeForBox(state, boxPlayerId);
    if (stake < minBet) {
      return false;
    }
    return true;
  });

  const eligibleSet = new Set(eligible);
  const ordered = getBettingPlayerIds(state.session).filter((id) => eligibleSet.has(id));
  for (const id of eligible) {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  }
  return ordered;
}



export function hasEligibleDealBoxes(state: GameState): boolean {

  return getEligibleDealBoxes(state).length > 0;

}



export function isStakeBelowMinimum(state: GameState, boxPlayerId: string): boolean {

  const stake = getStakeForBox(state, boxPlayerId);

  if (stake <= 0) {

    return false;

  }

  return stake < getTableMinimumBet(state);

}



export function canChangeMinimumBet(state: GameState): boolean {

  if (state.tableMeta.bettingLocked) {

    return false;

  }

  const phase = getProtocolPhase(state);

  if (phase !== 'betting') {

    return false;

  }

  const roundStatus = state.blackjack?.status;

  if (roundStatus && roundStatus !== 'betting' && roundStatus !== 'resolved') {

    return false;

  }

  return true;

}



export function setTableMinimumBet(state: GameState, amount: number): GameState {

  if (!canChangeMinimumBet(state)) {

    throw new Error('Minimum bet can only be changed during the betting phase.');

  }

  const minBet = Math.floor(amount);

  if (!Number.isFinite(minBet) || minBet <= 0) {

    throw new Error('Minimum bet must be a positive integer.');

  }

  return {

    ...state,

    tableMeta: { ...state.tableMeta, minimumBet: minBet },

    blackjackSettings: { ...state.blackjackSettings, minBet },

  };

}



export function logDealBlockedAudit(

  state: GameState,

  reason: string | null,

): void {

  const payload = {

    phase: getProtocolPhase(state),

    shoeReady: Boolean(state.deck),

    minBet: getTableMinimumBet(state),

    playableBoxes: resolvePlayableBoxes(state),

    stakesByBox: buildStakesByBox(state),

    eligibleBoxes: getEligibleDealBoxes(state),

    reason,

  };

  log.debug('dealBlockedAudit', payload);
}



export function logDealCardsAudit(

  state: GameState,

  extra?: { blockReason?: string | null },

): void {

  const occupied = resolvePlayableBoxes(state).map((box) => box.boxId);

  const stakesByBox = buildStakesByBox(state);

  const eligibleBoxes = getEligibleDealBoxes(state);

  const payload = {

    phase: getProtocolPhase(state),

    shoeReady: Boolean(state.deck),

    cardsRemaining: state.deck ? getRemainingCardCount(state.deck) : 0,

    occupiedBoxes: occupied,

    stakesByBox,

    minBet: getTableMinimumBet(state),

    eligibleBoxes,

    blockReason: extra?.blockReason ?? null,

    dealPlan: eligibleBoxes.map((id) => blackjackHandKey(id, 0)),

  };



  log.info('dealCardsAudit', payload);

  if (extra?.blockReason) {

    logDealBlockedAudit(state, extra.blockReason);

  }

}

