import { useState } from 'react';
import type { GameState, GameType } from '../types';
import type { VirtualPlayerStyle } from '../types/player';
import {
  addPlayer,
  addVirtualPlayer,
  assignBankOrDealer,
  createGameSession,
  mergeSessionUpdate,
  removePlayer,
  setStartingChips,
  startGame,
} from '../engine/session';
import { deriveAllBalancesFromLedger } from '../engine/ledger';
import './GameSetupScreen.css';

interface GameSetupScreenProps {
  gameState: GameState | null;
  onGameStateChange: (state: GameState) => void;
  onStart: () => void;
  onBack: () => void;
}

const GAME_OPTIONS: { value: GameType; label: string }[] = [
  { value: 'blackjack', label: 'Blackjack' },
  { value: 'texas-holdem', label: "Texas Hold'em" },
];

const VIRTUAL_STYLES: VirtualPlayerStyle[] = [
  'conservative',
  'normal',
  'aggressive',
  'random',
];

const DEFAULT_CHIPS = 500;

export function GameSetupScreen({
  gameState,
  onGameStateChange,
  onStart,
  onBack,
}: GameSetupScreenProps) {
  const [playerName, setPlayerName] = useState('');
  const [controllerName, setControllerName] = useState('');
  const [defaultChips, setDefaultChips] = useState(DEFAULT_CHIPS);
  const [virtualStyle, setVirtualStyle] = useState<VirtualPlayerStyle>('normal');
  const [error, setError] = useState<string | null>(null);
  const [chipEdits, setChipEdits] = useState<Record<string, string>>({});

  const selectedType = gameState?.session.gameType ?? null;
  const balances = gameState
    ? deriveAllBalancesFromLedger(gameState.session, gameState.ledger)
    : {};

  function selectGameType(gameType: GameType) {
    setError(null);
    if (gameState?.session.gameType === gameType) {
      return;
    }
    onGameStateChange(createGameSession(gameType));
  }

  function withState(updater: (state: GameState) => GameState) {
    if (!gameState) {
      return;
    }
    setError(null);
    try {
      onGameStateChange(updater(gameState));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function handleAddPlayer() {
    if (!gameState) {
      return;
    }
    withState((state) => {
      const spl = addPlayer(state.session, state.players, state.ledger, {
        displayName: playerName,
        controllerName: controllerName.trim() || undefined,
        startingChips: 0,
      });
      const id = spl.session.playerIds[spl.session.playerIds.length - 1]!;
      return setStartingChips(mergeSessionUpdate(state, spl), id, defaultChips);
    });
    setPlayerName('');
  }

  function handleAddVirtual() {
    if (!gameState) {
      return;
    }
    withState((state) => {
      const spl = addVirtualPlayer(state.session, state.players, state.ledger, {
        virtualStyle,
        startingChips: 0,
      });
      const id = spl.session.playerIds[spl.session.playerIds.length - 1]!;
      return setStartingChips(mergeSessionUpdate(state, spl), id, defaultChips);
    });
  }

  function handleRemovePlayer(playerId: string) {
    withState((state) =>
      mergeSessionUpdate(
        state,
        removePlayer(state.session, state.players, state.ledger, playerId),
      ),
    );
  }

  function handleAssignBank(playerId: string) {
    withState((state) => ({
      ...state,
      session: assignBankOrDealer(state.session, playerId),
    }));
  }

  function handleSetChips(playerId: string) {
    const raw = chipEdits[playerId] ?? String(defaultChips);
    const amount = Number.parseInt(raw, 10);
    if (Number.isNaN(amount) || amount < 0) {
      setError('Enter a valid chip amount (0 or greater)');
      return;
    }
    withState((state) => setStartingChips(state, playerId, amount));
  }

  function handleStart() {
    if (!gameState) {
      return;
    }
    setError(null);
    try {
      onGameStateChange({
        ...gameState,
        session: startGame(gameState.session),
        tableGame: null,
      });
      onStart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot start game');
    }
  }

  const bankLabel =
    selectedType === 'texas-holdem' ? 'Dealer button' : 'Bank / dealer';
  const bankId =
    selectedType === 'texas-holdem'
      ? gameState?.session.dealerButtonPlayerId
      : gameState?.session.bankPlayerId;

  const canStart =
    gameState &&
    gameState.session.playerIds.length > 0 &&
    bankId !== null &&
    bankId !== undefined;

  return (
    <main className="setup-screen">
      <div className="setup-screen__inner">
        <header className="setup-screen__header">
          <button type="button" className="secondary setup-screen__back" onClick={onBack}>
            ← Back
          </button>
          <h1 className="setup-screen__title">Game Setup</h1>
        </header>

        <section className="setup-card">
          <h2 className="setup-card__heading">Choose game</h2>
          <div className="setup-card__game-options">
            {GAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={
                  selectedType === opt.value
                    ? 'setup-card__game-btn setup-card__game-btn--active'
                    : 'setup-card__game-btn secondary'
                }
                onClick={() => selectGameType(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {gameState && (
          <>
            <section className="setup-card">
              <h2 className="setup-card__heading">Default starting chips</h2>
              <input
                type="number"
                min={0}
                className="setup-input"
                value={defaultChips}
                onChange={(e) => setDefaultChips(Number.parseInt(e.target.value, 10) || 0)}
              />
            </section>

            <section className="setup-card">
              <h2 className="setup-card__heading">Add players</h2>
              <div className="setup-card__row">
                <input
                  type="text"
                  className="setup-input setup-input--grow"
                  placeholder="Seat / player name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && playerName.trim() && handleAddPlayer()}
                />
                <button
                  type="button"
                  onClick={handleAddPlayer}
                  disabled={!playerName.trim()}
                >
                  Add player
                </button>
              </div>
              <div className="setup-card__row">
                <input
                  type="text"
                  className="setup-input setup-input--grow"
                  placeholder="Controlled by / played by (optional)"
                  value={controllerName}
                  onChange={(e) => setControllerName(e.target.value)}
                />
              </div>
              <div className="setup-card__row setup-card__row--virtual">
                <select
                  className="setup-input"
                  value={virtualStyle}
                  onChange={(e) => setVirtualStyle(e.target.value as VirtualPlayerStyle)}
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
            </section>

            <section className="setup-card">
              <h2 className="setup-card__heading">
                Players ({gameState.session.playerIds.length})
              </h2>
              {gameState.session.playerIds.length === 0 ? (
                <p className="setup-card__hint">Add at least one player to continue.</p>
              ) : (
                <ul className="setup-players">
                  {gameState.session.playerIds.map((id) => {
                    const player = gameState.players[id];
                    const isBank = bankId === id;
                    return (
                      <li key={id} className="setup-players__item">
                        <div className="setup-players__info">
                          <span className="setup-players__name">{player.displayName}</span>
                          {player.controllerName !== player.displayName && (
                            <span className="setup-players__badge">
                              controlled by {player.controllerName}
                            </span>
                          )}
                          <span className="setup-players__badge">
                            {player.playerType === 'virtual'
                              ? `virtual · ${player.virtualStyle}`
                              : 'real'}
                          </span>
                          {isBank && (
                            <span className="setup-players__bank-badge">{bankLabel}</span>
                          )}
                          <span className="setup-players__balance">
                            Ledger: {balances[id] ?? 0} chips
                          </span>
                        </div>
                        <div className="setup-players__actions">
                          <input
                            type="number"
                            min={0}
                            className="setup-input setup-input--chips"
                            placeholder="Chips"
                            value={chipEdits[id] ?? String(player.startingBalance || defaultChips)}
                            onChange={(e) =>
                              setChipEdits((prev) => ({ ...prev, [id]: e.target.value }))
                            }
                          />
                          <button type="button" className="secondary" onClick={() => handleSetChips(id)}>
                            Set chips
                          </button>
                          <label className="setup-players__bank-label">
                            <input
                              type="radio"
                              name="bank"
                              checked={isBank}
                              onChange={() => handleAssignBank(id)}
                            />
                            {bankLabel}
                          </label>
                          <button
                            type="button"
                            className="secondary setup-players__remove"
                            onClick={() => handleRemovePlayer(id)}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {error && <p className="setup-screen__error" role="alert">{error}</p>}

            <button
              type="button"
              className="setup-screen__start"
              onClick={handleStart}
              disabled={!canStart}
            >
              Start local game
            </button>
          </>
        )}
      </div>
    </main>
  );
}
