import { useState } from 'react';
import type { GameState, TableViewMode } from '../types';
import { deriveAllBalancesFromLedger } from '../engine/ledger';
import { getCardById } from '../engine/deck';
import {
  betHoldemOnState,
  callHoldemOnState,
  canBetHoldem,
  canCallHoldem,
  canCheckHoldem,
  canFoldHoldem,
  canRaiseHoldem,
  checkHoldemOnState,
  computeHoldemPot,
  createHoldemRoundOnState,
  foldHoldemOnState,
  newHoldemRoundOnState,
  raiseHoldemOnState,
  startHoldemHandOnState,
} from '../engine/holdem';
import { PlayingCard } from './PlayingCard';
import './HoldemPanel.css';

interface HoldemPanelProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  viewMode?: TableViewMode;
  selectedSeatId?: string | null;
}

export function HoldemPanel({
  gameState,
  onGameStateChange,
  viewMode = 'full',
  selectedSeatId = null,
}: HoldemPanelProps) {
  const { session, players, ledger, deck, holdem, holdemSettings } = gameState;
  const [betInput, setBetInput] = useState('10');
  const [error, setError] = useState<string | null>(null);

  const balances = deriveAllBalancesFromLedger(session, ledger);
  const round = holdem;
  const activeId = round?.activePlayerId ?? null;
  const pot = round ? computeHoldemPot(round) : 0;
  const betAmount = Number.parseInt(betInput, 10) || 0;

  function run(action: () => GameState) {
    setError(null);
    try {
      onGameStateChange(action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  function renderCard(cardId: string) {
    if (!deck) {
      return null;
    }
    const card = getCardById(deck, cardId);
    if (!card) {
      return null;
    }
    return <PlayingCard key={cardId} card={card} compact animationMode="slide" />;
  }

  if (!round) {
    return (
      <section className="holdem-panel" aria-label="Texas Hold'em">
        <h2 className="holdem-panel__title">Texas Hold&apos;em</h2>
        <p className="holdem-panel__hint">Shuffle the deck, then start a round.</p>
        <button
          type="button"
          disabled={!deck}
          onClick={() => run(() => createHoldemRoundOnState(gameState))}
        >
          Start Hold&apos;em round
        </button>
        {error && <p className="holdem-panel__error" role="alert">{error}</p>}
      </section>
    );
  }

  const isBettingOpen = ['preflop', 'flop', 'turn', 'river'].includes(round.status);
  const activePlayer = activeId ? players[activeId] : null;
  const focusPlayerId =
    viewMode === 'card' && selectedSeatId ? selectedSeatId : activeId;
  const showPlayerList = viewMode === 'full' || !selectedSeatId;
  const visiblePlayerIds =
    viewMode === 'card' && selectedSeatId
      ? [selectedSeatId]
      : session.playerIds;

  return (
    <section className="holdem-panel" aria-label="Texas Hold'em">
      <h2 className="holdem-panel__title">Texas Hold&apos;em</h2>

      <div className="holdem-panel__meta">
        <span>Street: {round.bettingStreet ?? round.status}</span>
        <span>Pot: {pot}</span>
        <span>Current bet: {round.currentBet}</span>
        <span>Blinds: {holdemSettings.smallBlind}/{holdemSettings.bigBlind}</span>
      </div>

      <div className="holdem-panel__positions">
        <span>Dealer: {players[round.dealerButtonPlayerId]?.displayName}</span>
        <span>SB: {players[round.smallBlindPlayerId]?.displayName} ({round.smallBlind})</span>
        <span>BB: {players[round.bigBlindPlayerId]?.displayName} ({round.bigBlind})</span>
      </div>

      {round.status === 'setup' && (
        <button type="button" className="holdem-panel__primary" onClick={() => run(() => startHoldemHandOnState(gameState))}>
          Post blinds &amp; deal hole cards
        </button>
      )}

      {round.communityCardIds.length > 0 && (
        <div
          className={
            viewMode === 'card'
              ? 'holdem-panel__community holdem-panel__community--compact'
              : 'holdem-panel__community'
          }
        >
          <p className="holdem-panel__label">Community</p>
          <div className="holdem-panel__cards">
            {round.communityCardIds.map((id) => renderCard(id))}
          </div>
        </div>
      )}

      {showPlayerList && (
      <ul className="holdem-panel__players">
        {visiblePlayerIds.map((playerId) => {
          const player = players[playerId];
          const ps = round.playerStates[playerId];
          const isActive = activeId === playerId;
          const isDealer = round.dealerButtonPlayerId === playerId;
          const isSb = round.smallBlindPlayerId === playerId;
          const isBb = round.bigBlindPlayerId === playerId;

          return (
            <li
              key={playerId}
              className={isActive ? 'holdem-panel__player holdem-panel__player--active' : 'holdem-panel__player'}
            >
              <div className="holdem-panel__player-head">
                <span className="holdem-panel__player-name">{player.displayName}</span>
                {player.controllerName !== player.displayName && (
                  <span className="holdem-panel__tags">· {player.controllerName}</span>
                )}
                <span className="holdem-panel__tags">
                  {isDealer && 'D '}
                  {isSb && 'SB '}
                  {isBb && 'BB '}
                  {ps?.actionStatus}
                </span>
              </div>
              <p className="holdem-panel__chips">
                {balances[playerId] ?? 0} chips · street bet {ps?.playerBetsThisStreet ?? 0}
              </p>
              {ps && ps.holeCardIds.length > 0 && (
                <div className="holdem-panel__cards">
                  {ps.holeCardIds.map((id) => renderCard(id))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      )}

      {viewMode === 'card' && selectedSeatId && !showPlayerList && (
        <div className="holdem-panel__player-focus">
          <p className="holdem-panel__label">Your seat</p>
          <p className="holdem-panel__prompt">{players[selectedSeatId]?.displayName}</p>
          {(round.playerStates[selectedSeatId]?.holeCardIds?.length ?? 0) > 0 && (
            <div className="holdem-panel__cards holdem-panel__cards--large">
              {round.playerStates[selectedSeatId]!.holeCardIds.map((id) => renderCard(id))}
            </div>
          )}
        </div>
      )}

      {isBettingOpen && activePlayer && (
        <div className="holdem-panel__actions">
          {viewMode === 'full' || focusPlayerId === activeId ? (
            <>
          <p className="holdem-panel__prompt">
            {activePlayer.displayName}&apos;s turn
            {activePlayer.playerType === 'virtual' ? ' (virtual)' : ''}
          </p>
          {activePlayer.playerType === 'real' && activeId && (
            <>
              <input
                type="number"
                min={round.bigBlind}
                className="holdem-panel__bet-input"
                value={betInput}
                onChange={(e) => setBetInput(e.target.value)}
                aria-label="Bet or raise amount"
              />
              <div className="holdem-panel__action-btns">
                <button
                  type="button"
                  disabled={!canCheckHoldem(round, activeId)}
                  onClick={() => run(() => checkHoldemOnState(gameState))}
                >
                  Check
                </button>
                <button
                  type="button"
                  disabled={!canCallHoldem(ledger, round, activeId)}
                  onClick={() => run(() => callHoldemOnState(gameState))}
                >
                  Call
                </button>
                <button
                  type="button"
                  disabled={!canBetHoldem(ledger, round, activeId, betAmount)}
                  onClick={() => run(() => betHoldemOnState(gameState, betAmount))}
                >
                  Bet
                </button>
                <button
                  type="button"
                  disabled={!canRaiseHoldem(ledger, round, activeId, betAmount)}
                  onClick={() => run(() => raiseHoldemOnState(gameState, betAmount))}
                >
                  Raise
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!canFoldHoldem(round, activeId)}
                  onClick={() => run(() => foldHoldemOnState(gameState))}
                >
                  Fold
                </button>
              </div>
            </>
          )}
            </>
          ) : (
            <p className="holdem-panel__prompt">
              Waiting for {activePlayer.displayName}&apos;s turn
            </p>
          )}
        </div>
      )}

      {round.actionLog.length > 0 && (
        <div className="holdem-panel__log">
          <p className="holdem-panel__label">Action log</p>
          <ul>
            {round.actionLog.slice(-6).map((entry, i) => (
              <li key={`${entry}-${i}`}>{entry}</li>
            ))}
          </ul>
        </div>
      )}

      {round.status === 'resolved' && (
        <div className="holdem-panel__result">
          <p>{round.resultSummary}</p>
          <button type="button" className="holdem-panel__primary" onClick={() => run(() => newHoldemRoundOnState(gameState))}>
            Start new Hold&apos;em round
          </button>
        </div>
      )}

      {error && <p className="holdem-panel__error" role="alert">{error}</p>}
    </section>
  );
}
