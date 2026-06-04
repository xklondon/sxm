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
  cardDealDelayMs,
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
  recordWagerResultPlaceholder,
} from '../engine/session/tableGameEnd';
import { allowsBettingActions } from './blackjackViewPhase';
import { log } from '../utils/logger';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Client-side bank pacing / initial-deal loops — table driver only (not passive viewers). */
export function shouldRunClientBankAutomation(params: {
  hasOnlineDispatch: boolean;
  canDriveTableAutomation: boolean;
  bankDrawMode: 'manual' | 'auto';
  roundStatus: string | undefined;
}): boolean {
  if (params.hasOnlineDispatch) {
    return false;
  }
  if (!params.canDriveTableAutomation) {
    return false;
  }
  if (params.bankDrawMode !== 'auto') {
    return false;
  }
  return params.roundStatus === 'bank-turn' || params.roundStatus === 'banking';
}

export function useBlackjackTableFlow(
  gameState: GameState,
  onGameStateChange: (state: GameState) => void,
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>,
  onlineActionInFlight = false,
  canDriveTableAutomation = true,
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
  const bankRunIdRef = useRef(0);
  const manualBankingRef = useRef(false);
  const naturalDealingRef = useRef(false);

  const protocolPhase = getBlackjackProtocolPhase(gameState);
  const tableMessage = getProtocolTableMessage(gameState);
  const baseCenterStatus = getCenterStatusMessage(gameState, 0);
  const centerStatus = bankUiMessage ?? baseCenterStatus;
  const gameEnded = tableMeta.gameStatus === 'ended';
  const gameOverMessage = getGameOverMessage(gameState);
  const bettingOpen = !gameEnded && allowsBettingActions(gameState);
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
    if (onlineDispatch) {
      // Server-authoritative: advance the round server-side; do not mutate locally.
      void onlineDispatch('nextRound', {}).catch((err) => {
        setFlowError(err instanceof Error ? err.message : 'Cannot start next round');
      });
      return;
    }
    try {
      onGameStateChange(startNextRoundOnState(gameStateRef.current));
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : 'Cannot start next round');
    }
  }, [onGameStateChange, onlineDispatch]);

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
    // Online deals are server-driven (single dealCards action); never pace deals locally.
    if (onlineDispatch) {
      naturalDealingRef.current = false;
      return;
    }
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
        const delay = cardDealDelayMs(current.blackjackFlowSettings);
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
  }, [round?.status, flow.initialDealMode, onGameStateChange, onlineDispatch, canDriveTableAutomation]);

  /** Auto bank draw: random 2–5s between cards; pause before banking/payout. */
  useEffect(() => {
    const status = round?.status;
    if (
      !shouldRunClientBankAutomation({
        hasOnlineDispatch: Boolean(onlineDispatch),
        canDriveTableAutomation,
        bankDrawMode: flow.bankDrawMode,
        roundStatus: status,
      })
    ) {
      bankPacingRef.current = 'idle';
      if (status !== 'bank-turn' && status !== 'banking') {
        setBankUiMessage(null);
      }
      return;
    }

    if (bankPacingRef.current === 'running') {
      return;
    }

    bankPacingRef.current = 'running';
    const runId = bankRunIdRef.current + 1;
    bankRunIdRef.current = runId;

    void (async () => {
      if (gameStateRef.current.blackjack?.status === 'bank-turn') {
        setBankUiMessage('Bank thinking…');
        while (gameStateRef.current.blackjack?.status === 'bank-turn') {
          if (bankRunIdRef.current !== runId) {
            break;
          }
          const delay = randomBankDrawDelayMs(gameStateRef.current.blackjackFlowSettings);
          await sleep(delay);
          if (bankRunIdRef.current !== runId) {
            break;
          }
          const snap = gameStateRef.current;
          if (snap.blackjack?.status !== 'bank-turn') {
            break;
          }
          setBankUiMessage('Bank draws.');
          const next = drawBankCardOnState(snap);
          gameStateRef.current = next;
          onGameStateChange(next);
        }
      }

      if (bankRunIdRef.current !== runId) {
        return;
      }

      const afterDraw = gameStateRef.current;
      if (afterDraw.blackjack?.status === 'banking') {
        setBankUiMessage(getBankFinalMessage(afterDraw));
        await sleep(cardDealDelayMs(afterDraw.blackjackFlowSettings));
        if (bankRunIdRef.current !== runId) {
          return;
        }
        await sleep(Math.round(cardDealDelayMs(afterDraw.blackjackFlowSettings) * 0.5));
        if (bankRunIdRef.current !== runId) {
          return;
        }
        onGameStateChange(completeBankingOnState(gameStateRef.current));
        setBankUiMessage(null);
      }

      if (bankRunIdRef.current === runId) {
        bankPacingRef.current = 'idle';
      }
    })();

    return () => {
      bankRunIdRef.current += 1;
      bankPacingRef.current = 'idle';
      setBankUiMessage(null);
    };
  }, [round?.status, flow.bankDrawMode, onGameStateChange, onlineDispatch, canDriveTableAutomation]);

  /** Manual bank: show final bank state before payout. */
  useEffect(() => {
    // Online never settles locally; server resolves banking.
    if (onlineDispatch || !canDriveTableAutomation) {
      manualBankingRef.current = false;
      return;
    }
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
      cardDealDelayMs(current.blackjackFlowSettings) +
      Math.round(cardDealDelayMs(current.blackjackFlowSettings) * 0.5);

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
  }, [round?.status, flow.bankDrawMode, onGameStateChange, onlineDispatch]);

  /** Auto-stand when caller play-flow threshold is already met (e.g. after deal or turn advance). */
  useEffect(() => {
    // Online mode is server-authoritative: auto-stand runs on the server (deal +
    // afterPlayerAction). Never mutate state locally here or the client's
    // activeHandKey drifts ahead of the server and triggers stale-turn rejects.
    if (onlineDispatch) {
      return;
    }
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
  }, [
    round?.status,
    round?.activeHandKey,
    round?.playerHands,
    tableMeta.personPlayFlow,
    onGameStateChange,
    onlineDispatch,
    canDriveTableAutomation,
  ]);

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
