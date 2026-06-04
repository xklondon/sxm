import type { GameState } from '../types';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';
import {
  canControllerCallBox,
  getCallerPersonIdForBox,
  resolveControllerPersonId,
} from '../engine/session';
import {
  canDoubleBlackjackForState,
  canSplitBlackjackForState,
} from '../engine/blackjack';
import { parseBlackjackHandKey } from '../engine/blackjack/handKeys';
import {
  getActionableHandForView,
  getInsuranceActionsForController,
  canCallEvenMoneyForHand,
} from './blackjackViewPhase';
import { isOnlineModeEnabled } from '../api/config';

export interface TableCommandDisplay {
  commandMessage: string | null;
  commandLines: string[];
}

function legalActionHint(gameState: GameState, handKey: string): string | null {
  const canSplit =
    gameState.blackjackSettings.allowSplit &&
    canSplitBlackjackForState(gameState, handKey);
  const canDouble =
    gameState.blackjackSettings.allowDoubleDown &&
    canDoubleBlackjackForState(gameState, handKey);

  return formatLegalActionHint(canSplit, canDouble);
}

/** UI-only wording for split/double availability (exported for tests). */
export function formatLegalActionHint(canSplit: boolean, canDouble: boolean): string | null {
  if (canSplit && canDouble) {
    return 'You can split or double — double gets one card only.';
  }
  if (canSplit) {
    return 'You can split.';
  }
  if (canDouble) {
    return 'You can double — one card only.';
  }
  return null;
}

/** UI-only consolidation of gameplay instructions for the central command area. */
export function buildTableCommandDisplay(params: {
  gameState: GameState;
  gameEnded: boolean;
  gameOverMessage: string;
  centerStatus: string;
  protocolPhase: BlackjackProtocolPhase;
  roundSummaryLines: string[];
  controllerName: string;
}): TableCommandDisplay {
  const {
    gameState,
    gameEnded,
    gameOverMessage,
    centerStatus,
    protocolPhase,
    roundSummaryLines,
    controllerName,
  } = params;
  const round = gameState.blackjack;
  const { players } = gameState;

  if (gameEnded) {
    return { commandMessage: gameOverMessage, commandLines: [] };
  }

  if (roundSummaryLines.length > 0) {
    return { commandMessage: null, commandLines: roundSummaryLines };
  }

  if (round?.evenMoneyOfferHandKey) {
    const { playerId } = parseBlackjackHandKey(round.evenMoneyOfferHandKey);
    const slotNum = gameState.session.boxSlotNumbers?.[playerId];
    const controllerPersonId = resolveControllerPersonId(gameState, controllerName);
    const canCall =
      controllerPersonId !== null &&
      canCallEvenMoneyForHand(gameState, round.evenMoneyOfferHandKey, controllerName);
    if (!canCall) {
      return {
        commandMessage: `Box ${slotNum ?? '?'} — even-money decision pending…`,
        commandLines: [],
      };
    }
    return { commandMessage: 'Dealer may have blackjack. Take 1:1 now?', commandLines: [] };
  }

  if (protocolPhase === 'insurance' && round?.insuranceOfferPending) {
    const actions = getInsuranceActionsForController(gameState, round, controllerName);
    if (actions.length === 0) {
      return {
        commandMessage: 'Dealer shows Ace — waiting for insurance decisions…',
        commandLines: [],
      };
    }
    return { commandMessage: 'Dealer shows Ace — insurance pays 2:1', commandLines: [] };
  }

  if (protocolPhase === 'player') {
    if (!round?.activeHandKey) {
      return { commandMessage: 'Waiting for next box…', commandLines: [] };
    }

    const turnHandKey = round.activeHandKey;
    const { playerId } = parseBlackjackHandKey(turnHandKey);
    const activeSlotNum = gameState.session.boxSlotNumbers?.[playerId];
    const callerId = getCallerPersonIdForBox(gameState, playerId);
    const caller = callerId ? players[callerId] : null;
    const callerName = caller?.controllerName?.trim() || caller?.displayName || 'caller';
    const controllerPersonId = resolveControllerPersonId(gameState, controllerName);
    const isCaller =
      controllerPersonId !== null &&
      canControllerCallBox(gameState, playerId, controllerPersonId);

    if (!isCaller) {
      return {
        commandMessage: `Waiting for ${callerName} to call Box ${activeSlotNum ?? '?'}.`,
        commandLines: [],
      };
    }

    const actionable = getActionableHandForView(
      gameState,
      controllerPersonId,
      isOnlineModeEnabled(),
    );
    const lines: string[] = [];
    if (actionable && turnHandKey) {
      const hint = legalActionHint(gameState, turnHandKey);
      if (hint) {
        lines.push(hint);
      }
    }
    return { commandMessage: centerStatus, commandLines: lines };
  }

  return { commandMessage: centerStatus, commandLines: [] };
}
