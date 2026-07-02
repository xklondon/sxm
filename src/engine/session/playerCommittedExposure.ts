import type { GameState } from '../../types';
import { parseBlackjackHandKey, listHandKeysForPlayer } from '../blackjack/handKeys';
import {
  getStakeForBox,
  getBoxesWithStakes,
  getStakerAmountForPersonOnBox,
  resolveStakerAmountsByPersonId,
} from '../blackjack/stakes';
import { getCallerPersonIdForBox } from './playerAssignment';

function resolveExposureBankrollOwnerId(state: GameState, boxPlayerId: string): string {
  const slot = state.tableMeta.boxSlots.find((s) => s.playerId === boxPlayerId);
  if (slot?.bankrollOwnerId) {
    return slot.bankrollOwnerId;
  }
  const player = state.players[boxPlayerId];
  if (player?.bankrollOwnerId) {
    return player.bankrollOwnerId;
  }
  return boxPlayerId;
}

/** Person ids who committed chips on this box (staker list only — not decision caller). */
export function getStakeContributorPersonIds(
  state: GameState,
  boxPlayerId: string,
): string[] {
  const stake = state.tableMeta.boxStakes[boxPlayerId];
  if (!stake || stake.amount <= 0) {
    return [];
  }
  try {
    const amounts = resolveStakerAmountsByPersonId(state, boxPlayerId, stake);
    return Object.keys(amounts).filter((id) => (amounts[id] ?? 0) > 0);
  } catch {
    return [];
  }
}

function boxHasInRoundBet(state: GameState, boxPlayerId: string): boolean {
  const round = state.blackjack;
  if (!round?.playerHands) {
    return false;
  }
  return listHandKeysForPlayer(round.playerHands, boxPlayerId).some(
    (key) => (round.playerHands[key]?.currentBet ?? 0) > 0,
  );
}

/** True when open or in-round exposure on this box belongs to the person. */
export function isBoxExposureAttributedToPerson(
  state: GameState,
  boxPlayerId: string,
  personId: string,
): boolean {
  const openStake = getStakeForBox(state, boxPlayerId);
  if (openStake > 0 && !state.tableMeta.bettingLocked) {
    return getStakeContributorPersonIds(state, boxPlayerId).includes(personId);
  }

  if (!boxHasInRoundBet(state, boxPlayerId)) {
    if (openStake > 0) {
      return getStakeContributorPersonIds(state, boxPlayerId).includes(personId);
    }
    return false;
  }

  const stake = state.tableMeta.boxStakes[boxPlayerId];
  if (stake?.stakerPersonIds?.length) {
    return stake.stakerPersonIds.includes(personId);
  }
  if (stake?.callerPersonId) {
    return (
      stake.callerPersonId === personId ||
      (stake.stakerPersonIds?.includes(personId) ?? false)
    );
  }

  const caller = getCallerPersonIdForBox(state, boxPlayerId);
  if (caller) {
    return caller === personId;
  }

  return resolveExposureBankrollOwnerId(state, boxPlayerId) === personId;
}

/** Boxes whose committed chips count toward this person's exposure. */
export function getBoxIdsWithCommittedExposureForPerson(
  state: GameState,
  personId: string,
): string[] {
  const candidates = new Set<string>(getBoxesWithStakes(state));
  for (const slot of state.tableMeta.boxSlots) {
    if (slot.playerId) {
      candidates.add(slot.playerId);
    }
  }
  const round = state.blackjack;
  if (round?.playerHands) {
    for (const handKey of Object.keys(round.playerHands)) {
      if ((round.playerHands[handKey]?.currentBet ?? 0) > 0) {
        candidates.add(parseBlackjackHandKey(handKey).playerId);
      }
    }
  }
  return [...candidates].filter((boxId) =>
    isBoxExposureAttributedToPerson(state, boxId, personId),
  );
}

export function getOpenStakeExposureForPerson(state: GameState, personId: string): number {
  if (state.tableMeta.bettingLocked) {
    return 0;
  }
  return getBoxesWithStakes(state).reduce(
    (sum, boxId) => sum + getStakerAmountForPersonOnBox(state, boxId, personId),
    0,
  );
}

export function getInRoundBetExposureForPerson(state: GameState, personId: string): number {
  const round = state.blackjack;
  if (!round?.playerHands) {
    return 0;
  }
  return getBoxIdsWithCommittedExposureForPerson(state, personId).reduce((sum, boxId) => {
    return (
      sum +
      listHandKeysForPlayer(round.playerHands, boxId).reduce(
        (handSum, key) => handSum + (round.playerHands[key]?.currentBet ?? 0),
        0,
      )
    );
  }, 0);
}

/** Canonical committed exposure for tray + This Table (open stakes or in-round bets). */
export function getTotalCommittedExposureForPerson(
  state: GameState,
  personId: string,
): number {
  if (state.tableMeta.bettingLocked) {
    return getInRoundBetExposureForPerson(state, personId);
  }

  const open = getOpenStakeExposureForPerson(state, personId);
  if (open > 0) {
    return open;
  }

  const round = state.blackjack;
  if (
    state.tableMeta.awaitingNextRound ||
    round?.isSettled ||
    round?.status === 'resolved'
  ) {
    return 0;
  }

  return getInRoundBetExposureForPerson(state, personId);
}
