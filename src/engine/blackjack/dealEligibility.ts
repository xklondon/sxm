import type { GameState } from '../../types';

import type { BlackjackProtocolPhase } from './protocol';

import { getRemainingCardCount } from '../deck/deck';

import { isBankerReady } from '../session/boxOps';

import { getCallerPersonIdForBox } from '../session/playerAssignment';

import { log } from '../../utils/logger';

import { blackjackHandKey } from './handKeys';

import { getBettingPlayerIds } from './helpers';

import { getStakeForBox, hasAnyStakes, isBoxStakeConfirmed } from './stakes';



function getOccupiedBoxPlayerIds(state: GameState): string[] {

  return state.tableMeta.boxSlots

    .map((s) => s.playerId)

    .filter((id): id is string => id !== null);

}



/** All box player ids with a table position or open stake. */

function getPlayableBoxPlayerIds(state: GameState): string[] {

  const ids = new Set<string>();

  for (const id of getOccupiedBoxPlayerIds(state)) {

    ids.add(id);

  }

  for (const boxId of Object.keys(state.tableMeta.boxStakes)) {

    if (state.players[boxId]) {

      ids.add(boxId);

    }

  }

  return [...ids];

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

      return 'betting';

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

  return getPlayableBoxPlayerIds(state).map((boxId) => ({

    boxId,

    slot: state.session.boxSlotNumbers?.[boxId] ?? null,

    stake: getStakeForBox(state, boxId),

    confirmed: isBoxStakeConfirmed(state, boxId),

    callerPersonId: getCallerPersonIdForBox(state, boxId),

  }));

}



/**

 * Single source of truth for which boxes receive cards on Deal Cards.

 * Playable box · confirmed stake >= minimum · valid caller · round not in play.

 */

export function getEligibleDealBoxes(state: GameState): string[] {

  if (isRoundInPlay(state)) {

    return [];

  }



  const minBet = getTableMinimumBet(state);

  const eligible = getPlayableBoxPlayerIds(state).filter((boxPlayerId) => {
    if (!state.players[boxPlayerId]) {
      return false;
    }
    if (!isBoxStakeConfirmed(state, boxPlayerId)) {
      return false;
    }
    const stake = getStakeForBox(state, boxPlayerId);
    if (stake < minBet) {
      return false;
    }
    return Boolean(getCallerPersonIdForBox(state, boxPlayerId));
  });

  const eligibleSet = new Set(eligible);
  return getBettingPlayerIds(state.session).filter((id) => eligibleSet.has(id));
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

    boxes: getOccupiedBoxPlayerIds(state),

    stakesByBox: buildStakesByBox(state),

    eligibleBoxes: getEligibleDealBoxes(state),

    reason,

  };

  log.info('dealBlockedAudit', payload);

  console.log('[SXMCards] dealBlockedAudit', payload);

}



export function getDealBlockReason(state: GameState): string | null {

  if (!isBankerReady(state)) {

    return 'Choose banker first.';

  }

  if (!state.deck) {

    return state.tableMeta.shoeStarted

      ? 'Shuffle the shoe first.'

      : 'Press Shuffle to start first.';

  }

  if (state.tableMeta.bettingLocked) {

    return 'Dealing in progress.';

  }

  const phase = getProtocolPhase(state);

  if (phase !== 'betting') {

    return null;

  }

  if (isRoundInPlay(state)) {

    return null;

  }

  if (!hasEligibleDealBoxes(state)) {

    if (hasAnyStakes(state)) {

      return 'Place at least minimum bet to deal.';

    }

    return 'Place bets first.';

  }

  return null;

}



export function logDealCardsAudit(

  state: GameState,

  extra?: { blockReason?: string | null },

): void {

  const reason = extra?.blockReason ?? getDealBlockReason(state);

  const occupied = getOccupiedBoxPlayerIds(state);

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

    blockReason: reason,

    dealPlan: eligibleBoxes.map((id) => blackjackHandKey(id, 0)),

  };



  log.info('dealCardsAudit', payload);

  if (reason) {

    logDealBlockedAudit(state, reason);

  }

}


