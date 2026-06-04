import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../types';
import { isNaturalInitialDeal } from '../engine/blackjack/dealing/dealingModes';
import { cardDealDelayMs } from '../engine/blackjack/flowSettings';
import {
  applyCardVisibility,
  applyRevealStep,
  buildInitialRevealSteps,
  maxVisibilityForRound,
  totalCardCount,
  type CardVisibilityCounts,
} from '../engine/blackjack/dealing/cardRevealDisplay';

function countsEqual(a: CardVisibilityCounts, b: CardVisibilityCounts): boolean {
  if (a.dealer !== b.dealer) {
    return false;
  }
  const keys = new Set([...Object.keys(a.hands), ...Object.keys(b.hands)]);
  for (const k of keys) {
    if ((a.hands[k] ?? 0) !== (b.hands[k] ?? 0)) {
      return false;
    }
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function incrementVisibility(
  current: CardVisibilityCounts,
  target: CardVisibilityCounts,
): CardVisibilityCounts {
  if (current.dealer < target.dealer) {
    return { ...current, dealer: current.dealer + 1 };
  }
  const hands = { ...current.hands };
  for (const [handKey, targetCount] of Object.entries(target.hands)) {
    const cur = hands[handKey] ?? 0;
    if (cur < targetCount) {
      hands[handKey] = cur + 1;
      return { ...current, hands };
    }
  }
  return target;
}

function nextInitialStepReveal(
  visible: CardVisibilityCounts,
  round: NonNullable<GameState['blackjack']>,
): CardVisibilityCounts | null {
  const steps = buildInitialRevealSteps(round);
  for (const step of steps) {
    const after = applyRevealStep(visible, step);
    if (!countsEqual(after, visible)) {
      const target = maxVisibilityForRound(round);
      if (totalCardCount(after) <= totalCardCount(target)) {
        return after;
      }
    }
  }
  return null;
}

/**
 * Natural dealing: authoritative state updates immediately; UI reveals cards one-by-one.
 */
export function useSequentialCardReveal(
  gameState: GameState,
  options?: { onlineMode?: boolean },
): { displayState: GameState; isRevealing: boolean } {
  const natural = isNaturalInitialDeal(gameState.blackjackFlowSettings.initialDealMode);
  const onlineMode = options?.onlineMode ?? false;

  const [displayState, setDisplayState] = useState(gameState);
  const [isRevealing, setIsRevealing] = useState(false);

  const visibleRef = useRef<CardVisibilityCounts>({ dealer: 0, hands: {} });
  const runIdRef = useRef(0);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  useEffect(() => {
    if (!natural) {
      visibleRef.current = maxVisibilityForRound(gameState.blackjack);
      setDisplayState(gameState);
      setIsRevealing(false);
      return;
    }

    const target = maxVisibilityForRound(gameState.blackjack);
    const current = visibleRef.current;
    if (countsEqual(current, target)) {
      setDisplayState(gameState);
      setIsRevealing(false);
      return;
    }

    const delta = totalCardCount(target) - totalCardCount(current);
    const roundStatus = gameState.blackjack?.status;
    const paceSingleCard =
      roundStatus === 'player-turns' ||
      roundStatus === 'bank-turn' ||
      roundStatus === 'banking';
    if (!onlineMode && delta <= 1 && !paceSingleCard) {
      visibleRef.current = target;
      setDisplayState(gameState);
      setIsRevealing(false);
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setIsRevealing(true);

    void (async () => {
      while (runIdRef.current === runId) {
        const authoritative = gameStateRef.current;
        const authoritativeTarget = maxVisibilityForRound(authoritative.blackjack);
        let visible = visibleRef.current;

        if (countsEqual(visible, authoritativeTarget)) {
          break;
        }

        const delay = cardDealDelayMs(authoritative.blackjackFlowSettings);
        const round = authoritative.blackjack;
        const useOrdered =
          round &&
          totalCardCount(authoritativeTarget) - totalCardCount(visible) > 1;
        const orderedNext = useOrdered ? nextInitialStepReveal(visible, round) : null;

        visible = orderedNext ?? incrementVisibility(visible, authoritativeTarget);
        visibleRef.current = visible;
        setDisplayState(applyCardVisibility(authoritative, visible));
        await sleep(delay);
      }

      if (runIdRef.current === runId) {
        const final = gameStateRef.current;
        visibleRef.current = maxVisibilityForRound(final.blackjack);
        setDisplayState(final);
        setIsRevealing(false);
      }
    })();
  }, [gameState, natural, onlineMode]);

  return { displayState: natural ? displayState : gameState, isRevealing };
}
