import { useEffect, useRef, useState } from 'react';

import { parseBlackjackHandKey } from '../engine/blackjack';
import { cardsFromIds, getBlackjackHandValue } from '../engine/blackjack/hand';
import { waitForResultHoldMs } from '../engine/blackjack/dealPacing';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';
import { isPlayerTurnPhase } from './blackjackViewPhase';
import type { GameState } from '../types';

export interface HandTransitionHold {
  holdActive: boolean;
  holdActiveBoxId: string | null;
  holdActiveHandKey: string | null;
  suppressEngineAutoAdvance: boolean;
  playerActionsBlocked: boolean;
}

function handTotalAtLeast18(state: GameState, handKey: string): boolean {
  const hand = state.blackjack?.playerHands[handKey];
  const deck = state.deck;
  if (!hand || !deck) {
    return false;
  }
  const cards = cardsFromIds(deck, hand.cardIds.filter(Boolean));
  const { value } = getBlackjackHandValue(cards);
  return value >= 18;
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
  if (
    status === 'stood' &&
    prevStatus === 'acting' &&
    handTotalAtLeast18(state, handKey)
  ) {
    return true;
  }
  return false;
}

/**
 * Holds the previous hand/box visible after bust, 18+ auto-stand, or turn advance
 * for the configured result-hold duration (deal speed preset).
 */
export function useHandTransitionHold(
  gameState: GameState,
  protocolPhase: BlackjackProtocolPhase,
  options: {
    cardRevealComplete: boolean;
    activeHandRevealComplete: boolean;
    isRevealing: boolean;
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

  function startHold(handKey: string) {
    const { playerId } = parseBlackjackHandKey(handKey);
    setPendingHoldHandKey(null);
    setHold({ holdActive: true, holdActiveBoxId: playerId, holdActiveHandKey: handKey });
    clearTimer();
    const delay = waitForResultHoldMs(gameState);
    timerRef.current = setTimeout(() => {
      setHold({ holdActive: false, holdActiveBoxId: null, holdActiveHandKey: null });
      timerRef.current = null;
    }, delay);
  }

  function queueHold(handKey: string) {
    setPendingHoldHandKey(handKey);
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
      queueHold(prevActiveHandKey);
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
        handTotalAtLeast18(gameState, handKey) &&
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
      (pending == null ||
        options.activeHandRevealComplete ||
        round.playerHands[pending]?.actionStatus !== 'acting');

    if (pending && revealReady && !hold.holdActive) {
      startHold(pending);
    }

    prevActiveHandKeyRef.current = activeHandKey;
  }, [
    gameState,
    hold.holdActive,
    pendingHoldHandKey,
    options.activeHandRevealComplete,
    options.cardRevealComplete,
    options.isRevealing,
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
      hold.holdActive || pendingHoldHandKey != null || options.isRevealing,
  };
}
