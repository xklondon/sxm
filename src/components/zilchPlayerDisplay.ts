import type { GameState } from '../types';
import type { ZilchGameState } from '../engine/zilch/zilchTypes';
import {
  canControllerActOnZilchTurn,
  canPersonActOnZilchTurn,
  listPlayableZilchPlayerIds,
} from '../engine/dice/zilch/zilchTurnAuthority';
import { loadProfile } from '../storage/profileStorage';

export type ZilchPlayerBoxStatus =
  | 'waiting'
  | 'turn'
  | 'banked'
  | 'zilch'
  | 'winner'
  | 'setup';

function zilchPlayerOrder(gameState: GameState): string[] {
  const playable = listPlayableZilchPlayerIds(gameState);
  if (playable.length > 0) {
    return playable;
  }
  return gameState.tableMeta.boxSlots
    .map((s) => s.playerId)
    .filter((id): id is string => Boolean(id));
}

export function canActOnZilchTurn(
  gameState: GameState,
  controllerName: string,
  viewerPersonId?: string | null,
): boolean {
  const order = zilchPlayerOrder(gameState);
  if (order.length <= 1) {
    return true;
  }
  if (viewerPersonId && canPersonActOnZilchTurn(gameState, viewerPersonId)) {
    return true;
  }
  return canControllerActOnZilchTurn(gameState, controllerName);
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

/** Seat grid slots around the felt (non-overlapping layout). */
export function seatGridSlot(index: number, total: number): string {
  if (total <= 1) {
    return 'zilch-seat--slot-top';
  }
  if (total === 2) {
    return index === 0 ? 'zilch-seat--slot-top' : 'zilch-seat--slot-bottom';
  }
  if (total === 3) {
    return (
      ['zilch-seat--slot-top', 'zilch-seat--slot-left', 'zilch-seat--slot-right'][index] ??
      'zilch-seat--slot-bottom'
    );
  }
  if (total === 4) {
    return (
      [
        'zilch-seat--slot-top',
        'zilch-seat--slot-left',
        'zilch-seat--slot-right',
        'zilch-seat--slot-bottom',
      ][index] ?? 'zilch-seat--slot-extra'
    );
  }
  if (index === 0) {
    return 'zilch-seat--slot-top';
  }
  if (index === total - 1) {
    return 'zilch-seat--slot-bottom';
  }
  return index % 2 === 1 ? 'zilch-seat--slot-left' : 'zilch-seat--slot-right';
}

/** @deprecated Use seatGridSlot — kept for tests migrating off absolute positions. */
export function seatPositionClass(index: number, total: number): string {
  return seatGridSlot(index, total);
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
