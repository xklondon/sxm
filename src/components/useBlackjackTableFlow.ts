import { useEffect, useRef, useCallback, useState } from 'react';
import type { GameState } from '../types';
import {
  dealCardsButtonOnState,
  dealNextInitialCardOnState,
  drawBankCardOnState,
  completeBankingOnState,
  startNextRoundOnState,
  shuffleToStartOnState,
  shuffleFreshShoeOnState,
  updateBlackjackFlowSettings,
  randomBankDrawDelayMs,
  getBankFinalMessage,
  processPlayFlowAutoStands,
  syncBankPhaseOnState,
} from '../engine/blackjack';
import {
  canStartCards,
  getBlackjackProtocolPhase,
  getProtocolTableMessage,
  getCenterStatusMessage,
  getCardsBlockReason,
  logDealSanity,
  hasAnyStakes,
  hasEligibleDealBoxes,
  logDealCardsAudit,
} from '../engine/blackjack/protocol';
import type { CardTimerPreset } from '../engine/blackjack/flowSettings';
import { isNaturalInitialDeal, isStepwiseInitialDeal } from '../engine/blackjack/dealing/dealingModes';
import {
  getGameOverMessage,
  isTableGameActive,
  recordWagerResultPlaceholder,
} from '../engine/session/tableGameEnd';
import { log } from '../utils/logger';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useBlackjackTableFlow(
  gameState: GameState,
  onGameStateChange: (state: GameState) => void,
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>,
  onlineActionInFlight = false,
) {
  const { blackjack: round, tableMeta } = gameState;
  const flow = gameState.blackjackFlowSettings;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const [flowError, setFlowError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const lastFlowErrorRef = useRef<string | null>(null);
  const [bankUiMessage, setBankUiMessage] = useState<string | null>(null);
  const bankPacingRef = useRef<'idle' | 'running'>('idle');
  const manualBankingRef = useRef(false);
  const naturalDealingRef = useRef(false);

  const protocolPhase = getBlackjackProtocolPhase(gameState);
  const tableMessage = getProtocolTableMessage(gameState);
  const baseCenterStatus = getCenterStatusMessage(gameState, 0);
  const centerStatus = bankUiMessage ?? baseCenterStatus;
  const gameEnded = tableMeta.gameStatus === 'ended';
  const gameOverMessage = getGameOverMessage(gameState);
  const bettingOpen =
    !gameEnded &&
    isTableGameActive(gameState) &&
    protocolPhase === 'betting' &&
    !tableMeta.bettingLocked;
  const awaitingNextRound = tableMeta.awaitingNextRound;
  const canDeal =
    protocolPhase === 'betting' &&
    !tableMeta.bettingLocked &&
    Boolean(tableMeta.shoeStarted) &&
    canStartCards(gameState) &&
    !actionPending &&
    !onlineActionInFlight;

  const reportFlowError = useCallback((msg: string) => {
    if (lastFlowErrorRef.current === msg) {
      return;
    }
    lastFlowErrorRef.current = msg;
    setFlowError(msg);
  }, []);

  const clearFlowError = useCallback(() => {
    lastFlowErrorRef.current = null;
    setFlowError(null);
  }, []);

  const handleDealCards = useCallback(() => {
    if (actionPending || onlineActionInFlight) {
      return;
    }
    clearFlowError();
    const state = gameStateRef.current;
    logDealCardsAudit(state);

    if (!canStartCards(state)) {
      const reason = getCardsBlockReason(state) ?? 'Cannot deal';
      logDealCardsAudit(state, { blockReason: reason });
      log.info('Deal Cards blocked', { reason });
      logDealSanity(state, { dealResult: `blocked: ${reason}` });
      reportFlowError(reason);
      return;
    }

    try {
      if (onlineDispatch) {
        setActionPending(true);
        void onlineDispatch('dealCards', {})
          .then(() => {
            clearFlowError();
            logDealSanity(gameStateRef.current, { dealResult: 'ok' });
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : 'Cannot deal';
            logDealCardsAudit(state, { blockReason: msg });
            log.info('Deal Cards blocked', { reason: msg });
            logDealSanity(state, { dealResult: `error: ${msg}` });
            reportFlowError(msg);
          })
          .finally(() => setActionPending(false));
        return;
      }
      const next = dealCardsButtonOnState(state);
      logDealCardsAudit(next, { blockReason: null });
      logDealSanity(state, { dealResult: 'ok' });
      onGameStateChange(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cannot deal';
      logDealCardsAudit(state, { blockReason: msg });
      log.info('Deal Cards blocked', { reason: msg });
      logDealSanity(state, { dealResult: `error: ${msg}` });
      reportFlowError(msg);
    }
  }, [
    actionPending,
    onlineActionInFlight,
    clearFlowError,
    onGameStateChange,
    onlineDispatch,
    reportFlowError,
  ]);

  const handleRecordWagerResult = useCallback(() => {
    setFlowError(null);
    try {
      onGameStateChange(recordWagerResultPlaceholder(gameStateRef.current));
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : 'Could not record wager result');
    }
  }, [onGameStateChange]);

  const handleNextRound = useCallback(() => {
    setFlowError(null);
    try {
      onGameStateChange(startNextRoundOnState(gameStateRef.current));
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : 'Cannot start next round');
    }
  }, [onGameStateChange]);

  const handleShuffleToStart = useCallback(() => {
    if (actionPending || onlineActionInFlight) {
      return;
    }
    clearFlowError();
    try {
      if (onlineDispatch) {
        setActionPending(true);
        void onlineDispatch('shuffleToStart', {})
          .catch((err) => {
            const msg = err instanceof Error ? err.message : 'Cannot shuffle';
            reportFlowError(msg);
          })
          .finally(() => setActionPending(false));
        return;
      }
      onGameStateChange(shuffleToStartOnState(gameStateRef.current));
    } catch (err) {
      reportFlowError(err instanceof Error ? err.message : 'Cannot shuffle');
    }
  }, [actionPending, onlineActionInFlight, clearFlowError, onGameStateChange, onlineDispatch, reportFlowError]);

  const handleShuffleFresh = useCallback(() => {
    setFlowError(null);
    try {
      onGameStateChange(shuffleFreshShoeOnState(gameStateRef.current));
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : 'Cannot shuffle');
    }
  }, [onGameStateChange]);

  const handleDealNextCard = useCallback(() => {
    setFlowError(null);
    try {
      onGameStateChange(dealNextInitialCardOnState(gameStateRef.current));
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : 'Cannot deal card');
    }
  }, [onGameStateChange]);

  const handleDrawBank = useCallback(() => {
    setFlowError(null);
    try {
      onGameStateChange(drawBankCardOnState(gameStateRef.current));
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : 'Bank draw failed');
    }
  }, [onGameStateChange]);

  const handleSetTimerPreset = useCallback(
    (preset: CardTimerPreset) => {
      onGameStateChange(
        updateBlackjackFlowSettings(gameStateRef.current, {
          cardTimerPreset: preset,
          countdownSeconds: preset,
        }),
      );
    },
    [onGameStateChange],
  );

  /** Natural dealing — auto-advance one card at a time with configurable delay. */
  useEffect(() => {
    if (!isNaturalInitialDeal(flow.initialDealMode)) {
      naturalDealingRef.current = false;
      return;
    }
    if (round?.status !== 'initial-deal') {
      naturalDealingRef.current = false;
      return;
    }
    if (naturalDealingRef.current) {
      return;
    }
    naturalDealingRef.current = true;

    void (async () => {
      let current = gameStateRef.current;
      while (current.blackjack?.status === 'initial-deal') {
        const delay = current.blackjackFlowSettings.naturalDealDelayMs ?? 750;
        await sleep(delay);
        current = gameStateRef.current;
        if (current.blackjack?.status !== 'initial-deal') {
          break;
        }
        try {
          current = dealNextInitialCardOnState(current);
          onGameStateChange(current);
        } catch (err) {
          setFlowError(err instanceof Error ? err.message : 'Natural deal failed');
          break;
        }
      }
      naturalDealingRef.current = false;
    })();
  }, [round?.status, flow.initialDealMode, onGameStateChange]);

  /** Auto bank draw: random 2–5s between cards; pause before banking/payout. */
  useEffect(() => {
    const status = round?.status;
    if (flow.bankDrawMode !== 'auto') {
      if (status !== 'bank-turn' && status !== 'banking') {
        setBankUiMessage(null);
      }
      return;
    }

    if (status !== 'bank-turn' && status !== 'banking') {
      bankPacingRef.current = 'idle';
      setBankUiMessage(null);
      return;
    }

    if (bankPacingRef.current === 'running') {
      return;
    }

    bankPacingRef.current = 'running';

    void (async () => {
      let current = gameStateRef.current;

      if (current.blackjack?.status === 'bank-turn') {
        setBankUiMessage('Bank thinking…');
        while (current.blackjack?.status === 'bank-turn') {
          await sleep(randomBankDrawDelayMs(current.blackjackFlowSettings));
          if (current.blackjack?.status !== 'bank-turn') {
            break;
          }
          setBankUiMessage('Bank draws.');
          current = drawBankCardOnState(current);
          gameStateRef.current = current;
          onGameStateChange(current);
        }
      }

      current = gameStateRef.current;
      if (current.blackjack?.status === 'banking') {
        setBankUiMessage(getBankFinalMessage(current));
        await sleep(current.blackjackFlowSettings.bankStandPauseMs);
        await sleep(current.blackjackFlowSettings.bankingDisplayMs);
        onGameStateChange(completeBankingOnState(gameStateRef.current));
        setBankUiMessage(null);
      }

      bankPacingRef.current = 'idle';
    })();
  }, [round?.status, flow.bankDrawMode, onGameStateChange]);

  /** Manual bank: show final bank state before payout. */
  useEffect(() => {
    if (flow.bankDrawMode === 'auto') {
      manualBankingRef.current = false;
      return;
    }
    if (round?.status !== 'banking') {
      manualBankingRef.current = false;
      return;
    }
    if (manualBankingRef.current) {
      return;
    }
    manualBankingRef.current = true;

    const current = gameStateRef.current;
    setBankUiMessage(getBankFinalMessage(current));
    const pause =
      current.blackjackFlowSettings.bankStandPauseMs +
      current.blackjackFlowSettings.bankingDisplayMs;

    const timer = window.setTimeout(() => {
      try {
        onGameStateChange(completeBankingOnState(gameStateRef.current));
      } catch (err) {
        setFlowError(err instanceof Error ? err.message : 'Banking failed');
      } finally {
        manualBankingRef.current = false;
        setBankUiMessage(null);
      }
    }, pause);

    return () => window.clearTimeout(timer);
  }, [round?.status, flow.bankDrawMode, onGameStateChange]);

  /** Auto-stand when caller play-flow threshold is already met (e.g. after deal or turn advance). */
  useEffect(() => {
    if (round?.status !== 'player-turns' || !round.activeHandKey) {
      return;
    }
    const beforeKey = round.activeHandKey;
    const beforeStatus = round.playerHands[beforeKey]?.actionStatus;
    let next = processPlayFlowAutoStands(gameStateRef.current);
    next = syncBankPhaseOnState(next);
    const afterRound = next.blackjack;
    if (!afterRound) {
      return;
    }
    const afterKey = afterRound.activeHandKey;
    const afterStatus = afterKey ? afterRound.playerHands[afterKey]?.actionStatus : undefined;
    if (afterKey !== beforeKey || afterStatus !== beforeStatus) {
      onGameStateChange(next);
    }
  }, [round?.status, round?.activeHandKey, round?.playerHands, tableMeta.personPlayFlow, onGameStateChange]);

  return {
    tableMessage,
    centerStatus,
    flowError,
    setFlowError,
    bettingOpen,
    canDeal,
    dealActionPending: actionPending || onlineActionInFlight,
    protocolPhase,
    awaitingNextRound,
    gameEnded,
    gameOverMessage,
    handleRecordWagerResult,
    hasStakes: hasAnyStakes(gameState),
    hasEligibleStakes: hasEligibleDealBoxes(gameState),
    handleDealCards,
    handleNextRound,
    handleShuffleToStart,
    handleShuffleFresh,
    handleDealNextCard,
    handleDrawBank,
    handleSetTimerPreset,
    engineStatus: round?.status,
    initialDealStaged: isStepwiseInitialDeal(flow.initialDealMode),
    initialDealNatural: isNaturalInitialDeal(flow.initialDealMode),
  };
}
