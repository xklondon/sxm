import type { GameState } from '../../types';
import { getGameOverMessage } from '../session/tableGameEnd';
import {
  evaluateTableGameEnd,
  type TableGameEndEvaluation,
} from '../session/tableGameEnd';

export type BlackjackGameOverReason =
  | 'bank-broke'
  | 'players-broke'
  | 'single-holder'
  | 'bank-has-all-chips'
  | 'bank-empty'
  | 'all-players-eliminated'
  | null;

export interface BlackjackGameOverEvaluation {
  isGameOver: boolean;
  reason: BlackjackGameOverReason;
  winnerPersonId: string | null;
  winnerSide: 'bank' | 'players' | null;
  message: string;
}

function mapReason(reason: string): BlackjackGameOverReason {
  switch (reason) {
    case 'bank-bust':
    case 'bank-empty':
      return 'bank-broke';
    case 'all-players-eliminated':
      return 'players-broke';
    case 'single-holder':
    case 'bank-has-all-chips':
      return reason;
    default:
      return null;
  }
}

function resolveWinnerSide(
  state: GameState,
  evaluation: TableGameEndEvaluation,
): 'bank' | 'players' | null {
  if (!evaluation.ended || !evaluation.winnerId) {
    return null;
  }
  if (evaluation.winnerId === state.session.bankPlayerId) {
    return 'bank';
  }
  return 'players';
}

/** Canonical post-settlement game-over probe — uses current ledger balances. */
export function evaluateBlackjackGameOver(state: GameState): BlackjackGameOverEvaluation {
  const evaluation = evaluateTableGameEnd(state);
  if (!evaluation.ended) {
    return {
      isGameOver: false,
      reason: null,
      winnerPersonId: evaluation.winnerId,
      winnerSide: null,
      message: '',
    };
  }

  const endedPreview: GameState = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      gameStatus: 'ended',
      winnerId: evaluation.winnerId,
      gameEndReason: evaluation.reason as GameState['tableMeta']['gameEndReason'],
    },
  };

  return {
    isGameOver: true,
    reason: mapReason(evaluation.reason),
    winnerPersonId: evaluation.winnerId,
    winnerSide: resolveWinnerSide(state, evaluation),
    message: getGameOverMessage(endedPreview),
  };
}
