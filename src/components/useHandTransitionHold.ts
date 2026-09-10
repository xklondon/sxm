import { useEffect, useRef, useState } from 'react';

import { orderedHandKeys, parseBlackjackHandKey } from '../engine/blackjack';
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
  const seededRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FIFO of hands awaiting their result hold — simultaneous transitions
  // (multi-box bust resolution in one server update) must each get a hold
  // instead of the last write silently replacing earlier ones.
  const [pendingHoldHandKeys, setPendingHoldHandKeys] = useState<string[]>([]);

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
    setPendingHoldHandKeys((keys) => keys.filter((key) => key !== handKey));
    setHold({ holdActive: true, holdActiveBoxId: playerId, holdActiveHandKey: handKey });
    clearTimer();
    timerRef.current = setTimeout(() => {
      setHold({ holdActive: false, holdActiveBoxId: null, holdActiveHandKey: null });
      timerRef.current = null;
    }, resultHoldDelayMs());
  }

  function queueHold(handKey: string) {
    setPendingHoldHandKeys((keys) => (keys.includes(handKey) ? keys : [...keys, handKey]));
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
      setPendingHoldHandKeys([]);
      setHold({ holdActive: false, holdActiveBoxId: null, holdActiveHandKey: null });
      prevStatusRef.current.clear();
      prevCardCountRef.current.clear();
      prevActiveHandKeyRef.current = null;
      seededRef.current = false;
      clearTimer();
      return;
    }

    const round = gameState.blackjack;
    if (!round) {
      return;
    }

    // First observation of this round (fresh mount / rejoin mid-round): seed
    // the baseline without queueing holds — a hand that is already busted or
    // stood is old news to this viewer, not a transition to re-announce.
    if (!seededRef.current) {
      seededRef.current = true;
      for (const [handKey, hand] of Object.entries(round.playerHands)) {
        prevStatusRef.current.set(handKey, hand.actionStatus ?? '');
        prevCardCountRef.current.set(handKey, hand.cardIds.filter((id) => id.length > 0).length);
      }
      prevActiveHandKeyRef.current = round.activeHandKey ?? null;
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

    // Drain pending holds in canonical table order (same ordering the felt
    // renders), not queue-insertion order.
    if (pendingHoldHandKeys.length > 0 && !hold.holdActive) {
      const canonical = orderedHandKeys(gameState.session, round);
      const ordered = [...pendingHoldHandKeys].sort(
        (a, b) => canonical.indexOf(a) - canonical.indexOf(b),
      );
      const ready = ordered.find(
        (key) =>
          options.cardRevealComplete &&
          !options.isRevealing &&
          pendingHandRevealReady(key, round),
      );
      if (ready) {
        startHold(ready);
      }
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
    pendingHoldHandKeys,
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
    suppressEngineAutoAdvance: hold.holdActive || pendingHoldHandKeys.length > 0,
    playerActionsBlocked:
      hold.holdActive ||
      pendingHoldHandKeys.length > 0 ||
      (options.isRevealing && !options.activeHandRevealComplete),
  };
}
