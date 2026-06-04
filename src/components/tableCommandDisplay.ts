import type { GameState } from '../types';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';
import {
  canControllerCallBox,
  getCallerPersonIdForBox,
  resolveControllerPersonId,
  resolveViewerPersonId,
  type ViewerIdentityHints,
} from '../engine/session';
import {
  canDoubleBlackjackForState,
  canSplitBlackjackForState,
} from '../engine/blackjack';
import { parseBlackjackHandKey } from '../engine/blackjack/handKeys';
import {
  getInsuranceActionsForController,
  canCallEvenMoneyForHand,
} from './blackjackViewPhase';

export interface TableCommandDisplay {
  commandMessage: string | null;
  commandLines: string[];
}

/** UI-only wording for split/double availability (exported for tests). */
export function formatLegalActionHint(canSplit: boolean, canDouble: boolean): string | null {
  if (canSplit && canDouble) {
    return 'can split or double — double gets one card only.';
  }
  if (canSplit) {
    return 'can split.';
  }
  if (canDouble) {
    return 'can double — one card only.';
  }
  return null;
}

export function formatCallerTurnMessage(slotNum: number | undefined, callerName: string): string {
  return `Box ${slotNum ?? '?'} — ${callerName}'s turn.`;
}

export function formatCallerLegalLine(
  slotNum: number | undefined,
  callerName: string,
  canSplit: boolean,
  canDouble: boolean,
): string | null {
  const hint = formatLegalActionHint(canSplit, canDouble);
  if (!hint) {
    return null;
  }
  return `Box ${slotNum ?? '?'} — ${callerName} ${hint}`;
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
  viewerPersonId?: string | null;
  viewerHints?: ViewerIdentityHints;
}): TableCommandDisplay {
  const {
    gameState,
    gameEnded,
    gameOverMessage,
    centerStatus,
    protocolPhase,
    roundSummaryLines,
    controllerName,
    viewerPersonId: viewerPersonIdParam,
    viewerHints,
  } = params;
  const viewerPersonId =
    viewerPersonIdParam ??
    (viewerHints ? resolveViewerPersonId(gameState, viewerHints) : null) ??
    resolveControllerPersonId(gameState, controllerName);
  const round = gameState.blackjack;
  const { players } = gameState;

  if (gameEnded) {
    return { commandMessage: gameOverMessage, commandLines: [] };
  }

  if (roundSummaryLines.length > 0) {
    return { commandMessage: null, commandLines: roundSummaryLines };
  }

  if (protocolPhase === 'betting' && gameState.tableMeta.tableNotice?.message) {
    return {
      commandMessage: gameState.tableMeta.tableNotice.message,
      commandLines: [],
    };
  }

  if (round?.evenMoneyOfferHandKey) {
    const { playerId } = parseBlackjackHandKey(round.evenMoneyOfferHandKey);
    const slotNum = gameState.session.boxSlotNumbers?.[playerId];
    const canCall =
      viewerPersonId !== null &&
      canCallEvenMoneyForHand(gameState, round.evenMoneyOfferHandKey, viewerPersonId);
    if (!canCall) {
      return {
        commandMessage: `Box ${slotNum ?? '?'} — even-money decision pending…`,
        commandLines: [],
      };
    }
    return { commandMessage: 'Dealer may have blackjack. Take 1:1 now?', commandLines: [] };
  }

  if (protocolPhase === 'insurance' && round?.insuranceOfferPending) {
    const actions = getInsuranceActionsForController(gameState, round, viewerPersonId);
    if (actions.length === 0) {
      return {
        commandMessage: 'Dealer shows Ace — insurance decisions.',
        commandLines: [],
      };
    }
    const first = actions[0]!;
    return {
      commandMessage: `Box ${first.slotNumber ?? '?'} — insurance decision.`,
      commandLines: ['Dealer shows Ace — insurance pays 2:1'],
    };
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
    const isCaller =
      viewerPersonId !== null &&
      canControllerCallBox(gameState, playerId, viewerPersonId);

    if (!isCaller) {
      return {
        commandMessage: `Box ${activeSlotNum ?? '?'} — waiting for ${callerName} to call.`,
        commandLines: [],
      };
    }

    const lines: string[] = [];
    const hintLine = formatCallerLegalLine(
      activeSlotNum,
      callerName,
      gameState.blackjackSettings.allowSplit &&
        canSplitBlackjackForState(gameState, turnHandKey),
      gameState.blackjackSettings.allowDoubleDown &&
        canDoubleBlackjackForState(gameState, turnHandKey),
    );
    if (hintLine) {
      lines.push(hintLine);
    }
    return {
      commandMessage: formatCallerTurnMessage(activeSlotNum, callerName),
      commandLines: lines,
    };
  }

  return { commandMessage: centerStatus, commandLines: [] };
}
