import { useState } from 'react';
import type { GameState, GameType } from '../types';
import { deriveAllBalancesFromLedger } from '../engine/ledger';
import {
  drawTestCard,
  getDealtCards,
  getLastDealtCard,
  getRemainingCardCount,
  resetGameDeck,
  shuffleGameDeck,
} from '../engine/deck';
import {
  addSeatAtTable,
  defaultBlackjackSeatId,
  DEFAULT_TABLE_CHIPS,
  removeSeatFromTable,
  selectTableGame,
  switchGameType,
  recordTableOutcome,
  startNewGameWithWager,
} from '../engine/session';
import { log } from '../utils/logger';
import {
  clearSavedGame,
  loadCurrentGame,
  saveCurrentGame,
} from '../storage/gameStorage';
import { LedgerPanel } from '../components/LedgerPanel';
import { PlayingCard } from '../components/PlayingCard';
import { BlackjackPanel } from '../components/BlackjackPanel';
import { HoldemPanel } from '../components/HoldemPanel';
import { TableStakePanel } from '../components/TableStakePanel';
import { InviteModal } from '../components/InviteModal';
import { AdminPanel } from '../components/AdminPanel';
import './TableScreen.css';

interface TableScreenProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  onLeave: () => void;
  onlineTableId?: string | null;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
  onlineActionInFlight?: boolean;
}

const GAME_OPTIONS: { value: GameType; label: string }[] = [
  { value: 'blackjack', label: 'Blackjack' },
  { value: 'texas-holdem', label: "Texas Hold'em" },
];

function dealingStatusLabel(status: GameState['session']['dealingStatus']): string {
  switch (status) {
    case 'no-deck':
      return 'No deck';
    case 'ready':
      return 'Ready';
    case 'depleted':
      return 'Depleted';
    default:
      return status;
  }
}

export function TableScreen({
  gameState,
  onGameStateChange,
  onLeave,
  onlineTableId = null,
  onlineDispatch,
  onlineActionInFlight = false,
}: TableScreenProps) {
  const {
    session,
    players,
    ledger,
    deck,
    tableGame,
    tableViewMode,
    selectedSeatId,
    tableMeta,
  } = gameState;

  const [joinName, setJoinName] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteToast, setInviteToast] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  const balances = deriveAllBalancesFromLedger(session, ledger);
  const remaining = deck ? getRemainingCardCount(deck) : 0;
  const lastDealt = deck ? getLastDealtCard(deck) : null;
  const dealtHistory = deck ? getDealtCards(deck) : [];
  const isBlackjack = tableGame === 'blackjack';
  const isHoldem = tableGame === 'texas-holdem';

  const bankId =
    session.gameType === 'texas-holdem'
      ? session.dealerButtonPlayerId
      : session.bankPlayerId;

  function handleSelectGame(gameType: GameType) {
    if (tableGame === gameType) {
      return;
    }
    if (
      tableGame !== null &&
      !window.confirm(
        `Switch to ${gameType === 'blackjack' ? 'Blackjack' : "Texas Hold'em"}? Hand progress will be cleared.`,
      )
    ) {
      return;
    }
    onGameStateChange(
      tableGame === null ? selectTableGame(gameState, gameType) : switchGameType(gameState, gameType),
    );
  }

  function setViewMode(mode: typeof tableViewMode) {
    onGameStateChange({ ...gameState, tableViewMode: mode });
  }

  function setSelectedSeat(seatId: string) {
    onGameStateChange({
      ...gameState,
      selectedSeatId: seatId,
      tableViewMode: 'card',
    });
  }

  function handleJoinTable() {
    const name = joinName.trim();
    if (!name) {
      return;
    }
    try {
      onGameStateChange({
        ...addSeatAtTable(gameState, {
          displayName: name,
          controllerName: name,
          startingChips: tableMeta.startingChipsEachSeat ?? tableMeta.agreement?.defaultChips ?? DEFAULT_TABLE_CHIPS,
        }),
        tableMeta: { ...gameState.tableMeta, controllerName: name },
      });
      setJoinName('');
      setShowJoin(false);
    } catch (err) {
      console.error(err);
    }
  }

  function handleRecordOutcome() {
    const winnerId = selectedSeatId ?? defaultBlackjackSeatId(gameState);
    const loserId = bankId && bankId !== winnerId ? bankId : session.playerIds.find((id) => id !== winnerId) ?? null;
    if (!winnerId) {
      return;
    }
    onGameStateChange(recordTableOutcome(gameState, winnerId, loserId));
  }

  function handleLeaveBox() {
    if (!selectedSeatId || selectedSeatId === bankId) {
      return;
    }
    try {
      onGameStateChange(removeSeatFromTable(gameState, selectedSeatId));
    } catch (err) {
      console.error(err);
    }
  }

  function handleShuffle() {
    onGameStateChange(shuffleGameDeck(gameState));
  }

  function handleDealTest() {
    onGameStateChange(drawTestCard(gameState));
  }

  function handleResetDeck() {
    onGameStateChange(resetGameDeck(gameState));
  }

  function handleStartNewGame() {
    const wager = window.prompt('New wager / stake?', tableMeta.agreement?.stakeDescription ?? '');
    if (wager === null) {
      return;
    }
    const seatDefault = String(tableMeta.startingChipsEachSeat ?? tableMeta.agreement?.defaultChips ?? DEFAULT_TABLE_CHIPS);
    const seatStr = window.prompt('Starting chips each seat?', seatDefault);
    if (seatStr === null) {
      return;
    }
    const seatAmount = Number.parseInt(seatStr, 10) || DEFAULT_TABLE_CHIPS;
    const bankDefault = String(tableMeta.startingChipsBank ?? seatAmount);
    const bankStr = window.prompt('Starting chips bank?', bankDefault);
    if (bankStr === null) {
      return;
    }
    const bankAmount = Number.parseInt(bankStr, 10) || seatAmount;
    if (!window.confirm('Start a new game? Table ledger will reset.')) {
      return;
    }
    onGameStateChange(startNewGameWithWager(gameState, wager, seatAmount, bankAmount));
  }

  function handleSaveGame() {
    try {
      saveCurrentGame(gameState);
      window.alert('Game saved.');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  function handleLoadGame() {
    const saved = loadCurrentGame();
    if (!saved) {
      window.alert('No saved game found.');
      return;
    }
    try {
      onGameStateChange(saved);
      log.info('Game loaded');
    } catch (err) {
      log.warn('Load failed', { err });
      window.alert('Could not load saved game.');
    }
  }

  function handleClearSavedGame() {
    if (!window.confirm('Clear saved game from this device?')) {
      return;
    }
    clearSavedGame();
  }

  const canDeal = deck !== null && remaining > 0;

  return (
    <main className="table-screen table-screen--casino">
      <header className="table-screen__header table-screen__header--compact">
        <label className="table-screen__game-select">
          <select
            value={tableGame ?? 'blackjack'}
            onChange={(e) => handleSelectGame(e.target.value as GameType)}
            aria-label="Choose game"
          >
            {GAME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <div className="table-screen__header-actions">
          {isBlackjack && (
            <>
              <button type="button" className="secondary" onClick={() => setInviteOpen(true)}>
                Invite
              </button>
              <button type="button" className="secondary" onClick={() => setAdminOpen(true)}>
                Admin
              </button>
              <button type="button" className="secondary" onClick={handleStartNewGame}>
                Start New Game
              </button>
              <button type="button" className="secondary" onClick={handleSaveGame}>
                Save Game
              </button>
              <button type="button" className="secondary" onClick={handleLoadGame}>
                Load Game
              </button>
              <button type="button" className="secondary" onClick={handleClearSavedGame}>
                Clear Saved
              </button>
            </>
          )}
          <button type="button" className="secondary table-screen__leave" onClick={onLeave}>
            Leave table
          </button>
        </div>
      </header>

      <InviteModal
        gameState={gameState}
        open={inviteOpen && isBlackjack}
        onClose={() => setInviteOpen(false)}
        onInvite={onGameStateChange}
        onInviteSent={(sentEmail) => {
          setInviteToast(`Invite sent to ${sentEmail}.`);
          window.setTimeout(() => setInviteToast(null), 4000);
        }}
        onlineTableId={onlineTableId}
      />

      {inviteToast && (
        <p className="table-screen__toast" role="status">
          {inviteToast}
        </p>
      )}

      <AdminPanel
        gameState={gameState}
        open={adminOpen && isBlackjack}
        onClose={() => setAdminOpen(false)}
        onUpdate={onGameStateChange}
      />

      {showJoin && (
        <div className="table-screen__join-bar">
          <input
            type="text"
            className="table-screen__join-input"
            placeholder="Your name"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinTable()}
          />
          <button type="button" onClick={handleJoinTable} disabled={!joinName.trim()}>Add</button>
          <button type="button" className="secondary" onClick={() => setShowJoin(false)}>Cancel</button>
        </div>
      )}

      {isHoldem && (
        <div className="table-screen__view-bar">
          <div className="table-screen__view-toggle">
            <button type="button" className={tableViewMode === 'full' ? '' : 'secondary'} onClick={() => setViewMode('full')}>Full Table</button>
            <button type="button" className={tableViewMode === 'card' ? '' : 'secondary'} onClick={() => setViewMode('card')}>Card View</button>
          </div>
          {tableViewMode === 'card' && (
            <select className="table-screen__seat-select" value={selectedSeatId ?? ''} onChange={(e) => setSelectedSeat(e.target.value)}>
              <option value="" disabled>Select box…</option>
              {session.playerIds.map((id) => (
                <option key={id} value={id}>{players[id].displayName}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className={`table-screen__layout table-screen__layout--wide${isBlackjack ? ' table-screen__layout--full' : ''}`}>
        <section className="table-felt table-felt--casino" aria-label="Table">
          {tableMeta.showStakeSetup && isBlackjack && (
            <TableStakePanel
              gameState={gameState}
              onConfirm={onGameStateChange}
            />
          )}

          {isBlackjack && (
            <BlackjackPanel
              gameState={gameState}
              onGameStateChange={onGameStateChange}
              onJoinTable={() => setShowJoin(true)}
              onInviteTable={() => setInviteOpen(true)}
              onLeaveBox={handleLeaveBox}
              onlineDispatch={onlineDispatch}
              onlineActionInFlight={onlineActionInFlight}
            />
          )}

          {isHoldem && (
            <>
              <div className="table-felt__deck-area table-felt__deck-area--compact">
                <p className="table-felt__deck-meta">{remaining} cards · {dealingStatusLabel(session.dealingStatus)}</p>
                <button type="button" onClick={handleShuffle}>Shuffle</button>
              </div>
              <HoldemPanel
                gameState={gameState}
                onGameStateChange={onGameStateChange}
                viewMode={tableViewMode}
                selectedSeatId={selectedSeatId}
              />
              {(tableViewMode === 'full' || !selectedSeatId) && (
                <ul className="table-felt__players">
                  {session.playerIds.map((id) => (
                    <li key={id} className="table-felt__player">
                      <span>{players[id].displayName}</span>
                      <span>{balances[id] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {!isBlackjack && !isHoldem && (
            <div className="table-felt__deck-area">
              <button type="button" onClick={handleShuffle}>Shuffle</button>
              <button type="button" onClick={handleDealTest} disabled={!canDeal}>Deal test</button>
              <button type="button" className="secondary" onClick={handleResetDeck}>Reset</button>
              {lastDealt && <PlayingCard card={lastDealt} compact animationMode="slide" />}
              {dealtHistory.map((card) => (
                <PlayingCard key={card.id} card={card} compact animationMode="fast" />
              ))}
            </div>
          )}
        </section>

        {!isBlackjack && (
          <aside className="table-screen__sidebar">
            <LedgerPanel
              gameState={gameState}
              onRecordOutcome={isBlackjack ? handleRecordOutcome : undefined}
            />
          </aside>
        )}
      </div>
    </main>
  );
}
