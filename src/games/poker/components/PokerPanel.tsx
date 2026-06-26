import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthUser } from '../../../api/client';
import type { GameState } from '../../../types';
import { isTableOwner, updatePokerBlindsOnState } from '../../../engine/session';
import {
  endHoldemChallengeEarlyOnState,
  getAuthoritativeChallengeWinnerId,
} from '../../../engine/holdem/challengeWinner';
import { validateHoldemStartHand } from '../../../engine/holdem/holdemStartValidation';
import {
  canPersonControlHoldemSeat,
  getHoldemActingSeatId,
  processVirtualHoldemTurns,
} from '../../../engine/holdem';
import { loadProfile } from '../../../storage/profileStorage';
import type { GameOverIouFeedback } from '../../../components/GameOverActionOverlay';
import type { TableResetSetupVariant } from '../../../components/TableStakePanel';
import { PokerTableShell } from './PokerTableShell';
import {
  isPokerHandInProgress,
  mapPokerActionAvailability,
  mapPokerTableViewModel,
} from '../state/mapPokerTableViewModel';
import {
  validatePokerChallengeSettlement,
} from '../state/pokerChallengeSettlement';
import { sendPokerChallengeIous } from '../state/pokerGameOverFlow';
import {
  formatPokerHoldemActionError,
  HOLDEM_SHUFFLE_SERVER_ACTION,
  HOLDEM_UPDATE_BLINDS_SERVER_ACTION,
  HOLDEM_END_CHALLENGE_SERVER_ACTION,
  mapPokerUiActionToHoldemAction,
  mapPokerUiToServerTableAction,
  runPokerHoldemAction,
  runPokerShuffleDeck,
  type PokerGameplayAction,
} from '../state/pokerHoldemDispatch';
import { usePokerTableChat } from '../hooks/usePokerTableChat';
import { PokerGameOverOverlay } from './PokerGameOverOverlay';
import { addPokerPracticeChips } from '../state/pokerChipAdjust';
import type { PokerPlayerAction } from '../state/pokerTypes';
import { assertHoldemUsesPokerPanel, logHoldemPokerPanelMounted } from '../pokerRouteGuard';

export interface PokerPanelProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  onlineTableId?: string | null;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
  viewerAuth?: Pick<AuthUser, 'email' | 'displayName'> | null;
  onInviteTable?: () => void;
  onBeginTableReset?: (variant?: TableResetSetupVariant) => void;
  onExitTable?: () => void;
}

export function PokerPanel({
  gameState,
  onGameStateChange,
  onlineTableId = null,
  onlineDispatch,
  viewerAuth = null,
  onInviteTable,
  onBeginTableReset,
  onExitTable,
}: PokerPanelProps) {
  const profile = loadProfile();
  const [error, setError] = useState<string | null>(null);
  const [iouFeedback, setIouFeedback] = useState<GameOverIouFeedback | null>(null);
  const [iouPending, setIouPending] = useState(false);
  const [gameOverOpen, setGameOverOpen] = useState(false);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const viewerSeatId =
    gameState.selectedSeatId ??
    gameState.tableMeta.ownerPersonId ??
    gameState.session.playerIds[0] ??
    null;

  const viewModel = useMemo(
    () => mapPokerTableViewModel(gameState, viewerSeatId),
    [gameState, viewerSeatId],
  );
  const actionAvailability = useMemo(
    () => mapPokerActionAvailability(gameState),
    [gameState],
  );

  useEffect(() => {
    assertHoldemUsesPokerPanel(gameState);
    logHoldemPokerPanelMounted(gameState);
  }, [gameState]);

  const chatTableId = onlineTableId ?? gameState.session.id;
  const chatUserEmail = viewerAuth?.email ?? profile.email ?? null;
  const chatUserName = viewerAuth?.displayName ?? profile.name ?? null;
  const { messages, sending, sendMessage } = usePokerTableChat({
    tableId: chatTableId,
    currentUserEmail: chatUserEmail,
    currentUserName: chatUserName,
    preferServer: Boolean(onlineTableId),
  });

  const controllerLabel = profile.name.trim() || gameState.tableMeta.controllerName;
  const isOwner = isTableOwner(gameState, controllerLabel);
  const handInProgress = isPokerHandInProgress(gameState);
  const canEditBlinds = isOwner && !handInProgress;
  const isChallenge = gameState.tableMeta.pokerConfig?.mode === 'challenge';
  const isPractice = !isChallenge;
  const challengeEnded = gameState.tableMeta.pokerConfig?.challengeStatus === 'ended';
  const handResolved = gameState.holdem?.status === 'resolved';
  const needsShuffle = !gameState.deck;
  const canStartHand = isOwner && !handInProgress && !challengeEnded;

  const authoritativeWinnerId = getAuthoritativeChallengeWinnerId(gameState);

  const settlementResult = useMemo(() => {
    if (!authoritativeWinnerId) {
      return null;
    }
    return validatePokerChallengeSettlement(gameState, authoritativeWinnerId);
  }, [gameState, authoritativeWinnerId]);

  const settlement = useMemo(() => {
    if (settlementResult?.settlement) {
      return settlementResult.settlement;
    }
    if (!challengeEnded || !authoritativeWinnerId) {
      return null;
    }
    const config = gameState.tableMeta.pokerConfig;
    const winner = gameState.players[authoritativeWinnerId];
    return {
      winnerId: authoritativeWinnerId,
      winnerSeatId: authoritativeWinnerId,
      winnerName: winner?.displayName ?? 'Winner',
      totalChallengeValue: config?.totalChallengeValue ?? 0,
      currency: config?.currency ?? '$',
      playerCount: 0,
      participantCount: 0,
      perLoserAmount: 0,
      stakePerParticipant: 0,
      participants: [],
      losers: [],
      canSendIous: false,
      blockingReason:
        settlementResult && !settlementResult.ok
          ? settlementResult.error
          : 'Challenge settlement is not ready yet.',
    };
  }, [authoritativeWinnerId, challengeEnded, gameState, settlementResult]);

  const showGameOver = isChallenge && (challengeEnded || gameOverOpen);

  useEffect(() => {
    if (challengeEnded) {
      setGameOverOpen(true);
    }
  }, [challengeEnded]);

  const canEndChallengeEarly = isChallenge && isOwner && !challengeEnded && !handInProgress;

  const iouFailed = iouFeedback?.tone === 'error';
  const isOnlineTable = Boolean(onlineTableId && onlineDispatch);

  const actorSeatId = useMemo(() => {
    const activeId = getHoldemActingSeatId(gameState);
    const personId = gameState.tableMeta.ownerPersonId ?? viewerSeatId;
    if (activeId && personId && canPersonControlHoldemSeat(gameState, personId, activeId)) {
      return activeId;
    }
    return viewerSeatId;
  }, [gameState, viewerSeatId]);

  const canActOnTurn = useMemo(() => {
    const activeId = getHoldemActingSeatId(gameState);
    const personId = gameState.tableMeta.ownerPersonId ?? viewerSeatId;
    return Boolean(
      activeId && personId && canPersonControlHoldemSeat(gameState, personId, activeId),
    );
  }, [gameState, viewerSeatId]);

  const waitingForPlayerName = useMemo(() => {
    if (!handInProgress || canActOnTurn) {
      return null;
    }
    const activeId = viewModel.activePlayerId;
    if (!activeId) {
      return null;
    }
    return viewModel.seats.find((seat) => seat.playerId === activeId)?.displayName ?? 'player';
  }, [canActOnTurn, handInProgress, viewModel.activePlayerId, viewModel.seats]);

  useEffect(() => {
    if (isOnlineTable || !handInProgress || !isPractice) {
      return;
    }
    const activeId = getHoldemActingSeatId(gameState);
    if (!activeId || gameState.players[activeId]?.playerType !== 'virtual') {
      return;
    }
    const next = processVirtualHoldemTurns(gameState);
    if (next !== gameState) {
      onGameStateChange(next);
    }
  }, [gameState, handInProgress, isOnlineTable, isPractice, onGameStateChange]);

  const startHandBlockReason = useMemo(() => {
    if (!canStartHand) {
      return null;
    }
    return validateHoldemStartHand(gameState);
  }, [canStartHand, gameState]);

  const statusHint = useMemo(() => {
    if (handInProgress) {
      switch (viewModel.street) {
        case 'preflop':
          return 'Pre-flop betting';
        case 'flop':
          return 'Flop';
        case 'turn':
          return 'Turn';
        case 'river':
          return 'River';
        case 'showdown':
          return 'Showdown';
        default:
          return 'Hand in progress';
      }
    }
    if (handResolved && gameState.holdem?.resultSummary) {
      return gameState.holdem.resultSummary;
    }
    if (isChallenge && startHandBlockReason === 'Waiting for invited player') {
      return startHandBlockReason;
    }
    return 'Ready to deal';
  }, [
    gameState.holdem?.resultSummary,
    handInProgress,
    handResolved,
    isChallenge,
    startHandBlockReason,
    viewModel.street,
  ]);

  const dispatchHoldemAction = useCallback(
    (holdemAction: ReturnType<typeof mapPokerUiActionToHoldemAction>) => {
      const current = gameStateRef.current;
      const result = runPokerHoldemAction(current, holdemAction);
      if (!result.ok) {
        setError(formatPokerHoldemActionError(result.error, holdemAction.type));
        return;
      }
      setError(null);
      onGameStateChange(result.state);
    },
    [onGameStateChange],
  );

  const dispatchOnlineGameplay = useCallback(
    async (uiAction: PokerGameplayAction, amount?: number) => {
      if (!onlineDispatch) {
        return;
      }
      try {
        const { type, payload } = mapPokerUiToServerTableAction(uiAction, amount);
        await onlineDispatch(type, payload);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed';
        setError(formatPokerHoldemActionError(message, uiAction === 'all-in' ? 'all-in' : undefined));
      }
    },
    [onlineDispatch],
  );

  const dispatchUiAction = useCallback(
    async (uiAction: PokerGameplayAction, amount?: number) => {
      if (isOnlineTable) {
        await dispatchOnlineGameplay(uiAction, amount);
        return;
      }
      dispatchHoldemAction(mapPokerUiActionToHoldemAction(uiAction, actorSeatId, amount));
    },
    [dispatchHoldemAction, dispatchOnlineGameplay, isOnlineTable, actorSeatId],
  );

  const dispatchShuffle = useCallback(async () => {
    if (isOnlineTable && onlineDispatch) {
      try {
        await onlineDispatch(HOLDEM_SHUFFLE_SERVER_ACTION, {});
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Shuffle failed';
        setError(formatPokerHoldemActionError(message));
      }
      return;
    }
    const shuffleResult = runPokerShuffleDeck(gameStateRef.current);
    if (!shuffleResult.ok) {
      setError(formatPokerHoldemActionError(shuffleResult.error));
      return;
    }
    setError(null);
    onGameStateChange(shuffleResult.state);
  }, [isOnlineTable, onlineDispatch, onGameStateChange]);

  function runSetup(action: () => GameState) {
    setError(null);
    try {
      onGameStateChange(action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  const handleAction = useCallback(
    (action: PokerPlayerAction, amount?: number) => {
      void dispatchUiAction(action, amount);
    },
    [dispatchUiAction],
  );

  function handleSaveBlinds(smallBlind: number, bigBlind: number) {
    if (isOnlineTable && onlineDispatch) {
      setError(null);
      void onlineDispatch(HOLDEM_UPDATE_BLINDS_SERVER_ACTION, { smallBlind, bigBlind })
        .then(() => setError(null))
        .catch((err) => {
          const message = err instanceof Error ? err.message : 'Failed to save blinds';
          setError(formatPokerHoldemActionError(message));
        });
      return;
    }
    runSetup(() => updatePokerBlindsOnState(gameStateRef.current, smallBlind, bigBlind));
  }

  function handleStartHand() {
    void (async () => {
      let current = gameStateRef.current;
      if (!current.deck) {
        if (isOnlineTable && onlineDispatch) {
          try {
            await onlineDispatch(HOLDEM_SHUFFLE_SERVER_ACTION, {});
            setError(null);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Shuffle failed';
            setError(formatPokerHoldemActionError(message));
            return;
          }
        } else {
          const shuffleResult = runPokerShuffleDeck(current);
          if (!shuffleResult.ok) {
            setError(formatPokerHoldemActionError(shuffleResult.error));
            return;
          }
          current = shuffleResult.state;
          gameStateRef.current = current;
          onGameStateChange(shuffleResult.state);
          setError(null);
        }
      }
      await dispatchUiAction('start-hand');
    })();
  }

  function handleAddChips(playerId: string, amount: number) {
    if (!isPractice) {
      return;
    }
    runSetup(() => addPokerPracticeChips(gameStateRef.current, playerId, amount));
  }

  async function handleEndChallenge() {
    if (handInProgress) {
      return;
    }
    if (isOnlineTable && onlineDispatch) {
      try {
        await onlineDispatch(HOLDEM_END_CHALLENGE_SERVER_ACTION, {});
        setError(null);
        setGameOverOpen(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to end challenge';
        setError(message);
      }
      return;
    }
    try {
      const next = endHoldemChallengeEarlyOnState(gameStateRef.current);
      onGameStateChange(next);
      setGameOverOpen(true);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end challenge';
      setError(message);
    }
  }

  async function handleSendIous() {
    const winnerId = getAuthoritativeChallengeWinnerId(gameStateRef.current);
    if (!winnerId || isPractice) {
      setIouFeedback({
        tone: 'error',
        message: 'No authoritative challenge winner — cannot send IOUs.',
      });
      return;
    }
    setIouPending(true);
    try {
      const ok = await sendPokerChallengeIous(gameStateRef.current, winnerId, setIouFeedback);
      if (ok) {
        onGameStateChange({
          ...gameStateRef.current,
          tableMeta: {
            ...gameStateRef.current.tableMeta,
            pokerConfig: gameStateRef.current.tableMeta.pokerConfig
              ? {
                  ...gameStateRef.current.tableMeta.pokerConfig,
                  iouSubmittedAt: new Date().toISOString(),
                }
              : undefined,
          },
        });
      }
    } finally {
      setIouPending(false);
    }
  }

  return (
    <div className="poker-panel poker-panel--compact" data-game="poker">
      <PokerTableShell
        gameState={gameState}
        viewModel={viewModel}
        actionAvailability={actionAvailability}
        chatMessages={messages}
        chatSending={sending}
        disabled={false}
        statusHint={statusHint}
        startHandBlockReason={startHandBlockReason}
        handActive={handInProgress}
        handResolved={handResolved}
        challengeEnded={challengeEnded}
        needsShuffle={needsShuffle}
        canStartHand={canStartHand}
        canEditBlinds={canEditBlinds}
        canAddChips={isPractice && isOwner && !handInProgress}
        canResetTable={isOwner && Boolean(onBeginTableReset)}
        isPractice={isPractice}
        isChallenge={isChallenge}
        showInvite={Boolean(onInviteTable)}
        showEndChallenge={canEndChallengeEarly}
        waitingForPlayerName={waitingForPlayerName}
        canActOnTurn={canActOnTurn}
        onAction={handInProgress && canActOnTurn ? handleAction : undefined}
        onSendChat={(body) => void sendMessage(body)}
        onSaveBlinds={handleSaveBlinds}
        onInviteTable={onInviteTable}
        onLeaveTable={onExitTable}
        onEndChallenge={() => void handleEndChallenge()}
        onStartHand={handleStartHand}
        onShuffleDeck={() => void dispatchShuffle()}
        onBeginTableReset={onBeginTableReset}
        onAddChips={handleAddChips}
        tableId={chatTableId}
      />

      {error && (
        <p className="poker-panel__error" role="alert">
          {error}
        </p>
      )}

      <PokerGameOverOverlay
        open={showGameOver && Boolean(settlement)}
        settlement={settlement}
        isChallenge={isChallenge}
        iouFeedback={iouFeedback}
        iouPending={iouPending}
        onSendIous={settlement?.canSendIous ? handleSendIous : undefined}
        canStartNewGame={!iouFailed}
        newGameDisabledReason={
          iouFailed ? 'Resolve IOU errors before starting a new game.' : undefined
        }
        onNewHand={() => {
          if (iouFailed) {
            return;
          }
          setGameOverOpen(false);
          onBeginTableReset?.('newGame');
        }}
        onExitTable={() => onExitTable?.()}
        onDismiss={() => setGameOverOpen(false)}
      />
    </div>
  );
}
