import type { GameState } from '../../types';
import { parseBlackjackHandKey } from '../blackjack/handKeys';
import { getStakeForBox } from '../blackjack/stakes';
import { getNativeAssignedPersonForSlot } from './playerAssignment';

export type BoxRoundCommanderReason =
  | 'designated-owner-staked'
  | 'first-staker-on-designated-box'
  | 'first-staker-on-free-box'
  | null;

export interface BoxRoundCommanderResult {
  commanderPersonId: string | null;
  reason: BoxRoundCommanderReason;
  coBettorPersonIds: string[];
}

function slotForBox(state: GameState, boxPlayerId: string) {
  return state.tableMeta.boxSlots.find((s) => s.playerId === boxPlayerId);
}

function designatedOwnerPersonId(state: GameState, boxPlayerId: string): string | null {
  const slot = slotForBox(state, boxPlayerId);
  if (slot?.nativeAssignedPersonId) {
    return slot.nativeAssignedPersonId;
  }
  const slotNum = state.session.boxSlotNumbers?.[boxPlayerId];
  if (slotNum) {
    return getNativeAssignedPersonForSlot(state, slotNum);
  }
  return null;
}

/** True only when the box has a dealt/in-play hand — not betting placeholders. */
function boxHasInRoundHand(state: GameState, boxPlayerId: string): boolean {
  const round = state.blackjack;
  if (!round) {
    return false;
  }
  const status = round.status;
  if (status === 'betting' || status === 'resolved') {
    return false;
  }
  return Object.entries(round.playerHands).some(([handKey, hand]) => {
    if (parseBlackjackHandKey(handKey).playerId !== boxPlayerId) {
      return false;
    }
    return hand.cardIds.length > 0 || hand.currentBet > 0;
  });
}

function reasonForCommander(
  designatedOwner: string | null,
  commanderPersonId: string,
  stakerPersonIds: string[],
): BoxRoundCommanderReason {
  if (designatedOwner && stakerPersonIds.includes(designatedOwner) && commanderPersonId === designatedOwner) {
    return 'designated-owner-staked';
  }
  if (designatedOwner) {
    return 'first-staker-on-designated-box';
  }
  return 'first-staker-on-free-box';
}

/**
 * Canonical per-round box commander — who may call hit/stand/split/double/insurance for this box.
 * Permanent native assignment is separate (`assignedBoxByPersonId` / `nativeAssignedPersonId`).
 */
export function resolveBoxRoundCommander(
  state: GameState,
  boxPlayerId: string,
): BoxRoundCommanderResult {
  const designatedOwner = designatedOwnerPersonId(state, boxPlayerId);
  const stake = state.tableMeta.boxStakes[boxPlayerId];
  const stakerPersonIds = [...new Set(stake?.stakerPersonIds ?? [])];
  const hasOpenStake = getStakeForBox(state, boxPlayerId) > 0;
  const inRound = boxHasInRoundHand(state, boxPlayerId);

  if (!hasOpenStake && !inRound) {
    return { commanderPersonId: null, reason: null, coBettorPersonIds: [] };
  }

  const slot = slotForBox(state, boxPlayerId);
  const lockedCaller =
    slot?.callerPersonId && (state.tableMeta.bettingLocked || inRound)
      ? slot.callerPersonId
      : null;

  if (designatedOwner && stakerPersonIds.includes(designatedOwner)) {
    return {
      commanderPersonId: designatedOwner,
      reason: 'designated-owner-staked',
      coBettorPersonIds: stakerPersonIds.filter((id) => id !== designatedOwner),
    };
  }

  const firstStaker = lockedCaller ?? stake?.callerPersonId ?? stakerPersonIds[0] ?? null;

  if (!firstStaker) {
    return { commanderPersonId: null, reason: null, coBettorPersonIds: [] };
  }

  return {
    commanderPersonId: firstStaker,
    reason: reasonForCommander(designatedOwner, firstStaker, stakerPersonIds),
    coBettorPersonIds: stakerPersonIds.filter((id) => id !== firstStaker),
  };
}
