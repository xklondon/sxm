import type { GameState } from '../types';
import type { ZilchGameState } from '../engine/zilch/zilchTypes';
import {
  canControllerActOnZilchTurn,
  canPersonActOnZilchTurn,
} from '../engine/dice/zilch/zilchTurnAuthority';
import { getVisibleZilchPlayers } from '../engine/dice/zilch/zilchVisiblePlayers';
import { loadProfile } from '../storage/profileStorage';

export type ZilchPlayerBoxStatus =
  | 'waiting'
  | 'turn'
  | 'banked'
  | 'zilch'
  | 'winner'
  | 'setup';

function zilchPlayerOrder(gameState: GameState): string[] {
  return getVisibleZilchPlayers(gameState).map((player) => player.playerId);
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
  if (zilch.phase === 'zilch-reveal' && zilch.currentPlayerId === playerId) {
    return 'zilch';
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

export type ZilchSeatRing = {
  top: number[];
  bottom: number[];
  left: number[];
  right: number[];
};

/** Assign seat indices to non-overlapping ring columns/rows. */
export function distributeZilchSeats(count: number): ZilchSeatRing {
  if (count <= 0) {
    return { top: [], bottom: [], left: [], right: [] };
  }
  if (count === 1) {
    return { top: [0], bottom: [], left: [], right: [] };
  }
  if (count === 2) {
    return { top: [0], bottom: [1], left: [], right: [] };
  }
  if (count === 3) {
    return { top: [0], bottom: [], left: [1], right: [2] };
  }
  if (count === 4) {
    return { top: [0], bottom: [3], left: [1], right: [2] };
  }

  const middle = Array.from({ length: count - 2 }, (_, i) => i + 1);
  const left: number[] = [];
  const right: number[] = [];
  for (const idx of middle) {
    if (left.length <= right.length) {
      left.push(idx);
    } else {
      right.push(idx);
    }
  }
  return { top: [0], bottom: [count - 1], left, right };
}

export interface ZilchSeatDisplay {
  name: string;
  boxLabel: string | null;
  isVirtual: boolean;
}

export function resolveZilchSeatDisplay(
  gameState: GameState,
  playerId: string,
): ZilchSeatDisplay {
  const player = gameState.players[playerId];
  if (!player) {
    return { name: playerId, boxLabel: null, isVirtual: false };
  }

  const slot = gameState.tableMeta.boxSlots.find((s) => s.playerId === playerId);
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

/** @deprecated Use distributeZilchSeats ring slots instead. */
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

/** Per-die throw trajectory (visual only) — paths land on a non-overlapping grid. */
export function dieThrowStyle(
  index: number,
  seed: number,
  count = 6,
): Record<string, string> {
  const cols = Math.min(3, Math.max(1, count));
  const rows = Math.ceil(count / cols);
  const gap = 9;
  const size = 40;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const gridW = cols * size + (cols - 1) * gap;
  const gridH = rows * size + (rows - 1) * gap;
  const endX = col * (size + gap) - gridW / 2 + size / 2;
  const endY = row * (size + gap) - gridH / 2 + size / 2;

  const angle = (index / Math.max(count, 1)) * Math.PI * 2 + seed * 0.55;
  const startX = Math.cos(angle) * 52;
  const startY = Math.sin(angle) * 34 + 38;
  const midX = (startX + endX) / 2 + ((seed + index * 7) % 15) - 7;
  const midY = (startY + endY) / 2 - 26 - ((seed + index * 5) % 11);
  const rotX = 300 + ((index * 47 + seed) % 420);
  const rotY = 260 + ((index * 61 + seed * 2) % 380);
  const rotZ = 220 + ((index * 53 + seed * 3) % 460);

  return {
    '--die-index': String(index),
    '--start-x': `${startX}px`,
    '--start-y': `${startY}px`,
    '--mid-x': `${midX}px`,
    '--mid-y': `${midY}px`,
    '--end-x': `${endX}px`,
    '--end-y': `${endY}px`,
    '--die-path-x': `${endX}px`,
    '--die-path-y': `${endY}px`,
    '--die-rot-x': `${rotX}deg`,
    '--die-rot-y': `${rotY}deg`,
    '--die-rot-z': `${rotZ}deg`,
  };
}
