import type { GameState } from '../../types';
import { getStakeForBox } from '../blackjack/stakes';
import { getBettingPlayerIds } from '../blackjack/helpers';
import { resolveBoxRoundCommander } from './boxRoundCommander';

export interface ResolvedPlayableBox {
  boxId: string;
  designatedOwner: string | null;
  activePlayer: string | null;
  passivePlayers: string[];
}

function collectBoxPlayerIds(state: GameState): string[] {
  const ids = new Set<string>();
  for (const slot of state.tableMeta.boxSlots) {
    if (slot.playerId) {
      ids.add(slot.playerId);
    }
  }
  for (const boxId of Object.keys(state.tableMeta.boxStakes)) {
    if (state.players[boxId] && getStakeForBox(state, boxId) > 0) {
      ids.add(boxId);
    }
  }
  return [...ids];
}

function designatedOwnerPersonId(state: GameState, boxPlayerId: string): string | null {
  const slot = state.tableMeta.boxSlots.find((s) => s.playerId === boxPlayerId);
  return slot?.nativeAssignedPersonId ?? null;
}

/**
 * Canonical per-box round ownership — who commands the box vs passive co-bettors.
 * Deal authority and player-turn controls read this; nothing else recomputes it.
 */
export function resolvePlayableBoxes(state: GameState): ResolvedPlayableBox[] {
  return collectBoxPlayerIds(state).map((boxId) => {
    const { commanderPersonId, coBettorPersonIds } = resolveBoxRoundCommander(state, boxId);
    const stake = state.tableMeta.boxStakes[boxId];
    const stakerPersonIds = [...new Set(stake?.stakerPersonIds ?? [])];
    const activePlayer = commanderPersonId;
    const passiveFromStakers = stakerPersonIds.filter((id) => id !== activePlayer);
    const passivePlayers = [
      ...new Set([...coBettorPersonIds, ...passiveFromStakers]),
    ].filter((id) => id !== activePlayer);

    return {
      boxId,
      designatedOwner: designatedOwnerPersonId(state, boxId),
      activePlayer,
      passivePlayers,
    };
  });
}

/** Slot-ordered box ids that currently have an open stake. */
export function getPlayableBoxIdsWithStake(state: GameState): string[] {
  const withStake = resolvePlayableBoxes(state)
    .map((box) => box.boxId)
    .filter((boxId) => getStakeForBox(state, boxId) > 0);
  const withStakeSet = new Set(withStake);
  const ordered = getBettingPlayerIds(state.session).filter((id) => withStakeSet.has(id));
  for (const id of withStake) {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  }
  return ordered;
}
