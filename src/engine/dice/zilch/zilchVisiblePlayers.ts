import type { GameState } from '../../../types';
import { listPlayableZilchPlayerIds } from './zilchTurnAuthority';

export interface ZilchVisiblePlayer {
  playerId: string;
  name: string;
  boxLabel: string | null;
  isVirtual: boolean;
}

function isExcludedZilchSeat(state: GameState, playerId: string): boolean {
  if (!playerId) {
    return true;
  }
  const bankId = state.session.bankPlayerId;
  if (bankId && playerId === bankId) {
    return true;
  }
  const player = state.players[playerId];
  if (!player) {
    return true;
  }
  if (player.role === 'bank') {
    return true;
  }
  const ownerId = state.tableMeta.ownerPersonId;
  if (ownerId && playerId === ownerId && player.role !== 'box') {
    return true;
  }
  return false;
}

function resolveSeatLabels(state: GameState, playerId: string): Omit<ZilchVisiblePlayer, 'playerId'> {
  const player = state.players[playerId]!;
  const slot = state.tableMeta.boxSlots.find((s) => s.playerId === playerId);
  const boxLabel = slot?.slotNumber ? `Box ${slot.slotNumber}` : null;
  const isVirtual = player.playerType === 'virtual';
  let name = player.displayName.trim() || playerId;

  if (boxLabel && name === boxLabel && player.controllerName?.trim()) {
    name = player.controllerName.trim();
  }

  const showBoxLabel = Boolean(boxLabel && boxLabel !== name);

  return {
    name,
    boxLabel: showBoxLabel ? boxLabel : null,
    isVirtual,
  };
}

/** One canonical visible seat per playable Zilch player — no bank, owner shell, or duplicate ids. */
export function getVisibleZilchPlayers(state: GameState): ZilchVisiblePlayer[] {
  const playableIds = listPlayableZilchPlayerIds(state);
  const seen = new Set<string>();
  const visible: ZilchVisiblePlayer[] = [];

  for (const playerId of playableIds) {
    if (seen.has(playerId) || isExcludedZilchSeat(state, playerId)) {
      continue;
    }
    seen.add(playerId);
    visible.push({
      playerId,
      ...resolveSeatLabels(state, playerId),
    });
  }

  return visible;
}
