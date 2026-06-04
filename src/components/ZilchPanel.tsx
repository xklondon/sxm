import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { GameState } from '../types';
import type { VirtualPlayerStyle } from '../types/player';
import {
  addVirtualPlayer,
  mergeSessionUpdate,
  recordTableOutcome,
} from '../engine/session';
import {
  canBank,
  canKeepCombination,
  canRollDice,
  getZilchWinnerId,
} from '../engine/zilch';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { useDeviceShake } from '../hooks/useDeviceShake';
import { useZilchTableFlow } from './useZilchTableFlow';
import { LedgerPanel } from './LedgerPanel';
import {
  canActOnZilchTurn,
  dieThrowStyle,
  playerBoxStatus,
  resolveZilchController,
  seatPositionClass,
  statusLabel,
} from './zilchPlayerDisplay';
import './ZilchPanel.css';

interface ZilchPanelProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  onInviteTable?: () => void;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
  onlineActionInFlight?: boolean;
}

const RANDOMISER_SPIN_MS = 2400;
const RANDOMISER_TICK_MS = 120;

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
    handleConfirmStarter,
    handleRollDice,
    handleKeepCombination,
    handleBank,
    handleQuitTurn,
  } = useZilchTableFlow({ gameState, onGameStateChange, onlineDispatch });

  const [randomiserIndex, setRandomiserIndex] = useState(0);
  const [randomiserSpinning, setRandomiserSpinning] = useState(false);

  const playerOrder = useMemo(() => {
    if (session.playerIds.length > 0) {
      return session.playerIds;
    }
    return tableMeta.boxSlots
      .filter((s) => s.playerId)
      .map((s) => s.playerId!);
  }, [session.playerIds, tableMeta.boxSlots]);

  useEffect(() => {
    if (zilch?.phase !== 'randomising-starter' || playerOrder.length === 0) {
      setRandomiserSpinning(false);
      return;
    }
    setRandomiserSpinning(true);
    const tick = window.setInterval(() => {
      setRandomiserIndex((i) => (i + 1) % playerOrder.length);
    }, RANDOMISER_TICK_MS);
    const done = window.setTimeout(() => {
      clearInterval(tick);
      setRandomiserSpinning(false);
      handleConfirmStarter();
    }, RANDOMISER_SPIN_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [zilch?.phase, playerOrder.length, handleConfirmStarter]);

  useEffect(() => {
    if (shakeReady && zilch && canAct && canRollDice(zilch)) {
      handleRollDice();
    }
  }, [shakeReady, zilch, canAct, handleRollDice]);

  useEffect(() => {
    if (zilch?.phase !== 'completed' || !zilch.winnerPlayerId) {
      return;
    }
    if (tableMeta.outcome || tableMeta.status === 'complete') {
      return;
    }
    const winnerId = zilch.winnerPlayerId;
    const loserId =
      playerOrder.find((id) => id !== winnerId) ?? session.bankPlayerId ?? null;
    onGameStateChange(recordTableOutcome(gameState, winnerId, loserId));
  }, [
    zilch?.phase,
    zilch?.winnerPlayerId,
    tableMeta.outcome,
    tableMeta.status,
    gameState,
    onGameStateChange,
    playerOrder,
    session.bankPlayerId,
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

  const statusBanner = (() => {
    if (!zilch) {
      return 'Invite players, then start the Zilch game.';
    }
    switch (zilch.phase) {
      case 'setup':
        return 'Randomise who starts.';
      case 'randomising-starter':
        return 'Choosing starter…';
      case 'final-round':
        return 'Final round — each other player gets one last turn.';
      case 'completed': {
        const w = getZilchWinnerId(zilch);
        const name = w ? players[w]?.displayName ?? 'Winner' : '—';
        return `Game over — ${name} wins!`;
      }
      case 'zilch':
        return 'Zilch! Turn score lost.';
      case 'awaiting-keep-selection':
        return 'Select a scoring combination to keep (you may choose a lower-scoring option).';
      default:
        if (!canAct) {
          return 'Waiting for another player…';
        }
        return zilch.turnScore > 0
          ? `Turn score ${zilch.turnScore} — roll again or bank.`
          : 'Press Dice to roll.';
    }
  })();

  const bannerClass =
    zilch?.phase === 'zilch' || zilch?.lastZilchPlayerId
      ? ' zilch-panel__banner--zilch'
      : zilch?.phase === 'final-round'
        ? ' zilch-panel__banner--final'
        : zilch?.phase === 'completed'
          ? ' zilch-panel__banner--winner'
          : '';

  const diceToRender =
    rolling && zilch
      ? zilch.dice.length > 0
        ? zilch.dice
        : Array.from({ length: 6 }, (_, i) => ({
            id: `rolling-${i}`,
            value: 1,
            isAvailable: true,
            isKept: false,
          }))
      : zilch?.dice ?? [];

  return (
    <div className="zilch-panel" data-game="zilch">
      <div className="zilch-panel__toolbar">
        <h2 className="zilch-panel__title">Zilch</h2>
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

      <p className={`zilch-panel__banner${bannerClass}`} role="status">
        {statusBanner}
      </p>

      {!zilch && (
        <button
          type="button"
          onClick={handleStartGame}
          disabled={playerOrder.length === 0}
        >
          Start game
        </button>
      )}

      <div
        className="zilch-table"
        style={{ '--zilch-roll-ms': `${rollMs}ms` } as CSSProperties}
      >
        {playerOrder.map((id, index) => {
          const player = players[id];
          const status = playerBoxStatus(id, zilch);
          const isActive = zilch?.currentPlayerId === id;
          const total = zilch?.totalScoresByPlayerId[id] ?? 0;
          const showTurnScore = isActive && zilch && zilch.turnScore > 0;
          return (
            <div
              key={id}
              className={`zilch-seat ${seatPositionClass(index, playerOrder.length)}${
                isActive ? ' zilch-seat--active' : ''
              }${status === 'zilch' ? ' zilch-seat--zilch' : ''}${
                status === 'winner' ? ' zilch-seat--winner' : ''
              }`}
            >
              <div className="zilch-seat__name">
                {player?.displayName ?? id}
                {player?.playerType === 'virtual' && (
                  <span className="zilch-seat__badge zilch-seat__badge--virtual">Virtual</span>
                )}
              </div>
              <div className="zilch-seat__score">Total: {total}</div>
              {showTurnScore && (
                <div className="zilch-seat__turn-score">Turn: {zilch!.turnScore}</div>
              )}
              <div
                className={`zilch-seat__status${
                  status === 'turn' ? ' zilch-seat__status--turn' : ''
                }${status === 'zilch' ? ' zilch-seat__status--zilch' : ''}`}
              >
                {statusLabel(status)}
              </div>
            </div>
          );
        })}

        <div className="zilch-table__felt">
          {zilch?.phase === 'randomising-starter' && (
            <div
              className={`zilch-panel__randomiser${
                randomiserSpinning ? ' zilch-panel__randomiser--spin' : ''
              }`}
            >
              {players[playerOrder[randomiserIndex] ?? '']?.displayName ?? '…'}
            </div>
          )}

          {zilch && zilch.phase !== 'randomising-starter' && (
            <>
              <div className="zilch-table__roll-zone" aria-label="Dice on table">
                {diceToRender.map((die, index) => (
                  <div
                    key={die.id}
                    className={`zilch-die${rolling ? ' zilch-die--throw' : ''}${
                      die.isKept ? ' zilch-die--kept' : ''
                    }`}
                    style={
                      rolling
                        ? (dieThrowStyle(index, animSeed + index) as CSSProperties)
                        : undefined
                    }
                  >
                    {rolling ? '?' : showValues ? die.value : '?'}
                  </div>
                ))}
                {diceToRender.length === 0 && zilch.phase === 'player-turn' && !rolling && (
                  <span className="zilch-table__hint">Press Dice to roll</span>
                )}
              </div>

              {zilch.keptDice.length > 0 && (
                <div className="zilch-table__kept" aria-label="Kept dice">
                  {zilch.keptDice.map((g) => (
                    <span key={g.id} className="zilch-table__kept-chip">
                      {g.label} (+{g.score})
                    </span>
                  ))}
                </div>
              )}

              {showValues && zilch.availableCombinations.length > 0 && (
                <div className="zilch-table__combos" aria-label="Scoring options">
                  {zilch.availableCombinations.map((combo) => (
                    <button
                      key={combo.id}
                      type="button"
                      className="zilch-table__combo-btn secondary"
                      onClick={() => handleKeepCombination(combo.id)}
                      disabled={controlsDisabled || !canKeepCombination(zilch)}
                    >
                      {combo.label} ({combo.score})
                    </button>
                  ))}
                </div>
              )}

              <div className="zilch-table__actions">
                {zilch.phase === 'setup' && (
                  <button
                    type="button"
                    onClick={handleRandomiseStarter}
                    disabled={controlsDisabled}
                  >
                    Randomise starter
                  </button>
                )}
                {(zilch.phase === 'player-turn' || zilch.phase === 'awaiting-keep-selection') && (
                  <>
                    <button
                      type="button"
                      onClick={handleRollDice}
                      disabled={!canRollDice(zilch) || controlsDisabled}
                    >
                      {rolling ? 'Rolling…' : 'Dice'}
                    </button>
                    <button
                      type="button"
                      onClick={handleBank}
                      disabled={!canBank(zilch) || controlsDisabled}
                    >
                      Bank
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={handleQuitTurn}
                      disabled={!canBank(zilch) || controlsDisabled}
                    >
                      Quit turn
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

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
