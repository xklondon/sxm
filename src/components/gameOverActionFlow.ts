import type { GameState } from '../types';
import { createIouHandoff } from '../api/iouHandoff';
import {
  buildIouHandoffCreateRequest,
} from '../engine/scoreLedger/gameEndIou';
import { iouHandoffStorageKey } from '../lib/iouHandoffPayload';
import { log } from '../utils/logger';
import type { GameOverCompleteOptions, GameOverIouFeedback } from './GameOverActionOverlay';

export type GameOverActionFlowResult = 'completed' | 'blocked';

export interface GameOverActionFlowHandlers {
  getState: () => GameState;
  addToPersonalLedger: () => void;
  beginNewGame: () => void;
  exitTable: () => void;
  setIouFeedback: (feedback: GameOverIouFeedback | null) => void;
  canResetTable: boolean;
  canExitTable: boolean;
}

type IouHandoffSubmitResult =
  | { ok: true; alreadySubmitted: boolean }
  | { ok: false };

async function submitIouHandoffForGameOver(
  state: GameState,
  customMessage: string | undefined,
  setIouFeedback: (feedback: GameOverIouFeedback | null) => void,
): Promise<IouHandoffSubmitResult> {
  setIouFeedback(null);
  const request = buildIouHandoffCreateRequest(state, { message: customMessage });
  if (!request) {
    setIouFeedback({
      tone: 'error',
      message: 'Missing debtor or creditor email for this wager.',
    });
    log.info('gameOverIouSubmit', {
      action: 'submit',
      iouSelected: true,
      submitAttempted: false,
      response: 'missing-parties',
    });
    return { ok: false };
  }

  log.info('gameOverIouSubmit', {
    action: 'submit',
    iouSelected: true,
    submitAttempted: true,
  });

  const result = await createIouHandoff(request);
  if (!result.ok) {
    setIouFeedback({
      tone: 'error',
      message: result.error,
    });
    log.info('gameOverIouSubmit', {
      action: 'submit',
      iouSelected: true,
      submitAttempted: true,
      response: 'error',
    });
    return { ok: false };
  }

  const storageKey = iouHandoffStorageKey(request.tableId, request.sessionId);
  if (typeof localStorage !== 'undefined' && result.iouId) {
    localStorage.setItem(storageKey, result.iouId);
  }

  setIouFeedback({
    tone: result.alreadySubmitted ? 'info' : 'success',
    message: result.alreadySubmitted
      ? 'This IOU handoff was already submitted.'
      : 'IOU created. The counterparty can accept or decline it in IOU Wallet.',
    openUrl: result.openUrl,
  });
  log.info('gameOverIouSubmit', {
    action: 'submit',
    iouSelected: true,
    submitAttempted: true,
    response: result.alreadySubmitted ? 'alreadySubmitted' : 'ok',
  });
  return { ok: true, alreadySubmitted: Boolean(result.alreadySubmitted) };
}

/** Ledger + optional IOU handoff, then new game or exit table. */
export async function runGameOverCompleteAction(
  options: GameOverCompleteOptions,
  handlers: GameOverActionFlowHandlers,
): Promise<GameOverActionFlowResult> {
  log.info('gameOverAction', {
    nextAction: options.nextAction,
    iouSelected: options.createIou,
    saveLedger: options.saveLedger,
  });

  if (options.saveLedger) {
    handlers.addToPersonalLedger();
  }

  if (options.createIou) {
    const iouResult = await submitIouHandoffForGameOver(
      handlers.getState(),
      options.iouMessage,
      handlers.setIouFeedback,
    );
    if (!iouResult.ok) {
      return 'blocked';
    }
  } else {
    log.info('gameOverIouSubmit', {
      action: options.nextAction,
      iouSelected: false,
      submitAttempted: false,
    });
  }

  if (options.nextAction === 'new-game') {
    if (handlers.canResetTable) {
      handlers.beginNewGame();
    }
    return 'completed';
  }

  if (options.nextAction === 'exit-table' && handlers.canExitTable) {
    handlers.exitTable();
  }
  return 'completed';
}
