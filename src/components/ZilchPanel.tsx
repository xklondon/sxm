import { useEffect, useState } from 'react';
import type { GameState } from '../types';
import { deriveAllBalancesFromLedger } from '../engine/ledger';
import { recordTableOutcome } from '../engine/session';
import { canBank, canRollDice, getZilchWinnerId } from '../engine/zilch';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { useDeviceShake } from '../hooks/useDeviceShake';
import { useZilchTableFlow } from './useZilchTableFlow';
import { LedgerPanel } from './LedgerPanel';
import './ZilchPanel.css';

interface ZilchPanelProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  onJoinTable?: () => void;
  onInviteTable?: () => void;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
  onlineActionInFlight?: boolean;
}

const RANDOMISER_SPIN_MS = 2400;
const RANDOMISER_TICK_MS = 120;

export function ZilchPanel({
  gameState,
  onGameStateChange,
  onJoinTable,
  onInviteTable,
  onlineDispatch,
  onlineActionInFlight = false,
}: ZilchPanelProps) {
  const { session, players, zilch, tableMeta } = gameState;
  const isMobile = useIsMobileViewport();
  const shakeReady = useDeviceShake(isMobile && Boolean(zilch?.phase === 'player-turn'));
  const balances = deriveAllBalancesFromLedger(session, gameState.ledger);

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

  const playerOrder =
    session.playerIds.length > 0
      ? session.playerIds
      : tableMeta.boxSlots
          .filter((s) => s.playerId)
          .map((s) => s.playerId!);

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
    if (shakeReady && zilch && canRollDice(zilch)) {
      handleRollDice();
    }
  }, [shakeReady, zilch, handleRollDice]);

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
  }, [zilch?.phase, zilch?.winnerPlayerId, tableMeta.outcome, tableMeta.status]);

  const statusBanner = (() => {
    if (!zilch) {
      return 'Set up players, then start the Zilch game.';
    }
    switch (zilch.phase) {
      case 'setup':
        return 'Ready — randomise who starts.';
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
        return 'Choose a scoring combination to keep.';
      default:
        return zilch.turnScore > 0
          ? `Turn score: ${zilch.turnScore} — roll, bank, or quit.`
          : 'Roll the dice to begin your turn.';
    }
  })();

  const rolling = zilch?.diceAnimation.isRolling ?? false;
  const showValues = zilch && !rolling;

  return (
    <div className="zilch-panel" data-game="zilch">
      <header className="zilch-panel__header">
        <h2 className="zilch-panel__title">Zilch</h2>
        <div className="zilch-panel__header-actions">
          {onJoinTable && (
            <button type="button" className="secondary" onClick={onJoinTable}>
              Add player
            </button>
          )}
          {onInviteTable && (
            <button type="button" className="secondary" onClick={onInviteTable}>
              Invite
            </button>
          )}
        </div>
      </header>

      <p
        className={`zilch-panel__banner${
          zilch?.phase === 'final-round' ? ' zilch-panel__banner--final' : ''
        }${zilch?.phase === 'completed' ? ' zilch-panel__banner--winner' : ''}`}
        role="status"
      >
        {statusBanner}
      </p>

      {!zilch && (
        <button type="button" onClick={handleStartGame} disabled={playerOrder.length === 0}>
          Start game
        </button>
      )}

      {zilch && (
        <>
          <ul className="zilch-panel__players">
            {playerOrder.map((id) => {
              const isActive = zilch.currentPlayerId === id;
              const total = zilch.totalScoresByPlayerId[id] ?? 0;
              return (
                <li
                  key={id}
                  className={`zilch-panel__player${isActive ? ' zilch-panel__player--active' : ''}`}
                >
                  <div className="zilch-panel__player-name">{players[id]?.displayName ?? id}</div>
                  <div className="zilch-panel__player-score">
                    Total: {total} · Ledger: {balances[id] ?? 0}
                  </div>
                </li>
              );
            })}
          </ul>

          {zilch.phase === 'randomising-starter' && (
            <div
              className={`zilch-panel__randomiser${randomiserSpinning ? ' zilch-panel__randomiser--spin' : ''}`}
            >
              {players[playerOrder[randomiserIndex] ?? '']?.displayName ?? '…'}
            </div>
          )}

          {zilch.phase !== 'setup' && zilch.phase !== 'randomising-starter' && (
            <p className="zilch-panel__turn-score">
              Turn score: <strong>{zilch.turnScore}</strong>
              {zilch.mode === 'target_points' && (
                <span> · Target: {zilch.targetPoints}</span>
              )}
              {zilch.mode === 'fixed_rounds' && (
                <span> · Round {zilch.currentRound} / limit {zilch.roundLimit}</span>
              )}
            </p>
          )}

          <section className="zilch-panel__dice-area" aria-label="Dice">
            {(showValues ? zilch.dice : zilch.dice.length > 0 ? zilch.dice : []).map((die) => (
              <div
                key={die.id}
                className={`zilch-panel__die${rolling ? ' zilch-panel__die--rolling' : ''}${
                  die.isKept ? ' zilch-panel__die--kept' : ''
                }`}
              >
                {rolling ? '?' : die.value}
              </div>
            ))}
            {zilch.dice.length === 0 && zilch.phase === 'player-turn' && (
              <span className="zilch-panel__hint">Press Dice to roll</span>
            )}
          </section>

          {zilch.keptDice.length > 0 && (
            <section className="zilch-panel__kept" aria-label="Kept dice">
              {zilch.keptDice.map((g) => (
                <span key={g.id} className="zilch-panel__kept-group">
                  {g.label} (+{g.score})
                </span>
              ))}
            </section>
          )}

          {zilch.availableCombinations.length > 0 && (
            <section className="zilch-panel__combinations" aria-label="Scoring options">
              {zilch.availableCombinations.map((combo) => (
                <button
                  key={combo.id}
                  type="button"
                  className="zilch-panel__combo-btn secondary"
                  onClick={() => handleKeepCombination(combo.id)}
                  disabled={onlineActionInFlight}
                >
                  {combo.label} ({combo.score})
                </button>
              ))}
            </section>
          )}

          <div className="zilch-panel__actions">
            {zilch.phase === 'setup' && (
              <button type="button" onClick={handleRandomiseStarter} disabled={onlineActionInFlight}>
                Randomise starter
              </button>
            )}
            {(zilch.phase === 'player-turn' || zilch.phase === 'awaiting-keep-selection') && (
              <>
                <button
                  type="button"
                  onClick={handleRollDice}
                  disabled={!canRollDice(zilch) || onlineActionInFlight || rolling}
                >
                  {rolling ? 'Rolling…' : 'Dice'}
                </button>
                <button
                  type="button"
                  onClick={handleBank}
                  disabled={!canBank(zilch) || onlineActionInFlight}
                >
                  Bank
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleQuitTurn}
                  disabled={!canBank(zilch) || onlineActionInFlight}
                >
                  Quit turn
                </button>
              </>
            )}
          </div>

          {isMobile && zilch.phase === 'player-turn' && (
            <p className="zilch-panel__shake-hint">
              Shake your phone for 3+ seconds to roll (when it is your turn).
            </p>
          )}
        </>
      )}

      <LedgerPanel gameState={gameState} />
    </div>
  );
}
