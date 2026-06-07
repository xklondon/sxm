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
import { cardsFromIds, getBlackjackHandValue } from '../engine/blackjack/hand';
import { parseBlackjackHandKey } from '../engine/blackjack/handKeys';
import {
  getInsuranceActionsForController,
  canCallEvenMoneyForHand,
  formatDecisionOwnerWaitMessage,
} from './blackjackViewPhase';

/** Canonical game command payload — protocol next-step text for the table centre. */
export interface CommandMessage {
  commandMessage: string | null;
  commandLines: string[];
}

/** @deprecated Use CommandMessage */
export type TableCommandDisplay = CommandMessage;

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

export function formatHandValuePhrase(value: number, isSoft: boolean): string {
  return isSoft ? `soft ${value}` : String(value);
}

export function turnFlavor(options: {
  value: number;
  isSoft: boolean;
  isBlackjack: boolean;
  actionStatus?: string;
}): string {
  if (options.actionStatus === 'busted') {
    return 'Ouch — bust.';
  }
  if (options.isBlackjack || options.actionStatus === 'blackjack') {
    return 'Blackjack. Lovely.';
  }
  if (options.value === 21) {
    return 'Looking tasty.';
  }
  if (options.value >= 17) {
    return 'Your call.';
  }
  if (options.value <= 11) {
    return 'Your move.';
  }
  if (options.value >= 12 && options.value <= 16) {
    return 'Your move, pickle.';
  }
  return 'Your turn.';
}

/** Player-turn command — box, caller name, hand total, light next-step flavor. */
export function formatPlayerTurnCommand(
  slotNum: number | undefined,
  callerName: string,
  handValue: { value: number; isSoft: boolean; isBlackjack: boolean },
  options?: { handIndex?: number; actionStatus?: string },
): string {
  const box = `Box ${slotNum ?? '?'}`;
  const splitNote =
    options?.handIndex != null && options.handIndex > 0
      ? ` (hand ${options.handIndex + 1})`
      : '';
  const valuePhrase = formatHandValuePhrase(handValue.value, handValue.isSoft);
  const flavor = turnFlavor({ ...handValue, actionStatus: options?.actionStatus });
  return `${box}: ${callerName}, you have ${valuePhrase}${splitNote}. ${flavor}`;
}

/** @deprecated Prefer formatPlayerTurnCommand with hand value context. */
export function formatCallerTurnMessage(
  slotNum: number | undefined,
  callerName: string,
  handValue?: { value: number; isSoft: boolean; isBlackjack: boolean },
  options?: { handIndex?: number; actionStatus?: string },
): string {
  if (handValue) {
    return formatPlayerTurnCommand(slotNum, callerName, handValue, options);
  }
  return `Box ${slotNum ?? '?'}: ${callerName}, your turn.`;
}

/** Gold command-area hints (split/double) vs green generic turn lines. */
export function isTableInstructionMessage(message: string | null | undefined): boolean {
  if (!message?.trim()) {
    return false;
  }
  return /\b(?:you can|can) (?:split|double)\b/i.test(message);
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
  return `Box ${slotNum ?? '?'}: ${callerName} — ${hint}`;
}

function resolveHandCommandContext(
  gameState: GameState,
  handKey: string,
): { value: number; isSoft: boolean; isBlackjack: boolean; handIndex: number; actionStatus?: string } | null {
  const round = gameState.blackjack;
  const deck = gameState.deck;
  if (!round || !deck) {
    return null;
  }
  const hand = round.playerHands[handKey];
  if (!hand) {
    return null;
  }
  const cardIds = hand.cardIds.filter(Boolean);
  if (cardIds.length === 0) {
    return null;
  }
  const { value, isSoft, isBlackjack } = getBlackjackHandValue(cardsFromIds(deck, cardIds));
  const { handIndex } = parseBlackjackHandKey(handKey);
  return {
    value,
    isSoft,
    isBlackjack,
    handIndex,
    actionStatus: hand.actionStatus,
  };
}

function polishCenterStatusMessage(message: string, phase: BlackjackProtocolPhase): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return message;
  }

  const exact: Record<string, string> = {
    'Place your bets, then Shuffle to start.': 'Place your bets, then shuffle to start the shoe.',
    'Ready — press Deal Cards.': 'Bets are in — deal when ready.',
    'Place your bets.': 'Place your bets on your box.',
    'Cards.': 'Dealing…',
    'Your turn.': 'Waiting for the active box…',
    'Bank draws.': "Dealer's turn.",
    'Banking.': 'Settling the round…',
    'Bank busts.': 'Dealer busts.',
    'Review results — place bets, then Deal Cards.': 'Review the result, then place bets for the next hand.',
    'Round complete — review results, then press Next Round.':
      'Round complete — review results, then press New Cards.',
  };
  if (exact[trimmed]) {
    return exact[trimmed];
  }

  if (trimmed.startsWith('Bank stands on ')) {
    return trimmed.replace('Bank stands on ', 'Dealer stands on ');
  }

  if (/^.+: double (?:allowed|on hard)/i.test(trimmed)) {
    if (phase === 'betting') {
      return 'Place your bets, then deal when ready.';
    }
  }

  if (trimmed.includes('Dealer shows Ace — insurance offered')) {
    return 'Dealer shows Ace — insurance is on the table.';
  }

  return message;
}

/** Single canonical builder for Full Table + Card View command text. */
export function buildBlackjackCommandText(params: {
  gameState: GameState;
  gameEnded: boolean;
  gameOverMessage: string;
  centerStatus: string;
  protocolPhase: BlackjackProtocolPhase;
  roundSummaryLines: string[];
  controllerName: string;
  viewerPersonId?: string | null;
  viewerHints?: ViewerIdentityHints;
}): CommandMessage {
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
    return { commandMessage: 'Round finished. Summary ready.', commandLines: [] };
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
    return { commandMessage: 'Dealer may have blackjack — take even money (1:1)?', commandLines: [] };
  }

  if (protocolPhase === 'insurance' && round?.insuranceOfferPending) {
    const actions = getInsuranceActionsForController(gameState, round, viewerPersonId);
    if (actions.length === 0) {
      return {
        commandMessage: 'Dealer shows Ace — insurance decisions pending.',
        commandLines: [],
      };
    }
    const first = actions[0]!;
    return {
      commandMessage: `Box ${first.slotNumber ?? '?'} — your insurance call.`,
      commandLines: ['Insurance pays 2:1 when the dealer has blackjack.'],
    };
  }

  if (protocolPhase === 'player') {
    if (!round?.activeHandKey) {
      return { commandMessage: 'Waiting for the next box…', commandLines: [] };
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
        commandMessage: formatDecisionOwnerWaitMessage(gameState, playerId),
        commandLines: [],
      };
    }

    const hintLine = formatCallerLegalLine(
      activeSlotNum,
      callerName,
      gameState.blackjackSettings.allowSplit &&
        canSplitBlackjackForState(gameState, turnHandKey),
      gameState.blackjackSettings.allowDoubleDown &&
        canDoubleBlackjackForState(gameState, turnHandKey),
    );
    if (hintLine) {
      return { commandMessage: hintLine, commandLines: [] };
    }

    const handContext = resolveHandCommandContext(gameState, turnHandKey);
    if (handContext) {
      return {
        commandMessage: formatPlayerTurnCommand(
          activeSlotNum,
          callerName,
          handContext,
          { handIndex: handContext.handIndex, actionStatus: handContext.actionStatus },
        ),
        commandLines: [],
      };
    }

    return {
      commandMessage: formatCallerTurnMessage(activeSlotNum, callerName),
      commandLines: [],
    };
  }

  return {
    commandMessage: polishCenterStatusMessage(centerStatus, protocolPhase),
    commandLines: [],
  };
}

/** @deprecated Use buildBlackjackCommandText */
export const buildTableCommandDisplay = buildBlackjackCommandText;
