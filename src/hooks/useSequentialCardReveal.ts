import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../types';
import {
  isInstantInitialDeal,
  isStagedInitialDeal,
} from '../engine/blackjack/dealing/dealingModes';
import {
  applyCardVisibility,
  applyRevealStep,
  buildInitialRevealSteps,
  cardRevealScopeKey,
  emptyCardVisibility,
  hasPendingCardReveal,
  isActiveHandRevealComplete,
  isHandBoundaryRevealStep,
  isStaleHandVisibility,
  maxVisibilityForRound,
  nextGameplayRevealStep,
  resolveCardRevealDelayMs,
  resolveRevealScopeTransition,
  shouldUseOrderedInitialReveal,
  totalCardCount,
  type CardVisibilityCounts,
} from '../engine/blackjack/dealing/cardRevealDisplay';
import { sleepMs, waitForResultHoldMs } from '../engine/blackjack/dealPacing';

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

function computeActiveHandRevealComplete(
  gameState: GameState,
  visible: CardVisibilityCounts,
  pacedReveal: boolean,
): boolean {
  if (!pacedReveal) {
    return true;
  }
  return isActiveHandRevealComplete(
    gameState.blackjack,
    visible,
    gameState.blackjack?.activeHandKey ?? null,
  );
}

function nextRevealStep(
  visible: CardVisibilityCounts,
  target: CardVisibilityCounts,
  round: NonNullable<GameState['blackjack']> | null,
  roundStatus: NonNullable<GameState['blackjack']>['status'] | undefined,
): CardVisibilityCounts | null {
  if (isStaleHandVisibility(visible, target)) {
    return null;
  }
  if (
    round &&
    shouldUseOrderedInitialReveal(roundStatus, visible, target)
  ) {
    const initial = nextInitialStepReveal(visible, round);
    if (initial && !countsEqual(initial, visible)) {
      return initial;
    }
  }
  if (hasPendingCardReveal(visible, target)) {
    return nextGameplayRevealStep(visible, target);
  }
  return null;
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

export interface SequentialCardRevealOptions {
  /** Reserved for callers (online tables hydrate on first snapshot like offline join). */
  onlineMode?: boolean;
}

/**
 * Natural dealing: authoritative state updates immediately; UI reveals only NEW
 * cards after hydration. Mid-round join/table switch snaps to full visibility.
 */
export function useSequentialCardReveal(
  gameState: GameState,
  _options?: SequentialCardRevealOptions,
): { displayState: GameState; isRevealing: boolean; activeHandRevealComplete: boolean } {
  const initialDealMode = gameState.blackjackFlowSettings.initialDealMode;
  const pacedReveal = !isInstantInitialDeal(initialDealMode);
  const stagedManual = isStagedInitialDeal(initialDealMode);

  const scopeKey = cardRevealScopeKey(
    gameState.session.id,
    gameState.session.currentRound,
  );

  const visibleRef = useRef<CardVisibilityCounts>(
    pacedReveal ? emptyCardVisibility() : maxVisibilityForRound(gameState.blackjack),
  );
  const scopeKeyRef = useRef<string | null>(null);
  const runIdRef = useRef(0);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const [displayState, setDisplayState] = useState(() =>
    pacedReveal
      ? applyCardVisibility(gameState, emptyCardVisibility())
      : gameState,
  );
  const [isRevealing, setIsRevealing] = useState(false);
  const [activeHandRevealComplete, setActiveHandRevealComplete] = useState(() =>
    computeActiveHandRevealComplete(
      gameState,
      pacedReveal ? emptyCardVisibility() : maxVisibilityForRound(gameState.blackjack),
      pacedReveal,
    ),
  );

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const cancelReveal = () => {
      runIdRef.current += 1;
    };

    const hydrateInstant = (state: GameState) => {
      cancelReveal();
      const target = maxVisibilityForRound(state.blackjack);
      visibleRef.current = target;
      setDisplayState(applyCardVisibility(state, target));
      setIsRevealing(false);
      setActiveHandRevealComplete(computeActiveHandRevealComplete(state, target, pacedReveal));
    };

    const resetRevealQueue = (state: GameState) => {
      cancelReveal();
      const empty = emptyCardVisibility();
      visibleRef.current = empty;
      setDisplayState(applyCardVisibility(state, empty));
      setIsRevealing(false);
      setActiveHandRevealComplete(computeActiveHandRevealComplete(state, empty, pacedReveal));
    };

    if (!pacedReveal) {
      hydrateInstant(gameState);
      scopeKeyRef.current = scopeKey;
      return;
    }

    const transition = resolveRevealScopeTransition(scopeKeyRef.current, scopeKey);
    if (transition === 'hydrate') {
      hydrateInstant(gameState);
      scopeKeyRef.current = scopeKey;
      return;
    }
    if (transition === 'reset') {
      resetRevealQueue(gameState);
      scopeKeyRef.current = scopeKey;
    }

    const target = maxVisibilityForRound(gameState.blackjack);
    let current = visibleRef.current;

    if (isStaleHandVisibility(current, target)) {
      resetRevealQueue(gameState);
      current = emptyCardVisibility();
    }

    if (countsEqual(current, target)) {
      setDisplayState(applyCardVisibility(gameState, target));
      setIsRevealing(false);
      setActiveHandRevealComplete(computeActiveHandRevealComplete(gameState, target, pacedReveal));
      scopeKeyRef.current = scopeKey;
      return;
    }

    if (totalCardCount(target) < totalCardCount(current)) {
      hydrateInstant(gameState);
      scopeKeyRef.current = scopeKey;
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

        if (isStaleHandVisibility(visible, authoritativeTarget)) {
          visible = emptyCardVisibility();
          visibleRef.current = visible;
          setDisplayState(applyCardVisibility(authoritative, visible));
        }

        if (countsEqual(visible, authoritativeTarget)) {
          break;
        }

        if (totalCardCount(authoritativeTarget) < totalCardCount(visible)) {
          visible = authoritativeTarget;
          visibleRef.current = visible;
          setDisplayState(applyCardVisibility(authoritative, visible));
          break;
        }

        const round = authoritative.blackjack;
        const stepped = round
          ? nextRevealStep(visible, authoritativeTarget, round, round.status)
          : nextGameplayRevealStep(visible, authoritativeTarget);

        if (stepped && round && isHandBoundaryRevealStep(visible, stepped)) {
          await sleepMs(waitForResultHoldMs(authoritative));
          if (runIdRef.current !== runId) {
            break;
          }
        }

        const delay = resolveCardRevealDelayMs(
          authoritative,
          round ?? null,
          round?.status,
          visible,
          authoritativeTarget,
        );

        visible = stepped ?? authoritativeTarget;
        visibleRef.current = visible;
        setDisplayState(applyCardVisibility(authoritative, visible));
        setActiveHandRevealComplete(
          computeActiveHandRevealComplete(authoritative, visible, pacedReveal),
        );
        await sleepMs(delay);
        if (stagedManual && !countsEqual(visible, authoritativeTarget)) {
          break;
        }
      }

      if (runIdRef.current === runId) {
        const final = gameStateRef.current;
        const finalTarget = maxVisibilityForRound(final.blackjack);
        visibleRef.current = finalTarget;
        setDisplayState(applyCardVisibility(final, finalTarget));
        setIsRevealing(false);
        setActiveHandRevealComplete(computeActiveHandRevealComplete(final, finalTarget, pacedReveal));
      }
    })();

    scopeKeyRef.current = scopeKey;
  }, [gameState, pacedReveal, stagedManual, scopeKey]);

  return {
    displayState: pacedReveal ? displayState : gameState,
    isRevealing,
    activeHandRevealComplete,
  };
}
