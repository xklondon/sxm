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
  canHitBlackjack,
  canSplitBlackjackForState,
  canStandBlackjack,
} from '../engine/blackjack';
import { cardsFromIds, getBlackjackHandValue } from '../engine/blackjack/hand';
import { parseBlackjackHandKey } from '../engine/blackjack/handKeys';
import { getVisibleDealerCardIds } from '../engine/blackjack/protocolState';
import {
  getInsuranceActionsForController,
  canCallEvenMoneyForHand,
  formatDecisionOwnerWaitMessage,
} from './blackjackViewPhase';
import { formatShortCardLabel } from './cardDisplay';
import { getCardById } from '../engine/deck';

/** Canonical game command payload — protocol next-step text for the table centre. */
export interface CommandMessage {
  commandMessage: string | null;
  commandLines: string[];
}

/** @deprecated Use CommandMessage */
export type TableCommandDisplay = CommandMessage;

export function formatHandValuePhrase(value: number, isSoft: boolean): string {
  return isSoft ? `soft ${value}` : String(value);
}

/** Build comma-separated option list — only actions valid for the active hand. */
export function formatPlayerTurnOptions(
  canHit: boolean,
  canStand: boolean,
  canDouble: boolean,
  canSplit: boolean,
): string {
  const options: string[] = [];
  if (canHit) {
    options.push('Hit');
  }
  if (canStand) {
    options.push('Stay');
  }
  if (canDouble) {
    options.push('Double one card');
  }
  if (canSplit) {
    options.push('Split');
  }
  if (options.length === 0) {
    return '';
  }
  return `Options: ${options.join(', ')}.`;
}

function formatBankHandPhrase(state: GameState): string {
  const round = state.blackjack;
  const deck = state.deck;
  if (!round || !deck) {
    return 'Bank has no cards.';
  }

  let cardIds = getVisibleDealerCardIds(state);
  const holeHidden =
    round.dealerHoleHidden &&
    round.status !== 'resolved' &&
    round.status !== 'bank-turn' &&
    round.status !== 'banking';
  if (holeHidden && cardIds.length > 1) {
    cardIds = cardIds.slice(0, 1);
  }

  if (cardIds.length === 0) {
    return 'Bank has no cards.';
  }

  if (cardIds.length === 1) {
    const card = getCardById(deck, cardIds[0]!);
    const label = card ? formatShortCardLabel(card) : 'a card';
    return `Bank has ${label}`;
  }

  const { value } = getBlackjackHandValue(cardsFromIds(deck, cardIds));
  return `Bank has ${value}`;
}

/** Canonical player-turn lines — strict format, no sentimental copy. */
export function formatPlayerTurnCommand(
  slotNum: number | undefined,
  _callerName: string,
  handValue: { value: number; isSoft: boolean; isBlackjack: boolean },
  options?: {
    handIndex?: number;
    actionStatus?: string;
    gameState?: GameState;
    handKey?: string;
    allowSplit?: boolean;
    allowDouble?: boolean;
  },
): CommandMessage {
  const boxLabel = `Box ${slotNum ?? '?'}`;

  if (
    options?.actionStatus === 'blackjack' ||
    (handValue.isBlackjack && options?.actionStatus !== 'busted')
  ) {
    return {
      commandMessage: `${boxLabel}, Blackjack.`,
      commandLines: [],
    };
  }

  const splitNote =
    options?.handIndex != null && options.handIndex > 0
      ? ` (hand ${options.handIndex + 1})`
      : '';
  const playerScore = formatHandValuePhrase(handValue.value, handValue.isSoft);

  const lines: string[] = [];
  if (options?.gameState) {
    lines.push(`${formatBankHandPhrase(options.gameState)} against your ${playerScore}${splitNote}.`);
  }

  if (options?.gameState && options.handKey && options.gameState.blackjack) {
    const round = options.gameState.blackjack;
    const allowSplit = options.allowSplit ?? false;
    const allowDouble = options.allowDouble ?? false;
    const optionsLine = formatPlayerTurnOptions(
      canHitBlackjack(round, options.handKey),
      canStandBlackjack(round, options.handKey),
      allowDouble && canDoubleBlackjackForState(options.gameState, options.handKey),
      allowSplit && canSplitBlackjackForState(options.gameState, options.handKey),
    );
    if (optionsLine) {
      lines.push(optionsLine);
    }
  }

  return {
    commandMessage: `${boxLabel} — your turn.`,
    commandLines: lines,
  };
}

/** @deprecated Prefer formatPlayerTurnCommand with hand value context. */
export function formatCallerTurnMessage(
  slotNum: number | undefined,
  callerName: string,
  handValue?: { value: number; isSoft: boolean; isBlackjack: boolean },
  options?: { handIndex?: number; actionStatus?: string },
): string {
  if (handValue) {
    return formatPlayerTurnCommand(slotNum, callerName, handValue, options).commandMessage ?? '';
  }
  return `Box ${slotNum ?? '?'} — your turn.`;
}

/** Gold command-area hints (split/double) vs green generic turn lines. */
export function isTableInstructionMessage(message: string | null | undefined): boolean {
  if (!message?.trim()) {
    return false;
  }
  return /^Options:/i.test(message);
}

/** @deprecated Options are inlined in formatPlayerTurnCommand. */
export function formatLegalActionHint(_canSplit: boolean, _canDouble: boolean): string | null {
  return null;
}

/** @deprecated Options are inlined in formatPlayerTurnCommand. */
export function formatCallerLegalLine(
  _slotNum: number | undefined,
  _callerName: string,
  _canSplit: boolean,
  _canDouble: boolean,
): string | null {
  return null;
}

/** @deprecated Sentimental flavor removed — use strict command format. */
export function turnFlavor(_options: {
  value: number;
  isSoft: boolean;
  isBlackjack: boolean;
  actionStatus?: string;
}): string {
  return '';
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
    return {
      commandMessage: 'Dealer may have blackjack — take even money (1:1)?',
      commandLines: [],
    };
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
    const boxLabel =
      first.slotNumbers.length > 1
        ? `Boxes ${first.slotNumbers.join(' & ')}`
        : `Box ${first.slotNumber ?? '?'}`;
    return {
      commandMessage: `${boxLabel} — your insurance call.`,
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

    const handContext = resolveHandCommandContext(gameState, turnHandKey);
    if (handContext) {
      return formatPlayerTurnCommand(activeSlotNum, callerName, handContext, {
        handIndex: handContext.handIndex,
        actionStatus: handContext.actionStatus,
        gameState,
        handKey: turnHandKey,
        allowSplit: gameState.blackjackSettings.allowSplit,
        allowDouble: gameState.blackjackSettings.allowDoubleDown,
      });
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
