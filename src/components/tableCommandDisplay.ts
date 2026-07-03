import type { GameState } from '../types';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';
import {
  canControllerCallBox,
  getCallerPersonIdForBox,
  resolveControllerPersonId,
  resolveViewerPersonId,
  type ViewerIdentityHints,
} from '../engine/session';
import { cardsFromIds, getBlackjackHandValue } from '../engine/blackjack/hand';
import { parseBlackjackHandKey } from '../engine/blackjack/handKeys';
import {
  getDisplayedHandValue,
  getVisibleDealerCardIds,
} from './blackjackDealingContract';
import {
  getInsuranceActionsForController,
  canCallEvenMoneyForHand,
  formatDecisionOwnerWaitMessage,
} from './blackjackViewPhase';
import {
  resolvePlayerHandActionOptions,
  resolvePlayerHandCommandLines,
} from './blackjackActionContract';
import { formatShortCardLabel } from './cardDisplay';
import { getCardById } from '../engine/deck';
import {
  canShowEvenMoneyDecisionUi,
  createUiRevealContext,
  gateCommandForReveal,
  isHandVisiblyRevealed,
  type UiRevealContext,
} from './blackjackUiRenderContract';

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

/** Build comma-separated option list — only special actions (never Hit/Stay). */
export function formatPlayerTurnOptions(
  _canHit: boolean,
  _canStand: boolean,
  canDouble: boolean,
  canSplit: boolean,
): string {
  void _canHit;
  void _canStand;
  const lines: string[] = [];
  if (canDouble) {
    lines.push('Double available.');
  }
  if (canSplit) {
    lines.push('Split available.');
  }
  return lines.join('\n');
}

function formatBankHandPhrase(displayState: GameState): string {
  const round = displayState.blackjack;
  const deck = displayState.deck;
  if (!round || !deck) {
    return 'Bank has no cards.';
  }

  let cardIds = getVisibleDealerCardIds(displayState);
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

/** Command zone must not show bank totals before visible dealer cards justify them. */
export function shouldIncludeBankHandCommandLine(displayState: GameState): boolean {
  const round = displayState.blackjack;
  const deck = displayState.deck;
  if (!round || !deck) {
    return false;
  }
  const cardIds = getVisibleDealerCardIds(displayState);
  return cardIds.length > 0;
}

/** Strip premature bank totals from centre status during paced reveal. */
export function sanitizeCommandStatusForVisibleBank(
  message: string,
  displayState: GameState,
  protocolPhase: BlackjackProtocolPhase,
  cardRevealComplete = true,
): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return message;
  }

  const round = displayState.blackjack;
  const visibleDealerCards = getVisibleDealerCardIds(displayState).length;
  const bankDrawPhases = protocolPhase === 'bank' || protocolPhase === 'dealing';

  if (bankDrawPhases && (!cardRevealComplete || visibleDealerCards === 0)) {
    if (/Bank stands on|Dealer stands on|Bank has \d+|Bank busts/i.test(trimmed)) {
      return protocolPhase === 'bank' ? "Dealer's turn." : 'Dealing…';
    }
  }

  if (round?.dealerHoleHidden && round.status !== 'bank-turn' && round.status !== 'banking' && round.status !== 'resolved') {
    if (/Bank stands on \d+|Dealer stands on \d+|Bank has \d+/i.test(trimmed)) {
      return "Dealer's turn.";
    }
  }

  return message;
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
    displayState?: GameState;
    handKey?: string;
    allowSplit?: boolean;
    allowDouble?: boolean;
    cardRevealComplete?: boolean;
  },
): CommandMessage {
  const boxLabel = `Box ${slotNum ?? '?'}`;
  const playerLabel = _callerName?.trim() || 'player';

  const revealCtx: UiRevealContext | null =
    options?.gameState && options?.displayState
      ? createUiRevealContext(
          options.gameState,
          options.displayState,
          options.cardRevealComplete ?? true,
        )
      : null;

  if (
    (options?.actionStatus === 'blackjack' ||
      (handValue.isBlackjack && options?.actionStatus !== 'busted')) &&
    options?.handKey &&
    revealCtx
  ) {
    if (isHandVisiblyRevealed(revealCtx, options.handKey)) {
      return {
        commandMessage: `${boxLabel}, Blackjack.`,
        commandLines: [],
      };
    }
    return { commandMessage: 'Dealing…', commandLines: [] };
  }

  const splitNote =
    options?.handIndex != null && options.handIndex > 0
      ? ` (hand ${options.handIndex + 1})`
      : '';
  const playerScore = formatHandValuePhrase(handValue.value, handValue.isSoft);

  const lines: string[] = [];
  const bankDisplayState = options?.displayState ?? options?.gameState;
  if (bankDisplayState && shouldIncludeBankHandCommandLine(bankDisplayState)) {
    lines.push(`${formatBankHandPhrase(bankDisplayState)} against your ${playerScore}${splitNote}.`);
  }

  if (options?.gameState && options.handKey && options.gameState.blackjack) {
    const handOptions = resolvePlayerHandActionOptions(
      options.gameState,
      options.handKey,
      {
        allowDoubleDown:
          options.allowDouble ?? options.gameState.blackjackSettings.allowDoubleDown,
        allowSplit: options.allowSplit ?? options.gameState.blackjackSettings.allowSplit,
      },
      Boolean(options.gameState.deck),
    );
    lines.push(...resolvePlayerHandCommandLines(handOptions));
  }

  const turnLine = `${boxLabel} — ${playerLabel} — your turn.`;
  const detailLines = lines.filter((line) => line.trim().length > 0);

  return {
    commandMessage:
      detailLines.length > 0 ? `${turnLine}\n${detailLines.join('\n')}` : turnLine,
    commandLines: [],
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
  return `Box ${slotNum ?? '?'} — ${callerName?.trim() || 'player'} — your turn.`;
}

/** Gold command-area hints (split/double) vs green generic turn lines. */
export function isTableInstructionMessage(message: string | null | undefined): boolean {
  if (!message?.trim()) {
    return false;
  }
  return /^Options:/i.test(message) || /^(Double|Split) available\./i.test(message);
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
  displayState: GameState,
  handKey: string,
): { value: number; isSoft: boolean; isBlackjack: boolean; handIndex: number; actionStatus?: string } | null {
  const round = displayState.blackjack;
  const deck = displayState.deck;
  if (!round || !deck) {
    return null;
  }
  const hand = round.playerHands[handKey];
  if (!hand) {
    return null;
  }
  const displayedValue = getDisplayedHandValue(deck, round, handKey);
  if (displayedValue === null) {
    return null;
  }
  const visibleIds = (round.playerHands[handKey]?.cardIds ?? []).filter(Boolean);
  if (visibleIds.length === 0) {
    return null;
  }
  const { isSoft, isBlackjack } = getBlackjackHandValue(cardsFromIds(deck, visibleIds));
  const { handIndex } = parseBlackjackHandKey(handKey);
  return {
    value: displayedValue,
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
  /** Masked visual state for paced reveal — dealer/player phrases follow visible cards only. */
  displayState?: GameState;
  cardRevealComplete?: boolean;
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
    displayState: displayStateParam,
    cardRevealComplete = true,
    gameEnded,
    gameOverMessage: _gameOverMessage,
    centerStatus,
    protocolPhase,
    roundSummaryLines,
    controllerName,
    viewerPersonId: viewerPersonIdParam,
    viewerHints,
  } = params;
  const displayState = displayStateParam ?? gameState;
  const viewerPersonId =
    viewerPersonIdParam ??
    (viewerHints ? resolveViewerPersonId(gameState, viewerHints) : null) ??
    resolveControllerPersonId(gameState, controllerName);
  const round = gameState.blackjack;
  const { players } = gameState;

  if (gameEnded) {
    return { commandMessage: null, commandLines: [] };
  }

  if (gameState.tableMeta.awaitingNextRound) {
    return {
      commandMessage: 'Round complete — press New Cards, then place bets for the next hand.',
      commandLines: [],
    };
  }

  if (roundSummaryLines.length > 0 && cardRevealComplete) {
    return { commandMessage: 'Round finished. Summary ready.', commandLines: [] };
  }

  if (protocolPhase === 'betting' && gameState.tableMeta.tableNotice?.message) {
    return {
      commandMessage: gameState.tableMeta.tableNotice.message,
      commandLines: [],
    };
  }

  if (round?.evenMoneyOfferHandKey) {
    const revealCtx = createUiRevealContext(
      gameState,
      displayState,
      cardRevealComplete,
    );
    if (!canShowEvenMoneyDecisionUi(revealCtx)) {
      return { commandMessage: 'Dealing…', commandLines: [] };
    }
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
    const caller = players[first.personId];
    const displayName = caller?.controllerName?.trim() || caller?.displayName?.trim() || 'player';
    const boxLabel = `Box ${first.slotNumber ?? first.slotNumbers[0] ?? '?'}`;
    return {
      commandMessage: `${boxLabel} — ${displayName} — your insurance call.`,
      commandLines: ['Insurance pays 2:1 when the bank has blackjack.'],
    };
  }

  if (protocolPhase === 'player') {
    if (round?.status !== 'player-turns' || !round.activeHandKey) {
      return {
        commandMessage: sanitizeCommandStatusForVisibleBank(
          polishCenterStatusMessage(centerStatus, protocolPhase),
          displayState,
          protocolPhase,
          cardRevealComplete,
        ),
        commandLines: [],
      };
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

    const handContext = resolveHandCommandContext(displayState, turnHandKey);
    if (handContext) {
      return formatPlayerTurnCommand(activeSlotNum, callerName, handContext, {
        handIndex: handContext.handIndex,
        actionStatus: handContext.actionStatus,
        gameState,
        displayState,
        handKey: turnHandKey,
        allowSplit: gameState.blackjackSettings.allowSplit,
        allowDouble: gameState.blackjackSettings.allowDoubleDown,
        cardRevealComplete,
      });
    }

    return {
      commandMessage: formatCallerTurnMessage(activeSlotNum, callerName),
      commandLines: [],
    };
  }

  const rawCommand: CommandMessage = {
    commandMessage: sanitizeCommandStatusForVisibleBank(
      polishCenterStatusMessage(centerStatus, protocolPhase),
      displayState,
      protocolPhase,
      cardRevealComplete,
    ),
    commandLines: [],
  };

  return gateCommandForReveal(
    createUiRevealContext(gameState, displayState, cardRevealComplete),
    rawCommand,
    protocolPhase,
  );
}

/** @deprecated Use buildBlackjackCommandText */
export const buildTableCommandDisplay = buildBlackjackCommandText;
