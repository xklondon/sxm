import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthUser } from '../../../api/client';
import type { GameState } from '../../../types';
import { isTableOwner, updatePokerBlindsOnState } from '../../../engine/session';
import {
  endHoldemChallengeEarlyOnState,
  getAuthoritativeChallengeWinnerId,
} from '../../../engine/holdem/challengeWinner';
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
import type { PokerPlayerAction } from '../state/pokerTypes';

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

  const chatTableId = onlineTableId ?? gameState.session.id;
  const chatUserEmail = viewerAuth?.email ?? profile.email ?? null;
  const chatUserName = viewerAuth?.displayName ?? profile.name ?? null;
  const { messages, unreadCount, sending, sendMessage } = usePokerTableChat({
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
      dispatchHoldemAction(mapPokerUiActionToHoldemAction(uiAction, viewerSeatId, amount));
    },
    [dispatchHoldemAction, dispatchOnlineGameplay, isOnlineTable, viewerSeatId],
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
    const current = gameStateRef.current;
    if (!current.deck) {
      void dispatchShuffle();
      return;
    }
    void dispatchUiAction('start-hand');
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
    <div className="poker-panel" data-game="poker">
      {!gameState.holdem && (
        <div className="poker-panel__prehand">
          <p className="poker-panel__hint">
            {gameState.deck ? 'Ready to deal.' : 'Shuffle the deck, then start a hand.'}
          </p>
          <div className="poker-panel__prehand-actions">
            {!gameState.deck && (
              <button type="button" onClick={() => void dispatchShuffle()}>
                Shuffle deck
              </button>
            )}
            <button type="button" className="table-stake-panel__confirm" onClick={handleStartHand}>
              Start Hold&apos;em hand
            </button>
            {onInviteTable && (
              <button type="button" className="secondary" onClick={onInviteTable}>
                Invite to table
              </button>
            )}
          </div>
        </div>
      )}

      {gameState.holdem?.status === 'resolved' && (
        <div className="poker-panel__resolved">
          <p>{gameState.holdem.resultSummary}</p>
          {challengeEnded && authoritativeWinnerId && (
            <p className="poker-panel__challenge-ended">
              Challenge ended — Winner:{' '}
              {gameState.players[authoritativeWinnerId]?.displayName ?? 'Player'}
            </p>
          )}
          <button type="button" onClick={handleStartHand} disabled={challengeEnded}>
            Start new hand
          </button>
          {canEndChallengeEarly && (
            <button type="button" className="secondary" onClick={() => void handleEndChallenge()}>
              End challenge
            </button>
          )}
        </div>
      )}

      <PokerTableShell
        viewModel={viewModel}
        actionAvailability={actionAvailability}
        chatMessages={messages}
        unreadCount={unreadCount}
        chatSending={sending}
        disabled={false}
        onAction={gameState.holdem ? handleAction : undefined}
        onSendChat={(body) => void sendMessage(body)}
        canEditBlinds={canEditBlinds}
        onSaveBlinds={handleSaveBlinds}
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
