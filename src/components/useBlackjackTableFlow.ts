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
  getCardDealDelayMs,
  getBankFinalMessage,
  processPlayFlowAutoStands,
  syncBankPhaseOnState,
} from '../engine/blackjack';
import {
  canStartCards,
  getDisplayBlackjackProtocolPhase,
  getProtocolTableMessage,
  getCenterStatusMessage,
  getCardsBlockReason,
  logDealSanity,
  hasAnyStakes,
  hasEligibleDealBoxes,
  logDealCardsAudit,
} from '../engine/blackjack/protocol';
import type { CardTimerPreset } from '../engine/blackjack/flowSettings';
import { isNaturalInitialDeal, isStagedInitialDeal } from '../engine/blackjack/dealing/dealingModes';
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
  cardRevealComplete = true,
) {
  const { blackjack: round, tableMeta } = gameState;
  const flow = gameState.blackjackFlowSettings;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const [flowError, setFlowError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [nextRoundPending, setNextRoundPending] = useState(false);
  const lastFlowErrorRef = useRef<string | null>(null);
  const [bankUiMessage, setBankUiMessage] = useState<string | null>(null);
  const bankPacingRef = useRef<'idle' | 'running'>('idle');
  const bankRunIdRef = useRef(0);
  const manualBankingRef = useRef(false);

  const protocolPhase = getDisplayBlackjackProtocolPhase(gameState, cardRevealComplete);
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
    if (actionPending || onlineActionInFlight || nextRoundPending) {
      return;
    }
    setFlowError(null);
    if (onlineDispatch) {
      setNextRoundPending(true);
      void onlineDispatch('nextRound', {})
        .catch((err) => {
          setFlowError(err instanceof Error ? err.message : 'Cannot start next round');
        })
        .finally(() => setNextRoundPending(false));
      return;
    }
    try {
      onGameStateChange(startNextRoundOnState(gameStateRef.current));
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : 'Cannot start next round');
    }
  }, [
    actionPending,
    nextRoundPending,
    onlineActionInFlight,
    onGameStateChange,
    onlineDispatch,
  ]);

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
        const startDelay = getCardDealDelayMs(gameStateRef.current, 'bank-turn-start');
        if (startDelay > 0) {
          await sleep(startDelay);
          if (bankRunIdRef.current !== runId) {
            return;
          }
        }
        while (gameStateRef.current.blackjack?.status === 'bank-turn') {
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
          if (gameStateRef.current.blackjack?.status !== 'bank-turn') {
            break;
          }
          const between = getCardDealDelayMs(gameStateRef.current, 'bank-card-draw');
          if (between > 0) {
            await sleep(between);
          }
        }
      }

      if (bankRunIdRef.current !== runId) {
        return;
      }

      const afterDraw = gameStateRef.current;
      if (afterDraw.blackjack?.status === 'banking') {
        setBankUiMessage(getBankFinalMessage(afterDraw));
        await sleep(getCardDealDelayMs(afterDraw, 'bank-pause'));
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
    const pause = getCardDealDelayMs(current, 'bank-pause');

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
    nextRoundPending,
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
    initialDealStaged: isStagedInitialDeal(flow.initialDealMode),
    initialDealNatural: isNaturalInitialDeal(flow.initialDealMode),
  };
}
