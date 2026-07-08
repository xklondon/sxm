import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../types';
import {
  isInstantInitialDeal,
  isStagedInitialDeal,
} from '../engine/blackjack/dealing/dealingModes';
import {
  applyCardVisibility,
  cardRevealScopeKey,
  emptyCardVisibility,
  hasPendingCardReveal,
  hasPendingInitialDealReveal,
  isActiveHandRevealComplete,
  isStaleHandVisibility,
  maxVisibilityForRound,
  nextSequentialRevealStep,
  resolveRevealScopeTransition,
  shouldSnapCardRevealOnMount,
  shouldUseOrderedInitialReveal,
  totalCardCount,
  type CardVisibilityCounts,
} from '../engine/blackjack/dealing/cardRevealDisplay';
import { scheduleNextCardReveal } from '../engine/blackjack/dealPacing';
import { getNextCardDelay } from '../engine/blackjack/flowSettings';
import { log } from '../utils/logger';

/** Max reveal steps with no progress before display-only watchdog snap. */
export const REVEAL_WATCHDOG_MAX_STUCK_STEPS = 5;

/** Bounded ms cap for reveal watchdog (display-only snap). */
export const REVEAL_WATCHDOG_MAX_MS = 15_000;

export function computeRevealWatchdogTimeoutMs(state: GameState): number {
  const perStep = getNextCardDelay(state);
  return Math.min(REVEAL_WATCHDOG_MAX_MS, perStep * REVEAL_WATCHDOG_MAX_STUCK_STEPS);
}

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

    if (gameState.tableMeta.gameStatus === 'ended') {
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
      if (!scopeKeyRef.current && shouldSnapCardRevealOnMount(gameState)) {
        hydrateInstant(gameState);
        scopeKeyRef.current = scopeKey;
        return;
      }
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
      let stuckSteps = 0;
      const watchdogStartedAt = Date.now();

      const snapRevealToTarget = (
        authoritative: GameState,
        target: CardVisibilityCounts,
        reason: 'watchdog-steps' | 'watchdog-timeout',
      ) => {
        const round = authoritative.blackjack;
        let visible = visibleRef.current;
        const maxSteps =
          reason === 'watchdog-timeout'
            ? Math.max(REVEAL_WATCHDOG_MAX_STUCK_STEPS, totalCardCount(target) - totalCardCount(visible))
            : 1;
        for (let i = 0; i < maxSteps; i += 1) {
          if (countsEqual(visible, target)) {
            break;
          }
          const stepped = round
            ? nextSequentialRevealStep(visible, target, round, round.status)
            : nextSequentialRevealStep(visible, target, null, undefined);
          if (!stepped || countsEqual(stepped, visible)) {
            break;
          }
          visible = stepped;
        }
        visibleRef.current = visible;
        setDisplayState(applyCardVisibility(authoritative, visible));
        setIsRevealing(!countsEqual(visible, target));
        setActiveHandRevealComplete(computeActiveHandRevealComplete(authoritative, visible, pacedReveal));
        log.warn('[cardReveal] watchdog snap — reveal queue stalled', {
          reason,
          sessionId: authoritative.session.id,
          round: authoritative.session.currentRound,
          pendingCards: totalCardCount(target) - totalCardCount(visible),
        });
      };

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

        if (
          stuckSteps >= REVEAL_WATCHDOG_MAX_STUCK_STEPS &&
          hasPendingCardReveal(visible, authoritativeTarget) &&
          Date.now() - watchdogStartedAt >= computeRevealWatchdogTimeoutMs(authoritative)
        ) {
          snapRevealToTarget(authoritative, authoritativeTarget, 'watchdog-timeout');
          break;
        }

        const round = authoritative.blackjack;
        const stepped = round
          ? nextSequentialRevealStep(visible, authoritativeTarget, round, round.status)
          : nextSequentialRevealStep(visible, authoritativeTarget, null, undefined);

        if (!stepped) {
          if (
            round &&
            shouldUseOrderedInitialReveal(round, visible, authoritativeTarget)
          ) {
            if (
              hasPendingCardReveal(visible, authoritativeTarget) &&
              !isStagedInitialDeal(authoritative.blackjackFlowSettings.initialDealMode)
            ) {
              await scheduleNextCardReveal(authoritative);
              continue;
            }
            break;
          }
          if (!hasPendingCardReveal(visible, authoritativeTarget)) {
            break;
          }
          stuckSteps += 1;
          if (
            stuckSteps >= REVEAL_WATCHDOG_MAX_STUCK_STEPS &&
            !isStagedInitialDeal(authoritative.blackjackFlowSettings.initialDealMode) &&
            !(
              round &&
              hasPendingInitialDealReveal(visible, round)
            )
          ) {
            snapRevealToTarget(authoritative, authoritativeTarget, 'watchdog-steps');
            break;
          }
        } else {
          stuckSteps = 0;
        }

        visible = stepped ?? visible;
        visibleRef.current = visible;
        setDisplayState(applyCardVisibility(authoritative, visible));
        setActiveHandRevealComplete(
          computeActiveHandRevealComplete(authoritative, visible, pacedReveal),
        );

        if (!isStagedInitialDeal(authoritative.blackjackFlowSettings.initialDealMode)) {
          await scheduleNextCardReveal(authoritative);
        }
        if (stagedManual && !countsEqual(visible, authoritativeTarget)) {
          break;
        }
      }

      if (runIdRef.current === runId) {
        const final = gameStateRef.current;
        const finalTarget = maxVisibilityForRound(final.blackjack);
        const visibleNow = visibleRef.current;
        const revealComplete = countsEqual(visibleNow, finalTarget);
        if (revealComplete) {
          visibleRef.current = finalTarget;
        }
        setDisplayState(applyCardVisibility(final, revealComplete ? finalTarget : visibleNow));
        setIsRevealing(!revealComplete && hasPendingCardReveal(visibleNow, finalTarget));
        setActiveHandRevealComplete(
          computeActiveHandRevealComplete(final, revealComplete ? finalTarget : visibleNow, pacedReveal),
        );
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
