import type { ZilchGameState } from './zilchTypes';
import { advanceToNextPlayer, startTurn } from './zilchEngine';

/** Repair stuck or legacy Zilch phases after load/hydration. */
export function normalizeZilchState(zilch: ZilchGameState): ZilchGameState {
  let next = { ...zilch };

  if (!next.history) {
    next = { ...next, history: [] };
  }
  if (!next.protocolId) {
    next = { ...next, protocolId: 'zilch' };
  }
  if (!next.gameId) {
    next = { ...next, gameId: `legacy-${Date.now()}` };
  }
  if (!next.tableMode) {
    next = { ...next, tableMode: 'practice' };
  }

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
    if (next.starterPlayerId) {
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

  if (next.phase === 'zilch') {
    const order = next.players.map((p) => p.playerId);
    if (order.length > 0) {
      return advanceToNextPlayer(next);
    }
  }

  const order = next.players.map((p) => p.playerId);
  if (
    order.length > 0 &&
    next.currentPlayerId &&
    !order.includes(next.currentPlayerId) &&
    (next.phase === 'player-turn' || next.phase === 'final-round')
  ) {
    return startTurn(next, order[0]!);
  }

  return next;
}
