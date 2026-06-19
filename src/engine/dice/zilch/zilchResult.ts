import type { GameState } from '../../../types';
import type { ZilchGameState, ZilchTableMode } from './zilchTypes';
import { getZilchWinnerId } from './zilchSelectors';

/** Generic game result envelope for ledger / IOU adapters. */
export interface ZilchGameResult {
  gameId: string;
  protocolId: 'zilch';
  tableId: string;
  sessionId: string;
  mode: ZilchTableMode;
  players: string[];
  winnerId: string | null;
  finalScores: Record<string, number>;
  wager: Record<string, unknown> | null;
  completedAt: string;
}

export function buildZilchGameResult(
  gameState: GameState,
  zilch: ZilchGameState,
): ZilchGameResult {
  return {
    gameId: zilch.gameId,
    protocolId: 'zilch',
    tableId: gameState.session.id,
    sessionId: gameState.session.id,
    mode: zilch.tableMode,
    players: zilch.players.map((p) => p.playerId),
    winnerId: getZilchWinnerId(zilch),
    finalScores: { ...zilch.totalScoresByPlayerId },
    wager: zilch.wagerMetadata ?? (gameState.tableMeta.agreement?.stakeDescription
      ? { stakeDescription: gameState.tableMeta.agreement.stakeDescription }
      : null),
    completedAt: new Date().toISOString(),
  };
}

/**
 * Scaffold: build IOU handoff payload for challenge-mode Zilch end.
 * TODO: wire through gameOverActionFlow when challenge Zilch ledger settlement is ready.
 */
export function buildZilchIouHandoffStub(
  gameState: GameState,
  zilch: ZilchGameState,
): { todo: string; result: ZilchGameResult } {
  return {
    todo: 'Wire Zilch challenge IOU via generic gameEndIou adapter',
    result: buildZilchGameResult(gameState, zilch),
  };
}
