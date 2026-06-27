import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../types';
import {
  applyZilchActionToState,
  ensureZilchGameOnState,
  type ZilchGameplayAction,
  canBank,
  canRollDice,
  completeDiceRoll,
} from '../engine/zilch';

interface UseZilchTableFlowOptions {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
  /** When true, this client may dispatch zilch-reveal auto-advance (controller/host). */
  canRunZilchRevealTimer?: boolean;
}

export function useZilchTableFlow({
  gameState,
  onGameStateChange,
  onlineDispatch,
  canRunZilchRevealTimer = true,
}: UseZilchTableFlowOptions) {
  const rollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zilchRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zilchRevealDispatchKeyRef = useRef<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [zilchRevealCountdown, setZilchRevealCountdown] = useState(0);

  const dispatch = useCallback(
    async (type: string, payload?: Record<string, unknown>) => {
      try {
        setActionError(null);
        if (onlineDispatch) {
          await onlineDispatch(type, payload);
          return;
        }
        if (!gameState.zilch) {
          return;
        }
        onGameStateChange(
          applyZilchActionToState(gameState, type as ZilchGameplayAction, payload),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed';
        setActionError(message);
      }
    },
    [gameState, onGameStateChange, onlineDispatch],
  );

  useEffect(() => {
    const zilch = gameState.zilch;
    if (!zilch?.diceAnimation.isRolling) {
      return;
    }
    const duration = zilch.diceAnimation.durationMs ?? 2500;
    if (rollTimerRef.current) {
      clearTimeout(rollTimerRef.current);
    }
    rollTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          setActionError(null);
          if (onlineDispatch) {
            await onlineDispatch('zilchCompleteRoll', {});
          } else {
            onGameStateChange({
              ...gameState,
              zilch: completeDiceRoll(gameState.zilch!),
            });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Action failed';
          setActionError(message);
        }
      })();
    }, duration);
    return () => {
      if (rollTimerRef.current) {
        clearTimeout(rollTimerRef.current);
      }
    };
  }, [
    gameState,
    gameState.zilch?.diceAnimation.isRolling,
    gameState.zilch?.diceAnimation.startedAt,
    onGameStateChange,
    onlineDispatch,
  ]);

  useEffect(() => {
    const zilch = gameState.zilch;
    if (zilch?.phase !== 'zilch-reveal') {
      setZilchRevealCountdown(0);
      return;
    }
    const until = zilch.zilchRevealUntil ?? Date.now();
    const tick = () => {
      setZilchRevealCountdown(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [gameState.zilch?.phase, gameState.zilch?.zilchRevealUntil]);

  useEffect(() => {
    const zilch = gameState.zilch;
    if (zilchRevealTimerRef.current) {
      clearTimeout(zilchRevealTimerRef.current);
      zilchRevealTimerRef.current = null;
    }
    if (zilch?.phase !== 'zilch-reveal' || !canRunZilchRevealTimer) {
      if (zilch?.phase !== 'zilch-reveal') {
        zilchRevealDispatchKeyRef.current = null;
      }
      return;
    }

    const dispatchKey = `${zilch.gameId}:${zilch.zilchRevealUntil}:${zilch.currentPlayerId}`;
    if (zilchRevealDispatchKeyRef.current === dispatchKey) {
      return;
    }

    const until = zilch.zilchRevealUntil ?? Date.now() + 3000;
    const delay = Math.max(0, until - Date.now());
    zilchRevealTimerRef.current = setTimeout(() => {
      zilchRevealDispatchKeyRef.current = dispatchKey;
      void dispatch('zilchAdvanceAfterReveal', {});
    }, delay);

    return () => {
      if (zilchRevealTimerRef.current) {
        clearTimeout(zilchRevealTimerRef.current);
        zilchRevealTimerRef.current = null;
      }
    };
  }, [
    canRunZilchRevealTimer,
    dispatch,
    gameState.zilch?.phase,
    gameState.zilch?.zilchRevealUntil,
    gameState.zilch?.currentPlayerId,
    gameState.zilch?.gameId,
  ]);

  const handleStartGame = useCallback(() => {
    try {
      setActionError(null);
      onGameStateChange(ensureZilchGameOnState(gameState));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start game';
      setActionError(message);
    }
  }, [gameState, onGameStateChange]);

  /** Authoritative starter selection — completes in one reducer step. Returns starter id when applied locally. */
  const handleRandomiseStarter = useCallback((): string | null => {
    try {
      setActionError(null);
      const ready = ensureZilchGameOnState(gameState);
      if (onlineDispatch) {
        void dispatch('zilchRandomiseStarter', {});
        return null;
      }
      const next = applyZilchActionToState(ready, 'zilchRandomiseStarter', {});
      onGameStateChange(next);
      return next.zilch?.starterPlayerId ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Randomiser failed';
      setActionError(message);
      return null;
    }
  }, [dispatch, gameState, onGameStateChange, onlineDispatch]);

  const handleRollDice = useCallback(() => {
    if (!gameState.zilch || !canRollDice(gameState.zilch)) {
      return;
    }
    void dispatch('zilchRollDice', {});
  }, [dispatch, gameState.zilch]);

  const handleKeepCombination = useCallback(
    (combinationId: string) => {
      void dispatch('zilchKeepCombination', { combinationId });
    },
    [dispatch],
  );

  const handleKeepSelected = useCallback(
    (diceIds: string[]) => {
      void dispatch('zilchKeepCombination', { diceIds });
    },
    [dispatch],
  );

  /** @deprecated Use handleKeepSelected */
  const handleKeepAndRoll = handleKeepSelected;

  const handleBank = useCallback(() => {
    if (!gameState.zilch || !canBank(gameState.zilch)) {
      return;
    }
    void dispatch('zilchBankTurn', {});
  }, [dispatch, gameState.zilch]);

  const handleQuitTurn = useCallback(() => {
    handleBank();
  }, [handleBank]);

  const clearActionError = useCallback(() => {
    setActionError(null);
  }, []);

  return {
    handleStartGame,
    handleRandomiseStarter,
    handleRollDice,
    handleKeepCombination,
    handleKeepSelected,
    handleKeepAndRoll,
    handleBank,
    handleQuitTurn,
    actionError,
    clearActionError,
    zilchRevealCountdown,
  };
}
