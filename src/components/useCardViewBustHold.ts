import { useEffect, useRef, useState } from 'react';

import { parseBlackjackHandKey } from '../engine/blackjack';
import { cardsFromIds, getBlackjackHandValue } from '../engine/blackjack/hand';
import type { GameState } from '../types';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';

import { waitForResultHoldMs } from '../engine/blackjack/dealPacing';

export interface CardViewHandHold {
  holdBoxId: string | null;
  holdHandKey: string | null;
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

/**
 * Card View only — after hit, keep busted or 18+ auto-stood hands visible briefly
 * before the UI follows engine turn advance.
 */
export function useCardViewBustHold(
  gameState: GameState,
  protocolPhase: BlackjackProtocolPhase,
  enabled: boolean,
): CardViewHandHold {
  const [hold, setHold] = useState<CardViewHandHold>({ holdBoxId: null, holdHandKey: null });
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const prevCardCountRef = useRef<Map<string, number>>(new Map());
  const prevActiveHandKeyRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startHold(handKey: string) {
    const { playerId } = parseBlackjackHandKey(handKey);
    setHold({ holdBoxId: playerId, holdHandKey: handKey });
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    const delay = waitForResultHoldMs(gameState);
    timerRef.current = setTimeout(() => {
      setHold({ holdBoxId: null, holdHandKey: null });
      timerRef.current = null;
    }, delay);
  }

  useEffect(() => {
    if (!enabled || protocolPhase !== 'player') {
      setHold({ holdBoxId: null, holdHandKey: null });
      prevStatusRef.current.clear();
      prevCardCountRef.current.clear();
      prevActiveHandKeyRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
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
      prevActiveHandKey !== activeHandKey
    ) {
      const prevHand = round.playerHands[prevActiveHandKey];
      if (prevHand?.actionStatus === 'busted') {
        startHold(prevActiveHandKey);
      } else if (
        prevHand?.actionStatus === 'stood' &&
        handTotalAtLeast18(gameState, prevActiveHandKey)
      ) {
        startHold(prevActiveHandKey);
      }
    }

    for (const [handKey, hand] of Object.entries(round.playerHands)) {
      const prev = prevStatusRef.current.get(handKey);
      const next = hand.actionStatus ?? '';
      const cardCount = hand.cardIds.filter((id) => id.length > 0).length;
      const prevCardCount = prevCardCountRef.current.get(handKey);
      if (next === 'busted' && prev !== 'busted') {
        startHold(handKey);
      } else if (
        next === 'stood' &&
        prev === 'acting' &&
        handTotalAtLeast18(gameState, handKey) &&
        prevCardCount !== undefined &&
        cardCount > prevCardCount
      ) {
        startHold(handKey);
      }
      prevStatusRef.current.set(handKey, next);
      prevCardCountRef.current.set(handKey, cardCount);
    }

    prevActiveHandKeyRef.current = activeHandKey;
  }, [enabled, gameState, protocolPhase]);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return hold;
}
