import type { GameState } from '../types';
import { getCallerPersonIdForBox } from '../engine/session';

/** Display name of the person who decides hit/stand/split/double/insurance for a box. */
export function getBoxCallerDisplayName(state: GameState, boxPlayerId: string): string {
  const callerId = getCallerPersonIdForBox(state, boxPlayerId);
  if (!callerId) {
    return '—';
  }
  const person = state.players[callerId];
  return person?.controllerName?.trim() || person?.displayName || '—';
}
