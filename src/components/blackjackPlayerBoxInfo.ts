import type { GameState } from '../types';
import { getBoxCallerDisplayName } from './boxCallerDisplay';

/** Shared player-box label contract for Full Table arc seats and Card View mini boxes. */
export interface BlackjackPlayerBoxInfo {
  slotNumber: number;
  boxId: string | null;
  callerDisplayName: string;
  boxLabel: string;
}

export function buildBlackjackPlayerBoxInfo(
  state: GameState,
  slotNumber: number,
  boxId: string | null,
): BlackjackPlayerBoxInfo {
  return {
    slotNumber,
    boxId,
    callerDisplayName: boxId ? getBoxCallerDisplayName(state, boxId) : '',
    boxLabel: `Box ${slotNumber}`,
  };
}
