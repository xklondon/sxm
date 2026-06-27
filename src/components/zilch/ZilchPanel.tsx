import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AuthUser } from '../../api/client';
import type { GameState } from '../../types';
import type { VirtualPlayerStyle } from '../../types/player';
import {
  addVirtualPlayer,
  mergeSessionUpdate,
  recordZilchGameEnd,
} from '../../engine/session';
import { canRollDice, canControlZilchTurn } from '../../engine/dice/zilch';
import { canBeginZilchChallenge } from '../../engine/dice/zilch/zilchTurnAuthority';
import { getVisibleZilchPlayers } from '../../engine/dice/zilch/zilchVisiblePlayers';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';
import { useDeviceShake } from '../../hooks/useDeviceShake';
import { useZilchTableFlow } from '../useZilchTableFlow';
import { resolveViewerPersonIdForTable } from '../viewerIdentity';
import { toggleSideRailPanel, type SideRailPanel } from '../sideRailPanel';
import { TableSideRailShell } from '../TableSideRailShell';
import { TABLE_UX } from '../tableUxContract';
import { ZILCH_THROW_MS } from './zilchDiceAnimation';
import { ZilchPlayerRail } from './ZilchPlayerRail';
import { ZilchPlayArea } from './ZilchPlayArea';
import { ZilchStarterSpinner } from './ZilchStarterSpinner';
import { ZilchPracticeEndScreen } from './ZilchPracticeEndScreen';
import { ZilchThisTablePanel } from './ZilchThisTablePanel';
import '../../styles/bj-table-shared.css';
import '../../styles/zilch-table.css';

import type { TableResetSetupVariant } from '../TableStakePanel';

interface ZilchPanelProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  onInviteTable?: () => void;
  onlineTableId?: string | null;
  viewerAuth?: Pick<AuthUser, 'email' | 'displayName'> | null;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
  onlineActionInFlight?: boolean;
  onBeginTableReset?: (variant?: TableResetSetupVariant) => void;
}

const RANDOMISER_SPIN_MS = 2400;
const RANDOMISER_TICK_MS = 120;
const RANDOMISER_FALLBACK_MS = 3200;

export function ZilchPanel({
  gameState,
  onGameStateChange,
  onInviteTable,
  onlineTableId = null,
  viewerAuth = null,
  onlineDispatch,
  onlineActionInFlight = false,
  onBeginTableReset,
}: ZilchPanelProps) {
  const { session, zilch, tableMeta } = gameState;
  const isMobile = useIsMobileViewport();
  const viewerPersonId =
    resolveViewerPersonIdForTable(gameState, onlineTableId, viewerAuth) ??
    gameState.tableMeta.ownerPersonId ??
    null;
  const canAct = zilch ? canControlZilchTurn(gameState, viewerPersonId) : true;
  const isPracticeTable = tableMeta.tableMode !== 'challenge';
  const shakeReady = useDeviceShake(
    isMobile && Boolean(zilch && (zilch.phase === 'player-turn' || zilch.phase === 'final-round') && canAct),
  );
  const [virtualStyle, setVirtualStyle] = useState<VirtualPlayerStyle>('normal');
  const [animSeed] = useState(() => Math.floor(Math.random() * 1000));
  const [sideRailPanel, setSideRailPanel] = useState<SideRailPanel>(null);

  const {
    handleStartGame,
    handleRandomiseStarter,
    handleRollDice,
    handleKeepSelected,
    handleBank,
    actionError,
    clearActionError,
    zilchRevealCountdown,
  } = useZilchTableFlow({
    gameState,
    onGameStateChange,
    onlineDispatch,
    canRunZilchRevealTimer: canAct,
  });

  const [starterSpinActive, setStarterSpinActive] = useState(false);
  const [randomiserIndex, setRandomiserIndex] = useState(0);
  const spinTimersRef = useRef<{ tick?: number; done?: number }>({});
  const pendingStarterSpinRef = useRef(false);

  const visiblePlayers = useMemo(() => getVisibleZilchPlayers(gameState), [gameState]);
  const playerOrder = useMemo(
    () => visiblePlayers.map((player) => player.playerId),
    [visiblePlayers],
  );

  const tableModeLabel =
    tableMeta.tableMode === 'challenge' ? 'Challenge' : 'Practice';

  function stopStarterSpin() {
    const timers = spinTimersRef.current;
    if (timers.tick) {
      clearInterval(timers.tick);
    }
    if (timers.done) {
      clearTimeout(timers.done);
    }
    spinTimersRef.current = {};
    setStarterSpinActive(false);
  }

  function startStarterSpinPresentation(starterId: string | null) {
    stopStarterSpin();
    if (playerOrder.length === 0) {
      return;
    }
    setStarterSpinActive(true);
    const starterIdx = starterId ? playerOrder.indexOf(starterId) : 0;
    setRandomiserIndex(starterIdx >= 0 ? starterIdx : 0);

    spinTimersRef.current.tick = window.setInterval(() => {
      setRandomiserIndex((i) => (i + 1) % playerOrder.length);
    }, RANDOMISER_TICK_MS);

    spinTimersRef.current.done = window.setTimeout(() => {
      if (starterId) {
        const idx = playerOrder.indexOf(starterId);
        if (idx >= 0) {
          setRandomiserIndex(idx);
        }
      }
      stopStarterSpin();
    }, RANDOMISER_SPIN_MS);
  }

  function onRandomiseStarter() {
    if (onlineActionInFlight || visiblePlayers.length === 0 || starterSpinActive) {
      return;
    }
    pendingStarterSpinRef.current = true;
    startStarterSpinPresentation(null);
    const starterId = handleRandomiseStarter();
    if (starterId) {
      pendingStarterSpinRef.current = false;
      startStarterSpinPresentation(starterId);
      return;
    }
    if (!onlineDispatch) {
      pendingStarterSpinRef.current = false;
      stopStarterSpin();
    }
  }

  useEffect(() => {
    const starterId = zilch?.starterPlayerId;
    if (
      !pendingStarterSpinRef.current ||
      !starterId ||
      zilch?.phase !== 'player-turn'
    ) {
      return;
    }
    pendingStarterSpinRef.current = false;
    startStarterSpinPresentation(starterId);
  }, [zilch?.starterPlayerId, zilch?.phase]);

  useEffect(() => {
    if (!starterSpinActive) {
      return;
    }
    const fallback = window.setTimeout(() => stopStarterSpin(), RANDOMISER_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [starterSpinActive]);

  useEffect(() => () => stopStarterSpin(), []);

  useEffect(() => {
    if (shakeReady && zilch && canAct && canRollDice(zilch)) {
      handleRollDice();
    }
  }, [shakeReady, zilch, canAct, handleRollDice]);

  useEffect(() => {
    if (zilch?.phase !== 'completed' || !zilch.winnerPlayerId) {
      return;
    }
    if (tableMeta.gameStatus === 'ended' || tableMeta.outcome) {
      return;
    }
    onGameStateChange(recordZilchGameEnd(gameState));
  }, [
    zilch?.phase,
    zilch?.winnerPlayerId,
    tableMeta.gameStatus,
    tableMeta.outcome,
    gameState,
    onGameStateChange,
  ]);

  function handleAddVirtual() {
    try {
      const spl = addVirtualPlayer(session, gameState.players, gameState.ledger, { virtualStyle });
      onGameStateChange(mergeSessionUpdate(gameState, spl));
    } catch (err) {
      console.error(err);
    }
  }

  const rolling = zilch?.diceAnimation.isRolling ?? false;
  const rollMs = zilch?.diceAnimation.durationMs ?? gameState.zilchSettings.diceAnimation.diceAnimationMs;
  const visualRollMs = ZILCH_THROW_MS;
  const showValues = Boolean(zilch && !rolling);
  const controlsDisabled =
    rolling ||
    onlineActionInFlight ||
    !canAct ||
    zilch?.phase === 'zilch-reveal';
  const showPracticeEnd = Boolean(
    isPracticeTable && zilch?.phase === 'completed' && zilch.winnerPlayerId,
  );
  const showStarterSpinner = Boolean(
    zilch &&
      (zilch.phase === 'setup' ||
        zilch.phase === 'randomising-starter' ||
        starterSpinActive),
  );
  const highlightPlayerId =
    showStarterSpinner || zilch?.phase === 'setup'
      ? playerOrder[randomiserIndex] ?? null
      : zilch?.currentPlayerId ?? zilch?.starterPlayerId ?? null;
  const challengeNeedsOpponent = !isPracticeTable && !canBeginZilchChallenge(gameState);
  const randomiserDisabled =
    onlineActionInFlight ||
    visiblePlayers.length === 0 ||
    starterSpinActive ||
    challengeNeedsOpponent ||
    Boolean(zilch?.starterPlayerId && zilch.phase === 'player-turn');

  function renderThisTablePanel(onClose?: () => void) {
    return (
      <ZilchThisTablePanel
        gameState={gameState}
        isPractice={isPracticeTable}
        virtualStyle={virtualStyle}
        onVirtualStyleChange={setVirtualStyle}
        onResetTable={onBeginTableReset ? () => onBeginTableReset('resetTable') : undefined}
        onInviteTable={onInviteTable}
        onAddVirtual={handleAddVirtual}
        onClose={onClose}
      />
    );
  }

  function renderSideRail(variant: 'dock' | 'overlay') {
    if (!sideRailPanel) {
      return null;
    }
    const shell = (
      <div
        className={`${TABLE_UX.sideRailPlacement} ${
          variant === 'overlay'
            ? 'zilch-panel__this-table--overlay'
            : 'zilch-panel__this-table--dock'
        } zilch-panel__this-table-rail`}
        data-panel-placement={variant}
        data-side-panel={sideRailPanel}
        data-testid="zilch-this-table-rail"
      >
        <TableSideRailShell
          title="This Table"
          onClose={() => setSideRailPanel(null)}
        >
          {renderThisTablePanel(() => setSideRailPanel(null))}
        </TableSideRailShell>
      </div>
    );

    if (variant === 'overlay') {
      return (
        <div
          className={`${TABLE_UX.mobileSidePanelOverlay} zilch-panel__side-overlay`}
          role="presentation"
          onClick={() => setSideRailPanel(null)}
        >
          <div
            className={`${TABLE_UX.mobileSidePanelSheet} zilch-panel__side-sheet`}
            role="dialog"
            aria-modal="true"
            aria-label="This Table"
            onClick={(e) => e.stopPropagation()}
          >
            {shell}
          </div>
        </div>
      );
    }
    return shell;
  }

  return (
    <div className="zilch-panel zilch-panel--compact" data-game="zilch">
      <div className="zilch-panel__toolbar">
        <div>
          <h2 className="zilch-panel__title">Zilch</h2>
          <span className="zilch-panel__mode-label">{tableModeLabel}</span>
        </div>
        <div className="zilch-panel__toolbar-actions">
          <button
            type="button"
            className={
              sideRailPanel === 'thisTable'
                ? 'zilch-panel__this-table-btn zilch-panel__this-table-btn--active'
                : 'zilch-panel__this-table-btn'
            }
            onClick={() => setSideRailPanel((current) => toggleSideRailPanel(current, 'thisTable'))}
            aria-expanded={sideRailPanel === 'thisTable'}
            data-testid="zilch-this-table-toggle"
          >
            This Table
          </button>
        </div>
      </div>

      {challengeNeedsOpponent && (
        <p className="zilch-panel__setup-hint">Invite at least one player to start Challenge.</p>
      )}

      {!zilch && playerOrder.length > 0 && (
        <button type="button" onClick={handleStartGame} disabled={onlineActionInFlight}>
          Start Zilch
        </button>
      )}

      {!zilch && playerOrder.length === 0 && (
        <p className="zilch-panel__hint">
          {isPracticeTable
            ? 'Add at least one player to start Zilch.'
            : 'Invite at least one player to start Challenge.'}
        </p>
      )}

      {zilch && showPracticeEnd && (
        <ZilchPracticeEndScreen
          zilch={zilch}
          visiblePlayers={visiblePlayers}
          onStartNewRound={
            onBeginTableReset ? () => onBeginTableReset('resetTable') : undefined
          }
        />
      )}

      {zilch && !showPracticeEnd && (
        <div className="zilch-panel__stage">
          <div className="zilch-panel__main">
            <div
              className="zilch-table zilch-table--play"
              style={
                {
                  '--zilch-roll-ms': `${rollMs}ms`,
                  '--zilch-roll-visual-ms': `${visualRollMs}ms`,
                  '--zilch-gather-ms': '500ms',
                } as CSSProperties
              }
            >
              <div className="zilch-table__felt zilch-table__felt--canvas">
                <ZilchPlayerRail
                  zilch={zilch}
                  visiblePlayers={visiblePlayers}
                  highlightPlayerId={highlightPlayerId}
                />
                <div className="zilch-table__play-column">
                  {showStarterSpinner ? (
                    <div className="zilch-table__felt-center">
                      <ZilchStarterSpinner
                        players={visiblePlayers}
                        activeIndex={randomiserIndex}
                        spinning={starterSpinActive}
                        starterPlayerId={zilch.starterPlayerId}
                        disabled={randomiserDisabled}
                        onRandomiseStarter={onRandomiseStarter}
                        setupHint={
                          challengeNeedsOpponent
                            ? 'Invite at least one player to start Challenge.'
                            : undefined
                        }
                      />
                    </div>
                  ) : (
                    <ZilchPlayArea
                      zilch={zilch}
                      rolling={rolling}
                      showValues={showValues}
                      animSeed={animSeed}
                      controlsDisabled={controlsDisabled}
                      actionError={actionError}
                      onDismissError={clearActionError}
                      zilchRevealCountdown={zilchRevealCountdown}
                      onKeepSelected={handleKeepSelected}
                      onRollDice={handleRollDice}
                      onBank={handleBank}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          {!isMobile && sideRailPanel && renderSideRail('dock')}
        </div>
      )}

      {isMobile && sideRailPanel && renderSideRail('overlay')}

      {isMobile && zilch && (zilch.phase === 'player-turn' || zilch.phase === 'final-round') && canAct && (
        <p className="zilch-panel__shake-hint">
          Shake your phone for 3+ seconds to roll.
        </p>
      )}
    </div>
  );
}
