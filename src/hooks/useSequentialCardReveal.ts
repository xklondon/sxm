import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../types';
import { isNaturalInitialDeal } from '../engine/blackjack/dealing/dealingModes';
import { cardDealDelayMs } from '../engine/blackjack/flowSettings';
import {
  applyCardVisibility,
  applyRevealStep,
  buildInitialRevealSteps,
  cardRevealScopeKey,
  hasPendingCardReveal,
  maxVisibilityForRound,
  nextGameplayRevealStep,
  shouldHydrateCardRevealScope,
  shouldUseOrderedInitialReveal,
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

function nextRevealStep(
  visible: CardVisibilityCounts,
  target: CardVisibilityCounts,
  round: NonNullable<GameState['blackjack']> | null,
  roundStatus: NonNullable<GameState['blackjack']>['status'] | undefined,
): CardVisibilityCounts | null {
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
): { displayState: GameState; isRevealing: boolean } {
  const natural = isNaturalInitialDeal(gameState.blackjackFlowSettings.initialDealMode);

  const scopeKey = cardRevealScopeKey(
    gameState.session.id,
    gameState.session.currentRound,
  );

  const initialTarget = maxVisibilityForRound(gameState.blackjack);
  const visibleRef = useRef<CardVisibilityCounts>(initialTarget);
  const scopeKeyRef = useRef<string | null>(scopeKey);
  const hasHydratedRef = useRef(true);
  const runIdRef = useRef(0);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const [displayState, setDisplayState] = useState(() =>
    natural ? applyCardVisibility(gameState, initialTarget) : gameState,
  );
  const [isRevealing, setIsRevealing] = useState(false);

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
      setDisplayState(state);
      setIsRevealing(false);
      hasHydratedRef.current = true;
    };

    if (!natural) {
      hydrateInstant(gameState);
      scopeKeyRef.current = scopeKey;
      return;
    }

    const scopeChanged = shouldHydrateCardRevealScope(
      scopeKeyRef.current,
      scopeKey,
      hasHydratedRef.current,
    );

    if (scopeChanged) {
      scopeKeyRef.current = scopeKey;
      hydrateInstant(gameState);
      return;
    }

    const target = maxVisibilityForRound(gameState.blackjack);
    const current = visibleRef.current;

    if (countsEqual(current, target)) {
      setDisplayState(gameState);
      setIsRevealing(false);
      return;
    }

    if (totalCardCount(target) < totalCardCount(current)) {
      hydrateInstant(gameState);
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

        if (totalCardCount(authoritativeTarget) < totalCardCount(visible)) {
          visible = authoritativeTarget;
          visibleRef.current = visible;
          setDisplayState(applyCardVisibility(authoritative, visible));
          break;
        }

        const delay = cardDealDelayMs(authoritative.blackjackFlowSettings);
        const round = authoritative.blackjack;
        const stepped = round
          ? nextRevealStep(visible, authoritativeTarget, round, round.status)
          : nextGameplayRevealStep(visible, authoritativeTarget);

        visible = stepped ?? authoritativeTarget;
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
  }, [gameState, natural, scopeKey]);

  return { displayState: natural ? displayState : gameState, isRevealing };
}
