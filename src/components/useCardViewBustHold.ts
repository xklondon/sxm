import { useEffect, useRef, useState } from 'react';

import { parseBlackjackHandKey } from '../engine/blackjack';
import type { GameState } from '../types';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';

import { CARD_VIEW_BUST_HOLD_MS } from './blackjackUxConstants';

/**
 * When a hand busts in Card View, keep the hero on that box briefly so the player
 * sees the bust before the UI follows server/engine turn advance.
 */
export function useCardViewBustHold(
  gameState: GameState,
  protocolPhase: BlackjackProtocolPhase,
  enabled: boolean,
): string | null {
  const [holdBoxId, setHoldBoxId] = useState<string | null>(null);
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || protocolPhase !== 'player') {
      setHoldBoxId(null);
      prevStatusRef.current.clear();
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

    for (const [handKey, hand] of Object.entries(round.playerHands)) {
      const prev = prevStatusRef.current.get(handKey);
      const next = hand.actionStatus ?? '';
      if (next === 'busted' && prev !== 'busted') {
        const { playerId } = parseBlackjackHandKey(handKey);
        setHoldBoxId(playerId);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          setHoldBoxId(null);
          timerRef.current = null;
        }, CARD_VIEW_BUST_HOLD_MS);
      }
      prevStatusRef.current.set(handKey, next);
    }
  }, [enabled, gameState, protocolPhase]);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return holdBoxId;
}
