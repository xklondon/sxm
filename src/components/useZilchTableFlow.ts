import { useCallback, useEffect, useRef } from 'react';
import type { GameState } from '../types';
import {
  applyZilchActionToState,
  type ZilchGameplayAction,
  canBank,
  canRollDice,
  completeDiceRoll,
} from '../engine/zilch';
import { beginZilchPlay } from '../engine/session';

interface UseZilchTableFlowOptions {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
}

export function useZilchTableFlow({
  gameState,
  onGameStateChange,
  onlineDispatch,
}: UseZilchTableFlowOptions) {
  const rollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dispatch = useCallback(
    async (type: string, payload?: Record<string, unknown>) => {
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
      if (onlineDispatch) {
        void onlineDispatch('zilchCompleteRoll', {});
      } else {
        onGameStateChange({
          ...gameState,
          zilch: completeDiceRoll(gameState.zilch!),
        });
      }
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

  const handleStartGame = useCallback(() => {
    try {
      onGameStateChange(beginZilchPlay(gameState));
    } catch (err) {
      console.error(err);
    }
  }, [gameState, onGameStateChange]);

  /** Authoritative starter selection — completes in one reducer step. Returns starter id when applied locally. */
  const handleRandomiseStarter = useCallback((): string | null => {
    if (onlineDispatch) {
      void dispatch('zilchRandomiseStarter', {});
      return null;
    }
    if (!gameState.zilch) {
      return null;
    }
    const next = applyZilchActionToState(gameState, 'zilchRandomiseStarter', {});
    onGameStateChange(next);
    return next.zilch?.starterPlayerId ?? null;
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

  const handleBank = useCallback(() => {
    if (!gameState.zilch || !canBank(gameState.zilch)) {
      return;
    }
    void dispatch('zilchBankTurn', {});
  }, [dispatch, gameState.zilch]);

  const handleQuitTurn = useCallback(() => {
    handleBank();
  }, [handleBank]);

  return {
    handleStartGame,
    handleRandomiseStarter,
    handleRollDice,
    handleKeepCombination,
    handleBank,
    handleQuitTurn,
  };
}
