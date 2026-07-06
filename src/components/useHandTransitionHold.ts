import { useEffect, useRef, useState } from 'react';

import { parseBlackjackHandKey } from '../engine/blackjack';
import { cardsFromIds } from '../engine/blackjack/hand';
import { getCallerPersonIdForBox } from '../engine/session/playerAssignment';
import { waitForResultHoldMs } from '../engine/blackjack/dealPacing';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';
import { getPlayFlowForPerson, handWasAutoStoppedByEngine } from '../engine/blackjack/playFlow';
import { isPlayerTurnPhase } from './blackjackViewPhase';
import { CARD_VIEW_BUST_HOLD_MS } from './blackjackUxConstants';
import type { GameState } from '../types';

export interface HandTransitionHold {
  holdActive: boolean;
  holdActiveBoxId: string | null;
  holdActiveHandKey: string | null;
  suppressEngineAutoAdvance: boolean;
  playerActionsBlocked: boolean;
}

function handTriggeredAutoStand(state: GameState, handKey: string): boolean {
  const hand = state.blackjack?.playerHands[handKey];
  const deck = state.deck;
  if (!hand || !deck) {
    return false;
  }
  const { playerId } = parseBlackjackHandKey(handKey);
  const callerId = getCallerPersonIdForBox(state, playerId);
  if (!callerId) {
    return false;
  }
  const cards = cardsFromIds(deck, hand.cardIds.filter(Boolean));
  return handWasAutoStoppedByEngine(
    state,
    handKey,
    getPlayFlowForPerson(state, callerId),
    cards,
  );
}

function handNeedsResultHold(
  state: GameState,
  handKey: string,
  prevStatus: string | undefined,
): boolean {
  const hand = state.blackjack?.playerHands[handKey];
  if (!hand) {
    return false;
  }
  const status = hand.actionStatus ?? '';
  if (status === 'busted' && prevStatus !== 'busted') {
    return true;
  }
  if (status === 'stood' && prevStatus === 'acting' && handTriggeredAutoStand(state, handKey)) {
    return true;
  }
  return false;
}

/**
 * Holds the previous hand/box visible after bust, 18+ auto-stand, or turn advance
 * for the configured result-hold duration (deal speed preset, or Card View fixed hold).
 */
export function useHandTransitionHold(
  gameState: GameState,
  protocolPhase: BlackjackProtocolPhase,
  options: {
    cardRevealComplete: boolean;
    activeHandRevealComplete: boolean;
    isRevealing: boolean;
    cardViewMode?: boolean;
    isHandRevealComplete?: (handKey: string) => boolean;
  },
): HandTransitionHold {
  const [hold, setHold] = useState<{
    holdActive: boolean;
    holdActiveBoxId: string | null;
    holdActiveHandKey: string | null;
  }>({ holdActive: false, holdActiveBoxId: null, holdActiveHandKey: null });

  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const prevCardCountRef = useRef<Map<string, number>>(new Map());
  const prevActiveHandKeyRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingHoldHandKey, setPendingHoldHandKey] = useState<string | null>(null);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function resultHoldDelayMs(): number {
    if (options.cardViewMode) {
      return CARD_VIEW_BUST_HOLD_MS;
    }
    return waitForResultHoldMs(gameState);
  }

  function startHold(handKey: string) {
    const { playerId } = parseBlackjackHandKey(handKey);
    setPendingHoldHandKey(null);
    setHold({ holdActive: true, holdActiveBoxId: playerId, holdActiveHandKey: handKey });
    clearTimer();
    timerRef.current = setTimeout(() => {
      setHold({ holdActive: false, holdActiveBoxId: null, holdActiveHandKey: null });
      timerRef.current = null;
    }, resultHoldDelayMs());
  }

  function queueHold(handKey: string) {
    setPendingHoldHandKey(handKey);
  }

  function pendingHandRevealReady(pending: string, round: NonNullable<GameState['blackjack']>): boolean {
    if (options.isHandRevealComplete) {
      return options.isHandRevealComplete(pending);
    }
    return (
      options.activeHandRevealComplete || round.playerHands[pending]?.actionStatus !== 'acting'
    );
  }

  useEffect(() => {
    if (!isPlayerTurnPhase(protocolPhase)) {
      setPendingHoldHandKey(null);
      setHold({ holdActive: false, holdActiveBoxId: null, holdActiveHandKey: null });
      prevStatusRef.current.clear();
      prevCardCountRef.current.clear();
      prevActiveHandKeyRef.current = null;
      clearTimer();
      return;
    }

    const round = gameState.blackjack;
    if (!round) {
      return;
    }

    const activeHandKey = round.activeHandKey ?? null;
    const prevActiveHandKey = prevActiveHandKeyRef.current;

    if (
      prevActiveHandKey &&
      activeHandKey &&
      prevActiveHandKey !== activeHandKey &&
      !hold.holdActive
    ) {
      const prevHand = round.playerHands[prevActiveHandKey];
      if (
        prevHand?.actionStatus === 'busted' ||
        (prevHand?.actionStatus === 'stood' && handTriggeredAutoStand(gameState, prevActiveHandKey))
      ) {
        queueHold(prevActiveHandKey);
      }
    }

    for (const [handKey, hand] of Object.entries(round.playerHands)) {
      const prev = prevStatusRef.current.get(handKey);
      const next = hand.actionStatus ?? '';
      const cardCount = hand.cardIds.filter((id) => id.length > 0).length;
      const prevCardCount = prevCardCountRef.current.get(handKey);
      if (handNeedsResultHold(gameState, handKey, prev)) {
        queueHold(handKey);
      } else if (
        next === 'stood' &&
        prev === 'acting' &&
        handTriggeredAutoStand(gameState, handKey) &&
        prevCardCount !== undefined &&
        cardCount > prevCardCount
      ) {
        queueHold(handKey);
      }
      prevStatusRef.current.set(handKey, next);
      prevCardCountRef.current.set(handKey, cardCount);
    }

    const pending = pendingHoldHandKey;
    const revealReady =
      options.cardRevealComplete &&
      !options.isRevealing &&
      (pending == null || pendingHandRevealReady(pending, round));

    if (pending && revealReady && !hold.holdActive) {
      startHold(pending);
    }

    prevActiveHandKeyRef.current = activeHandKey;
  }, [
    gameState,
    hold.holdActive,
    options.cardRevealComplete,
    options.cardViewMode,
    options.activeHandRevealComplete,
    options.isHandRevealComplete,
    options.isRevealing,
    pendingHoldHandKey,
    protocolPhase,
  ]);

  useEffect(
    () => () => {
      clearTimer();
    },
    [],
  );

  return {
    holdActive: hold.holdActive,
    holdActiveBoxId: hold.holdActiveBoxId,
    holdActiveHandKey: hold.holdActiveHandKey,
    suppressEngineAutoAdvance: hold.holdActive || pendingHoldHandKey != null,
    playerActionsBlocked:
      hold.holdActive ||
      pendingHoldHandKey != null ||
      (options.isRevealing && !options.activeHandRevealComplete),
  };
}
