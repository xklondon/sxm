import { parseBlackjackHandKey, listHandKeysForPlayer } from '../blackjack/handKeys';
import { getStakeForBox, getBoxesWithStakes } from '../blackjack/stakes';
import { getCallerPersonIdForBox } from './playerAssignment';

function resolveExposureBankrollOwnerId(state, boxPlayerId) {
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

export function getStakeContributorPersonIds(state, boxPlayerId) {
  const stake = state.tableMeta.boxStakes[boxPlayerId];
  if (!stake || stake.amount <= 0) {
    return [];
  }
  if (stake.stakerPersonIds && stake.stakerPersonIds.length > 0) {
    return [...new Set(stake.stakerPersonIds)];
  }
  const caller = stake.callerPersonId ?? getCallerPersonIdForBox(state, boxPlayerId);
  if (caller) {
    return [caller];
  }
  const owner = resolveExposureBankrollOwnerId(state, boxPlayerId);
  return owner ? [owner] : [];
}

function boxHasInRoundBet(state, boxPlayerId) {
  const round = state.blackjack;
  if (!round?.playerHands) {
    return false;
  }
  return listHandKeysForPlayer(round.playerHands, boxPlayerId).some(
    (key) => (round.playerHands[key]?.currentBet ?? 0) > 0,
  );
}

export function isBoxExposureAttributedToPerson(state, boxPlayerId, personId) {
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

export function getBoxIdsWithCommittedExposureForPerson(state, personId) {
  const candidates = new Set(getBoxesWithStakes(state));
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

export function getOpenStakeExposureForPerson(state, personId) {
  if (state.tableMeta.bettingLocked) {
    return 0;
  }
  return getBoxIdsWithCommittedExposureForPerson(state, personId).reduce(
    (sum, boxId) => sum + getStakeForBox(state, boxId),
    0,
  );
}

export function getInRoundBetExposureForPerson(state, personId) {
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

export function getTotalCommittedExposureForPerson(state, personId) {
  const round = state.blackjack;
  if (state.tableMeta.awaitingNextRound || round?.isSettled || round?.status === 'resolved') {
    return 0;
  }

  const open = getOpenStakeExposureForPerson(state, personId);
  const inRound = getInRoundBetExposureForPerson(state, personId);

  if (!state.tableMeta.bettingLocked) {
    if (open > 0) {
      return open;
    }
    return inRound;
  }

  return inRound;
}
