import type { ZilchGameState } from './zilchTypes';
import { startTurn } from './zilchEngine';

/** Repair stuck or legacy Zilch phases after load/hydration. */
export function normalizeZilchState(zilch: ZilchGameState): ZilchGameState {
  let next = { ...zilch };

  if (next.diceAnimation?.isRolling) {
    const stuckStarter =
      next.phase === 'setup' ||
      next.phase === 'randomising-starter' ||
      !next.currentPlayerId;
    if (stuckStarter) {
      next = {
        ...next,
        diceAnimation: { isRolling: false },
      };
    }
  }

  if (next.phase === 'randomising-starter') {
    if (next.starterPlayerId && next.currentPlayerId) {
      return startTurn(next, next.starterPlayerId);
    }
    if (next.players.length > 0) {
      return {
        ...next,
        phase: 'setup',
        starterPlayerId: null,
        currentPlayerId: null,
        diceAnimation: { isRolling: false },
      };
    }
  }

  return next;
}
