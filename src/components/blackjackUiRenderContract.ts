/**
 * blackjackUiRenderContract.ts — authoritative UI render contract.
 *
 * Game state may know outcomes before the UI may show them. All visible messaging,
 * badges, decision overlays, and cloth-adjacent status must pass through reveal-gated
 * selectors here — never render raw engine result state directly.
 *
 * Layout zone geometry: tableLayoutEngine.ts (shell owns zones; inner components own
 * card arrangement inside the cards zone only).
 */

import type { GameState } from '../types';
import type { BlackjackOutcome } from '../types/blackjack';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';
import { getDisplayBlackjackProtocolPhase } from '../engine/blackjack/protocol';
import { isHandFullyVisibleInDisplay } from '../engine/blackjack/dealing/cardRevealDisplay';
import {
  resolveCardAreaOutcomeMarker,
  type CardAreaOutcomeMarker,
} from './cardAreaOutcomeDisplay';
import type { CommandMessage } from './tableCommandDisplay';

/** Canonical command component path: BlackjackCommandBox → DealerCommandArea. */
export const CANONICAL_COMMAND_WRAPPER_CLASS = 'bj-card-layout__command';

/** Canonical command text — yellow/gold on all views (see bj-table-shared.css). */
export const CANONICAL_COMMAND_STATUS_CLASS = 'dealer-block__status dealer-block__status--canonical';

export interface UiRevealContext {
  gameState: GameState;
  displayState: GameState;
  cardRevealComplete: boolean;
}

export function createUiRevealContext(
  gameState: GameState,
  displayState: GameState,
  cardRevealComplete: boolean,
): UiRevealContext {
  return { gameState, displayState, cardRevealComplete };
}

/** All dealt cards for handKey are visible in displayState (paced reveal caught up). */
export function isHandVisiblyRevealed(
  ctx: UiRevealContext,
  handKey: string | null | undefined,
): boolean {
  if (!handKey) {
    return false;
  }
  if (ctx.cardRevealComplete) {
    return true;
  }
  return isHandFullyVisibleInDisplay(ctx.gameState, ctx.displayState, handKey);
}

/** Primary hand on a box (handIndex 0). */
export function isBoxVisiblyRevealed(
  ctx: UiRevealContext,
  boxPlayerId: string,
  handIndex = 0,
): boolean {
  return isHandVisiblyRevealed(ctx, `${boxPlayerId}:${handIndex}`);
}

/** UI-facing protocol phase — defers insurance/even-money until reveal catches up. */
export function resolveUiProtocolPhase(ctx: UiRevealContext): BlackjackProtocolPhase {
  return getDisplayBlackjackProtocolPhase(
    ctx.gameState,
    ctx.cardRevealComplete,
    ctx.displayState,
  );
}

export function canShowInsuranceDecisionUi(
  ctx: UiRevealContext,
  protocolPhase: BlackjackProtocolPhase,
): boolean {
  if (protocolPhase !== 'insurance') {
    return false;
  }
  if (!ctx.gameState.blackjack?.insuranceOfferPending) {
    return false;
  }
  return ctx.cardRevealComplete;
}

export function canShowEvenMoneyDecisionUi(ctx: UiRevealContext): boolean {
  const offerKey = ctx.gameState.blackjack?.evenMoneyOfferHandKey;
  if (!offerKey) {
    return false;
  }
  return isHandVisiblyRevealed(ctx, offerKey);
}

export function canShowHandOutcomeBadge(
  ctx: UiRevealContext,
  handKey: string | null | undefined,
): boolean {
  return isHandVisiblyRevealed(ctx, handKey);
}

/** Result badges (BJ / BUST / WIN) — gated by reveal before resolveCardAreaOutcomeMarker. */
export function resolveGatedCardAreaOutcomeMarker(
  ctx: UiRevealContext,
  options: {
    showResults: boolean;
    outcome: BlackjackOutcome | undefined;
    actionStatus: string | undefined;
    handKey: string | null | undefined;
    handTotal?: number | null;
  },
): CardAreaOutcomeMarker | null {
  if (!canShowHandOutcomeBadge(ctx, options.handKey)) {
    return null;
  }
  return resolveCardAreaOutcomeMarker(
    options.showResults,
    options.outcome,
    options.actionStatus,
    options.handTotal,
  );
}

const PREMATURE_RESULT_PATTERN =
  /even.?money|blackjack|1:1|3:2|insurance pays|take even/i;

/** Strip result/decision command text until the relevant hand is visibly revealed. */
export function gateCommandMessageForReveal(
  ctx: UiRevealContext,
  commandMessage: string | null,
  protocolPhase: BlackjackProtocolPhase,
): string | null {
  if (!commandMessage?.trim()) {
    return commandMessage;
  }

  const round = ctx.gameState.blackjack;
  const offerKey = round?.evenMoneyOfferHandKey;

  if (offerKey && !isHandVisiblyRevealed(ctx, offerKey)) {
    if (PREMATURE_RESULT_PATTERN.test(commandMessage)) {
      return 'Dealing…';
    }
  }

  const activeKey = round?.activeHandKey ?? offerKey;
  if (activeKey && !isHandVisiblyRevealed(ctx, activeKey)) {
    if (/,\s*Blackjack\.?$/i.test(commandMessage) || /\bBlackjack\b/i.test(commandMessage)) {
      return 'Dealing…';
    }
  }

  if (protocolPhase === 'dealing' && !ctx.cardRevealComplete && PREMATURE_RESULT_PATTERN.test(commandMessage)) {
    return 'Dealing…';
  }

  return commandMessage;
}

/** Apply reveal gate to a full command payload. */
export function gateCommandForReveal(
  ctx: UiRevealContext,
  command: CommandMessage,
  protocolPhase: BlackjackProtocolPhase,
): CommandMessage {
  return {
    commandMessage: gateCommandMessageForReveal(ctx, command.commandMessage, protocolPhase),
    commandLines: command.commandLines,
  };
}
