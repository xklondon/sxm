import type { GameState } from '../../../types';
import { listPlayableZilchPlayerIds } from './zilchTurnAuthority';
import { createInitialZilchState } from './zilchEngine';
import { normalizeZilchState } from './normalizeZilchState';
import type { ZilchTableMode } from './zilchTypes';

function resolveTableMode(state: GameState): ZilchTableMode {
  return state.tableMeta.tableMode === 'challenge' ? 'challenge' : 'practice';
}

/** Keep zilch roster aligned with playable seats — setup phase only. */
export function reconcileZilchRoster(state: GameState): GameState {
  const playableIds = listPlayableZilchPlayerIds(state);
  const tableMode = resolveTableMode(state);
  const zilch = state.zilch;

  if (playableIds.length === 0) {
    if (zilch?.phase === 'setup') {
      return { ...state, zilch: null };
    }
    return state;
  }

  if (!zilch) {
    return {
      ...state,
      zilch: normalizeZilchState(
        createInitialZilchState(playableIds, state.zilchSettings, {
          tableMode,
          wagerMetadata: state.tableMeta.agreement?.stakeDescription
            ? { stakeDescription: state.tableMeta.agreement.stakeDescription }
            : undefined,
        }),
      ),
      tableMeta: {
        ...state.tableMeta,
        gameCategory: 'dice',
        diceGame: 'zilch',
        protocolLocked: true,
      },
    };
  }

  if (zilch.phase !== 'setup') {
    return state;
  }

  const currentIds = zilch.players.map((player) => player.playerId);
  const sameOrder =
    currentIds.length === playableIds.length &&
    currentIds.every((id, index) => id === playableIds[index]);
  if (sameOrder) {
    return state;
  }

  const totals: Record<string, number> = {};
  for (const id of playableIds) {
    totals[id] = zilch.totalScoresByPlayerId[id] ?? 0;
  }

  return {
    ...state,
    zilch: {
      ...zilch,
      tableMode,
      players: playableIds.map((playerId) => {
        const existing = zilch.players.find((player) => player.playerId === playerId);
        return existing ?? { playerId, roundsPlayed: 0 };
      }),
      totalScoresByPlayerId: totals,
    },
  };
}
