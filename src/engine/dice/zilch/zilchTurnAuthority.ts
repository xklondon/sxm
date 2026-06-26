import type { GameState } from '../../../types';

function isVirtualBackedBoxShell(state: GameState, playerId: string): boolean {
  const player = state.players[playerId];
  if (!player || player.role !== 'box') {
    return false;
  }
  const ownerId = player.bankrollOwnerId;
  if (!ownerId) {
    return false;
  }
  return state.players[ownerId]?.playerType === 'virtual';
}

function isOwnerBankrollShell(state: GameState, playerId: string): boolean {
  const player = state.players[playerId];
  if (!player || player.role !== 'box') {
    return false;
  }
  const ownerId = state.tableMeta.ownerPersonId;
  return Boolean(ownerId && player.bankrollOwnerId === ownerId);
}

function orderPlayableZilchPlayerIds(state: GameState, ids: string[]): string[] {
  const isPractice = state.tableMeta.tableMode !== 'challenge';
  if (!isPractice) {
    const ownerId = state.tableMeta.ownerPersonId;
    if (!ownerId || !ids.includes(ownerId)) {
      return ids;
    }
    return [ownerId, ...ids.filter((id) => id !== ownerId)];
  }
  const hostBoxId = ids.find((id) => isOwnerBankrollShell(state, id));
  const virtuals = ids.filter((id) => state.players[id]?.playerType === 'virtual');
  const ordered: string[] = [];
  if (hostBoxId) {
    ordered.push(hostBoxId);
  }
  for (const id of virtuals) {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  }
  for (const id of ids) {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  }
  return ordered;
}

/** Zilch seats that can take turns — excludes bank bot, owner shell, and duplicate box aliases. */
export function listPlayableZilchPlayerIds(state: GameState): string[] {
  const bankId = state.session.bankPlayerId;
  const isPractice = state.tableMeta.tableMode !== 'challenge';
  const rawIds =
    (state.session?.playerIds?.length ?? 0) > 0
      ? state.session.playerIds
      : (state.tableMeta?.boxSlots ?? [])
          .map((slot) => slot.playerId)
          .filter((id): id is string => Boolean(id));

  const playable = rawIds.filter((id) => {
    if (!id || id === bankId) {
      return false;
    }
    const player = state.players[id];
    if (!player) {
      return false;
    }
    if (player.role === 'bank') {
      return false;
    }
    const ownerId = state.tableMeta.ownerPersonId;
    if (player.playerType === 'virtual') {
      return isPractice;
    }
    if (isPractice) {
      if (ownerId && id === ownerId && player.role !== 'box') {
        return false;
      }
      if (player.role === 'box') {
        return (
          isOwnerBankrollShell(state, id) && !isVirtualBackedBoxShell(state, id)
        );
      }
      return false;
    }
    if (player.role === 'box') {
      return false;
    }
    return player.role === 'person' && player.playerType === 'real';
  });

  return orderPlayableZilchPlayerIds(state, playable);
}

/** Joined real opponents in challenge (excludes host). Pending invites do not count. */
export function countZilchChallengeOpponents(state: GameState): number {
  if (state.tableMeta.tableMode !== 'challenge') {
    return 0;
  }
  const ownerId = state.tableMeta.ownerPersonId;
  return listPlayableZilchPlayerIds(state).filter((id) => id !== ownerId).length;
}

/** Challenge needs host plus at least one joined real opponent before randomising starter. */
export function canBeginZilchChallenge(state: GameState): boolean {
  if (state.tableMeta.tableMode !== 'challenge') {
    return true;
  }
  return countZilchChallengeOpponents(state) >= 1;
}

export function isVirtualZilchPlayer(state: GameState, playerId: string): boolean {
  return state.players[playerId]?.playerType === 'virtual';
}

export function isTableHostPerson(state: GameState, personId: string): boolean {
  const ownerId = state.tableMeta.ownerPersonId;
  return Boolean(ownerId && ownerId === personId);
}

/** Whether `personId` may dispatch actions for `playerId` on the current Zilch turn. */
export function canPersonControlZilchPlayer(
  state: GameState,
  personId: string,
  playerId: string,
): boolean {
  if (!personId || !playerId) {
    return false;
  }
  if (personId === playerId) {
    return true;
  }

  const player = state.players[playerId];
  if (!player) {
    return false;
  }

  if (player.playerType === 'virtual' && isTableHostPerson(state, personId)) {
    return true;
  }

  const ownerId = state.tableMeta.ownerPersonId;
  const isPractice = state.tableMeta.tableMode !== 'challenge';
  const playable = listPlayableZilchPlayerIds(state);
  if (isPractice && ownerId && personId === ownerId && playable.includes(playerId)) {
    return true;
  }

  const person = state.players[personId];
  if (person && player.playerType !== 'virtual') {
    const personLabel = (person.controllerName?.trim() || person.displayName || '').toLowerCase();
    const playerLabel = (player.controllerName?.trim() || player.displayName || '').toLowerCase();
    if (personLabel && personLabel === playerLabel) {
      return true;
    }
  }

  return false;
}

export function canPersonActOnZilchTurn(state: GameState, personId: string | null): boolean {
  const currentId = state.zilch?.currentPlayerId;
  if (!currentId) {
    return false;
  }
  const playable = listPlayableZilchPlayerIds(state);
  if (playable.length <= 1) {
    return true;
  }
  if (!personId) {
    return false;
  }

  const ownerId = state.tableMeta.ownerPersonId;
  const isPractice = state.tableMeta.tableMode !== 'challenge';
  if (isPractice && ownerId && personId === ownerId && playable.includes(currentId)) {
    return true;
  }

  return canPersonControlZilchPlayer(state, personId, currentId);
}

/** Offline/local fallback when only controller display name is known. */
export function canControllerActOnZilchTurn(state: GameState, controllerName: string): boolean {
  const currentId = state.zilch?.currentPlayerId;
  if (!currentId) {
    return false;
  }
  const playable = listPlayableZilchPlayerIds(state);
  if (playable.length <= 1) {
    return true;
  }
  const player = state.players[currentId];
  if (!player) {
    return false;
  }
  if (player.playerType === 'virtual') {
    const hostName = state.tableMeta.controllerName?.trim() || state.tableMeta.owner?.ownerName?.trim();
    return Boolean(hostName && controllerName.trim() === hostName);
  }
  const label = player.controllerName?.trim() || player.displayName;
  return label === controllerName.trim();
}
