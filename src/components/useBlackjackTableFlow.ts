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
  getBankFinalMessage,
  processPlayFlowAutoStands,
  syncBankPhaseOnState,
} from '../engine/blackjack';
import { sleepMs } from '../engine/blackjack/dealPacing';
import {
  getDisplayBlackjackProtocolPhase,
  getProtocolTableMessage,
  getCenterStatusMessage,
  logDealSanity,
  hasAnyStakes,
  hasEligibleDealBoxes,
  logDealCardsAudit,
} from '../engine/blackjack/protocol';
import {
  canDealBlackjack,
  logDealAudit,
} from '../engine/session/canDealBlackjack';
import { isNaturalInitialDeal, isStagedInitialDeal } from '../engine/blackjack/dealing/dealingModes';
import {
  getGameOverMessage,
  recordWagerResultPlaceholder,
} from '../engine/session/tableGameEnd';
import { allowsBettingActions } from './blackjackViewPhase';
import { log } from '../utils/logger';

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
  suppressEngineAutoAdvance = false,
  displayState?: GameState,
  viewerPersonId: string | null = null,
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
  const bankDrawInFlightRef = useRef(false);

  const protocolPhase = getDisplayBlackjackProtocolPhase(
    gameState,
    cardRevealComplete,
    displayState,
  );
  const tableMessage = getProtocolTableMessage(gameState);
  const baseCenterStatus = getCenterStatusMessage(gameState, 0);
  const centerStatus = bankUiMessage ?? baseCenterStatus;
  const gameEnded = tableMeta.gameStatus === 'ended';
  const gameOverMessage = getGameOverMessage(gameState);
  const bettingOpen = !gameEnded && allowsBettingActions(gameState);
  const awaitingNextRound = tableMeta.awaitingNextRound;
  const dealGate = canDealBlackjack(gameState, viewerPersonId);
  const canDeal =
    protocolPhase === 'betting' &&
    Boolean(tableMeta.shoeStarted) &&
    bettingOpen &&
    dealGate.allowed &&
    !actionPending;
  const dealBlockReason = dealGate.allowed ? null : dealGate.message;

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
      const reason = onlineActionInFlight
        ? 'Previous table action still in progress — wait and try Deal Cards again.'
        : 'Deal already in progress.';
      logDealAudit(gameStateRef.current, viewerPersonId, {
        source: 'handleDealCards-busy',
      });
      reportFlowError(reason);
      return;
    }
    clearFlowError();
    const state = gameStateRef.current;
    logDealCardsAudit(state);
    const authority = logDealAudit(state, viewerPersonId, { source: 'handleDealCards' });

    if (!authority.allowed) {
      const reason = authority.message ?? 'Cannot deal';
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
          .then((result) => {
            if (result === null) {
              throw new Error('Previous table action still in progress — wait and try Deal Cards again.');
            }
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
    clearFlowError,
    onGameStateChange,
    onlineActionInFlight,
    onlineDispatch,
    reportFlowError,
    viewerPersonId,
  ]);

  const handlePrimaryDealAction = useCallback(
    (options: {
      firstStartShuffleDelayMs?: number;
      onFirstStartShuffleAnimationStart?: () => void;
      onFirstStartShuffleAnimationEnd?: () => void;
    } = {}) => {
      if (actionPending || onlineActionInFlight) {
        reportFlowError(
          onlineActionInFlight
            ? 'Previous table action still in progress — wait and try Deal Cards again.'
            : 'Deal already in progress.',
        );
        return;
      }
      clearFlowError();
      const state = gameStateRef.current;
      const isFirstStart = !state.tableMeta.shoeStarted;

      if (!isFirstStart) {
        handleDealCards();
        return;
      }

      const authority = logDealAudit(state, viewerPersonId, {
        source: 'handlePrimaryDealAction-firstStart',
        allowPreShuffle: true,
      });
      if (!authority.allowed) {
        reportFlowError(authority.message ?? 'Cannot deal');
        return;
      }

      const delay = options.firstStartShuffleDelayMs ?? 0;
      options.onFirstStartShuffleAnimationStart?.();
      setActionPending(true);

      void (async () => {
        try {
          if (delay > 0) {
            await sleepMs(delay);
          }
          options.onFirstStartShuffleAnimationEnd?.();

          if (onlineDispatch) {
            await onlineDispatch('shuffleToStart', {});
            await onlineDispatch('dealCards', {});
            clearFlowError();
            logDealSanity(gameStateRef.current, { dealResult: 'ok' });
            return;
          }

          let next = shuffleToStartOnState(gameStateRef.current);
          logDealCardsAudit(next);
          next = dealCardsButtonOnState(next);
          logDealCardsAudit(next, { blockReason: null });
          logDealSanity(state, { dealResult: 'ok' });
          onGameStateChange(next);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Cannot deal';
          logDealCardsAudit(state, { blockReason: msg });
          log.info('Deal Cards blocked', { reason: msg });
          logDealSanity(state, { dealResult: `error: ${msg}` });
          reportFlowError(msg);
        } finally {
          setActionPending(false);
        }
      })();
    },
    [
      actionPending,
      clearFlowError,
      handleDealCards,
      onGameStateChange,
      onlineDispatch,
      reportFlowError,
      viewerPersonId,
    ],
  );

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
    if (actionPending) {
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
  }, [actionPending, clearFlowError, onGameStateChange, onlineDispatch, reportFlowError]);

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

  /** Auto bank draw: engine decides WHAT; reveal queue decides WHEN. One card per reveal cycle. */
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
      bankDrawInFlightRef.current = false;
      if (status !== 'bank-turn' && status !== 'banking') {
        setBankUiMessage(null);
      }
      return;
    }

    if (!cardRevealComplete || bankDrawInFlightRef.current) {
      if (status === 'bank-turn' && !cardRevealComplete) {
        setBankUiMessage('Bank thinking…');
      }
      return;
    }

    if (status === 'bank-turn') {
      bankDrawInFlightRef.current = true;
      setBankUiMessage('Bank draws.');
      try {
        onGameStateChange(drawBankCardOnState(gameStateRef.current));
      } catch (err) {
        setFlowError(err instanceof Error ? err.message : 'Bank draw failed');
      } finally {
        bankDrawInFlightRef.current = false;
      }
      return;
    }

    if (status === 'banking') {
      setBankUiMessage(getBankFinalMessage(gameStateRef.current));
      try {
        onGameStateChange(completeBankingOnState(gameStateRef.current));
      } catch (err) {
        setFlowError(err instanceof Error ? err.message : 'Banking failed');
      } finally {
        setBankUiMessage(null);
      }
    }
  }, [
    round?.status,
    flow.bankDrawMode,
    onGameStateChange,
    onlineDispatch,
    canDriveTableAutomation,
    cardRevealComplete,
  ]);

  /** Manual bank: complete banking once all bank cards are revealed. */
  useEffect(() => {
    if (onlineDispatch || !canDriveTableAutomation) {
      return;
    }
    if (flow.bankDrawMode === 'auto') {
      return;
    }
    if (round?.status !== 'banking' || !cardRevealComplete) {
      return;
    }
    setBankUiMessage(getBankFinalMessage(gameStateRef.current));
    try {
      onGameStateChange(completeBankingOnState(gameStateRef.current));
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : 'Banking failed');
    } finally {
      setBankUiMessage(null);
    }
  }, [round?.status, flow.bankDrawMode, onGameStateChange, onlineDispatch, canDriveTableAutomation, cardRevealComplete]);

  /** Auto-stand when caller play-flow threshold is already met (e.g. after deal or turn advance). */
  useEffect(() => {
    // Online mode is server-authoritative: auto-stand runs on the server (deal +
    // afterPlayerAction). Never mutate state locally here or the client's
    // activeHandKey drifts ahead of the server and triggers stale-turn rejects.
    if (onlineDispatch || suppressEngineAutoAdvance) {
      return;
    }
    if (!cardRevealComplete) {
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
    suppressEngineAutoAdvance,
    cardRevealComplete,
  ]);

  return {
    tableMessage,
    centerStatus,
    flowError,
    setFlowError,
    bettingOpen,
    canDeal,
    dealBlockReason,
    dealActionPending: actionPending,
    nextRoundPending,
    protocolPhase,
    awaitingNextRound,
    gameEnded,
    gameOverMessage,
    handleRecordWagerResult,
    hasStakes: hasAnyStakes(gameState),
    hasEligibleStakes: hasEligibleDealBoxes(gameState),
    handleDealCards,
    handlePrimaryDealAction,
    handleNextRound,
    handleShuffleToStart,
    handleShuffleFresh,
    handleDealNextCard,
    handleDrawBank,
    engineStatus: round?.status,
    initialDealStaged: isStagedInitialDeal(flow.initialDealMode),
    initialDealNatural: isNaturalInitialDeal(flow.initialDealMode),
  };
}
