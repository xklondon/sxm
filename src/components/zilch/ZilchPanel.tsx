import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GameState } from '../../types';
import type { VirtualPlayerStyle } from '../../types/player';
import {
  addVirtualPlayer,
  mergeSessionUpdate,
  recordZilchGameEnd,
} from '../../engine/session';
import { canRollDice } from '../../engine/dice/zilch';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';
import { useDeviceShake } from '../../hooks/useDeviceShake';
import { useZilchTableFlow } from '../useZilchTableFlow';
import { LedgerPanel } from '../LedgerPanel';
import { canActOnZilchTurn, resolveZilchController } from '../zilchPlayerDisplay';
import { ZilchCommand } from './ZilchCommand';
import { ZilchPlayerRail } from './ZilchPlayerRail';
import { ZilchDiceArea } from './ZilchDiceArea';
import { ZilchActions } from './ZilchActions';
import '../../styles/zilch-table.css';

interface ZilchPanelProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  onInviteTable?: () => void;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
  onlineActionInFlight?: boolean;
}

const RANDOMISER_SPIN_MS = 2400;
const RANDOMISER_TICK_MS = 120;
const RANDOMISER_FALLBACK_MS = 3200;

const VIRTUAL_STYLES: VirtualPlayerStyle[] = [
  'conservative',
  'normal',
  'aggressive',
  'random',
];

export function ZilchPanel({
  gameState,
  onGameStateChange,
  onInviteTable,
  onlineDispatch,
  onlineActionInFlight = false,
}: ZilchPanelProps) {
  const { session, players, zilch, tableMeta } = gameState;
  const isMobile = useIsMobileViewport();
  const controller = resolveZilchController(gameState);
  const canAct = zilch ? canActOnZilchTurn(gameState, controller) : true;
  const shakeReady = useDeviceShake(
    isMobile && Boolean(zilch?.phase === 'player-turn' && canAct),
  );
  const [virtualStyle, setVirtualStyle] = useState<VirtualPlayerStyle>('normal');
  const [animSeed] = useState(() => Math.floor(Math.random() * 1000));

  const {
    handleStartGame,
    handleRandomiseStarter,
    handleRollDice,
    handleKeepCombination,
    handleBank,
    handleQuitTurn,
  } = useZilchTableFlow({ gameState, onGameStateChange, onlineDispatch });

  const [starterSpinActive, setStarterSpinActive] = useState(false);
  const [randomiserIndex, setRandomiserIndex] = useState(0);
  const spinTimersRef = useRef<{ tick?: number; done?: number }>({});
  const pendingStarterSpinRef = useRef(false);

  const playerOrder = useMemo(() => {
    if (session.playerIds.length > 0) {
      return session.playerIds;
    }
    return tableMeta.boxSlots
      .filter((s) => s.playerId)
      .map((s) => s.playerId!);
  }, [session.playerIds, tableMeta.boxSlots]);

  const playerNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const id of playerOrder) {
      names[id] = players[id]?.displayName ?? id;
    }
    return names;
  }, [playerOrder, players]);

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
    pendingStarterSpinRef.current = true;
    startStarterSpinPresentation(null);
    const starterId = handleRandomiseStarter();
    if (starterId) {
      pendingStarterSpinRef.current = false;
      startStarterSpinPresentation(starterId);
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
      const spl = addVirtualPlayer(session, players, gameState.ledger, { virtualStyle });
      onGameStateChange(mergeSessionUpdate(gameState, spl));
    } catch (err) {
      console.error(err);
    }
  }

  const rolling = zilch?.diceAnimation.isRolling ?? false;
  const rollMs = zilch?.diceAnimation.durationMs ?? gameState.zilchSettings.diceAnimation.diceAnimationMs;
  const showValues = Boolean(zilch && !rolling);
  const controlsDisabled = rolling || onlineActionInFlight || !canAct;

  return (
    <div className="zilch-panel" data-game="zilch">
      <div className="zilch-panel__toolbar">
        <div>
          <h2 className="zilch-panel__title">Zilch</h2>
          <span className="zilch-panel__mode-label">{tableModeLabel}</span>
        </div>
        <div className="zilch-panel__toolbar-actions">
          {onInviteTable && (
            <button type="button" onClick={onInviteTable}>
              Invite to table
            </button>
          )}
          <select
            className="secondary"
            value={virtualStyle}
            onChange={(e) => setVirtualStyle(e.target.value as VirtualPlayerStyle)}
            aria-label="Virtual player style"
          >
            {VIRTUAL_STYLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="button" className="secondary" onClick={handleAddVirtual}>
            Add virtual player
          </button>
        </div>
      </div>

      <ZilchCommand zilch={zilch} playerNames={playerNames} canAct={canAct} />

      {!zilch && playerOrder.length > 0 && (
        <button type="button" onClick={handleStartGame} disabled={onlineActionInFlight}>
          Start Zilch
        </button>
      )}

      {!zilch && playerOrder.length === 0 && (
        <p className="zilch-panel__hint">Add at least one player to start Zilch.</p>
      )}

      {zilch && (
        <div
          className="zilch-table"
          style={{ '--zilch-roll-ms': `${rollMs}ms` } as CSSProperties}
        >
          <ZilchPlayerRail gameState={gameState} zilch={zilch} playerOrder={playerOrder} />
          <div className="zilch-table__felt">
            <ZilchDiceArea
              zilch={zilch}
              rolling={rolling}
              showValues={showValues}
              animSeed={animSeed}
              controlsDisabled={controlsDisabled}
              starterSpinActive={starterSpinActive}
              randomiserIndex={randomiserIndex}
              playerOrder={playerOrder}
              playerNames={playerNames}
              onKeepCombination={handleKeepCombination}
            />
            <ZilchActions
              zilch={zilch}
              rolling={rolling}
              controlsDisabled={controlsDisabled}
              onlineActionInFlight={onlineActionInFlight}
              hasPlayers={playerOrder.length > 0}
              onRandomiseStarter={onRandomiseStarter}
              onRollDice={handleRollDice}
              onBank={handleBank}
              onQuitTurn={handleQuitTurn}
            />
          </div>
        </div>
      )}

      {isMobile && zilch?.phase === 'player-turn' && canAct && (
        <p className="zilch-panel__shake-hint">
          Shake your phone for 3+ seconds to roll.
        </p>
      )}

      <div className="zilch-panel__ledger">
        <LedgerPanel gameState={gameState} />
      </div>
    </div>
  );
}
