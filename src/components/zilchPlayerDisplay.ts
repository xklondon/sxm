import type { GameState } from '../types';
import type { ZilchGameState } from '../engine/zilch/zilchTypes';
import { loadProfile } from '../storage/profileStorage';

export type ZilchPlayerBoxStatus =
  | 'waiting'
  | 'turn'
  | 'banked'
  | 'zilch'
  | 'winner'
  | 'setup';

function zilchPlayerOrder(gameState: GameState): string[] {
  if (gameState.session.playerIds.length > 0) {
    return gameState.session.playerIds;
  }
  return gameState.tableMeta.boxSlots
    .map((s) => s.playerId)
    .filter((id): id is string => Boolean(id));
}

export function canActOnZilchTurn(gameState: GameState, controllerName: string): boolean {
  const order = zilchPlayerOrder(gameState);
  if (order.length <= 1) {
    return true;
  }
  const currentId = gameState.zilch?.currentPlayerId;
  if (!currentId) {
    return false;
  }
  const player = gameState.players[currentId];
  if (!player) {
    return false;
  }
  const label = player.controllerName?.trim() || player.displayName;
  return label === controllerName.trim();
}

export function resolveZilchController(gameState: GameState): string {
  const profile = loadProfile();
  return profile.name.trim() || gameState.tableMeta.controllerName;
}

export function playerBoxStatus(
  playerId: string,
  zilch: ZilchGameState | null,
): ZilchPlayerBoxStatus {
  if (!zilch) {
    return 'setup';
  }
  if (zilch.phase === 'completed' && zilch.winnerPlayerId === playerId) {
    return 'winner';
  }
  if (zilch.lastZilchPlayerId === playerId) {
    return 'zilch';
  }
  if (zilch.currentPlayerId === playerId) {
    if (zilch.phase === 'zilch') {
      return 'zilch';
    }
    return 'turn';
  }
  return 'waiting';
}

export function statusLabel(status: ZilchPlayerBoxStatus): string {
  switch (status) {
    case 'turn':
      return 'Your turn';
    case 'zilch':
      return 'Zilch';
    case 'winner':
      return 'Winner';
    case 'setup':
      return 'Ready';
    case 'banked':
      return 'Banked';
    default:
      return 'Waiting';
  }
}

/** Seat positions around the central dice table (up to 6 players). */
export function seatPositionClass(index: number, total: number): string {
  if (total <= 1) {
    return 'zilch-seat--solo';
  }
  const positions = ['zilch-seat--top', 'zilch-seat--right', 'zilch-seat--bottom', 'zilch-seat--left'];
  if (total === 2) {
    return index === 0 ? 'zilch-seat--top' : 'zilch-seat--bottom';
  }
  if (total === 3) {
    return ['zilch-seat--top', 'zilch-seat--left', 'zilch-seat--right'][index] ?? 'zilch-seat--bottom';
  }
  return positions[index % positions.length] ?? 'zilch-seat--bottom';
}

/** Per-die throw trajectory (visual only). */
export function dieThrowStyle(
  index: number,
  seed: number,
): Record<string, string> {
  const angle = (index / 6) * Math.PI * 2 + seed * 0.7;
  const startX = Math.cos(angle) * 42;
  const startY = Math.sin(angle) * 28 + 36;
  const endX = (index % 3) * 52 - 52 + (seed % 17) - 8;
  const endY = (Math.floor(index / 3) % 2) * 40 - 12 + (seed % 11);
  const midX = (startX + endX) / 2 + (seed % 23) - 11;
  const midY = (startY + endY) / 2 - 28 - (seed % 13);
  return {
    '--die-index': String(index),
    '--start-x': `${startX}px`,
    '--start-y': `${startY}px`,
    '--mid-x': `${midX}px`,
    '--mid-y': `${midY}px`,
    '--end-x': `${endX}px`,
    '--end-y': `${endY}px`,
  };
}
