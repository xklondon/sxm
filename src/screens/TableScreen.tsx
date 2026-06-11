import { useCallback, useEffect, useState } from 'react';
import type { GameState } from '../types';
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
  isBlackjackTable,
  isHoldemTable,
  isZilchTable,
  removeSeatFromTable,
  recordTableOutcome,
} from '../engine/session';
import type { TableStakeSetupInput } from '../engine/session/tableSetup';
import { log } from '../utils/logger';
import {
  loadCurrentGame,
  saveCurrentGame,
} from '../storage/gameStorage';
import { LedgerPanel } from '../components/LedgerPanel';
import { PlayingCard } from '../components/PlayingCard';
import { BlackjackPanel } from '../components/BlackjackPanel';
import { HoldemPanel } from '../components/HoldemPanel';
import { ZilchPanel } from '../components/ZilchPanel';
import {
  TableStakePanel,
  type TableResetSetupVariant,
  type TableStakePanelMode,
} from '../components/TableStakePanel';
import { NewTableOverlay } from '../components/NewTableOverlay';
import { InviteModal } from '../components/InviteModal';
import { AdminPanel } from '../components/AdminPanel';
import './TableScreen.css';

export interface TableNavHandlers {
  saveTable: () => void;
  loadTable: () => void;
  openNewTableSetup: () => void;
  openAdmin: () => void;
}

import type { AuthUser } from '../api/client';

interface TableScreenProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  onLeave: () => void;
  onlineTableId?: string | null;
  viewerAuth?: Pick<AuthUser, 'email' | 'displayName'> | null;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
  onlineActionInFlight?: boolean;
  profileOpen?: boolean;
  onProfileOpenChange?: (open: boolean) => void;
  onRegisterNavHandlers?: (handlers: TableNavHandlers | null) => void;
  /** When set, confirming New Table setup creates a fresh table (online or local). */
  onConfirmNavNewTable?: (input: TableStakeSetupInput) => void | Promise<void>;
}

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
  onlineTableId = null,
  viewerAuth = null,
  onlineDispatch,
  onlineActionInFlight = false,
  profileOpen,
  onProfileOpenChange,
  onRegisterNavHandlers,
  onConfirmNavNewTable,
}: TableScreenProps) {
  const {
    session,
    players,
    ledger,
    deck,
    tableViewMode,
    selectedSeatId,
    tableMeta,
  } = gameState;

  const [joinName, setJoinName] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteToast, setInviteToast] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [stakePanelMode, setStakePanelMode] = useState<TableStakePanelMode>('new');
  const [resetSetupOpen, setResetSetupOpen] = useState(false);
  const [resetSetupVariant, setResetSetupVariant] =
    useState<TableResetSetupVariant>('resetTable');
  const [navNewTableSetup, setNavNewTableSetup] = useState(false);
  const [newTableSetupDirty, setNewTableSetupDirty] = useState(false);

  const balances = deriveAllBalancesFromLedger(session, ledger);
  const remaining = deck ? getRemainingCardCount(deck) : 0;
  const lastDealt = deck ? getLastDealtCard(deck) : null;
  const dealtHistory = deck ? getDealtCards(deck) : [];
  const isZilch = isZilchTable(gameState);
  const isBlackjack = isBlackjackTable(gameState);
  const isHoldem = isHoldemTable(gameState);

  const bankId =
    session.gameType === 'texas-holdem'
      ? session.dealerButtonPlayerId
      : session.bankPlayerId;

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

  function closeStakeSetup() {
    setNavNewTableSetup(false);
    setResetSetupOpen(false);
    setResetSetupVariant('resetTable');
    setStakePanelMode('new');
    setNewTableSetupDirty(false);
    if (tableMeta.showStakeSetup) {
      onGameStateChange({
        ...gameState,
        tableMeta: { ...gameState.tableMeta, showStakeSetup: false },
      });
    }
  }

  const stakeSetupOpen = (isBlackjack || isZilch) && (tableMeta.showStakeSetup || resetSetupOpen);
  const stagedNewTableOpen = stakeSetupOpen && !resetSetupOpen;
  const stakeSetupTitle = resetSetupOpen
    ? resetSetupVariant === 'newGame'
      ? 'New Game'
      : 'Reset table'
    : 'New Table';
  const stakeSetupAriaLabel = resetSetupOpen
    ? resetSetupVariant === 'newGame'
      ? 'New game setup'
      : 'Reset table setup'
    : 'New table setup';

  const registerNavHandlers = useCallback((): TableNavHandlers => ({
    saveTable: () => {
      try {
        saveCurrentGame(gameState);
        window.alert('Table saved.');
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Save failed.');
      }
    },
    loadTable: () => {
      const saved = loadCurrentGame();
      if (!saved) {
        window.alert('No saved table found.');
        return;
      }
      try {
        onGameStateChange(saved);
        log.info('Game loaded');
      } catch (err) {
        log.warn('Load failed', { err });
        window.alert('Could not load saved table.');
      }
    },
    openNewTableSetup: () => {
      setNavNewTableSetup(true);
      setResetSetupOpen(false);
      setResetSetupVariant('resetTable');
      setStakePanelMode('new');
      onGameStateChange({
        ...gameState,
        tableMeta: { ...gameState.tableMeta, showStakeSetup: true },
      });
    },
    openAdmin: () => setAdminOpen(true),
  }), [gameState, onGameStateChange, tableMeta]);

  function handleSaveGame() {
    registerNavHandlers().saveTable();
  }

  useEffect(() => {
    if (!onRegisterNavHandlers) {
      return;
    }
    onRegisterNavHandlers(registerNavHandlers());
    return () => onRegisterNavHandlers(null);
  }, [onRegisterNavHandlers, registerNavHandlers]);

  const canDeal = deck !== null && remaining > 0;

  return (
    <main className="table-screen table-screen--casino">
      <InviteModal
        gameState={gameState}
        open={inviteOpen && (isBlackjack || isZilch)}
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

      <div
        className={`table-screen__layout table-screen__layout--wide${
          isBlackjack || isZilch ? ' table-screen__layout--full' : ''
        }`}
      >
        <section className="table-felt table-felt--casino" aria-label="Table">
          {isZilch && (
            <ZilchPanel
              gameState={gameState}
              onGameStateChange={onGameStateChange}
              onInviteTable={() => setInviteOpen(true)}
              onlineDispatch={onlineDispatch}
              onlineActionInFlight={onlineActionInFlight}
            />
          )}

          {isBlackjack && (
            <BlackjackPanel
              gameState={gameState}
              onGameStateChange={onGameStateChange}
              onJoinTable={() => setShowJoin(true)}
              onInviteTable={() => setInviteOpen(true)}
              onLeaveBox={handleLeaveBox}
              onlineTableId={onlineTableId}
              viewerAuth={viewerAuth}
              onlineDispatch={onlineDispatch}
              onlineActionInFlight={onlineActionInFlight}
              profileOpen={profileOpen}
              onProfileOpenChange={onProfileOpenChange}
              onSaveTable={handleSaveGame}
              onBeginTableReset={(variant = 'resetTable') => {
                setResetSetupVariant(variant);
                setStakePanelMode('reset');
                setResetSetupOpen(true);
              }}
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

          {!isBlackjack && !isHoldem && !isZilch && (
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

        {!isBlackjack && !isZilch && (
          <aside className="table-screen__sidebar">
            <LedgerPanel
              gameState={gameState}
              onRecordOutcome={isBlackjack ? handleRecordOutcome : undefined}
            />
          </aside>
        )}
      </div>

      {/* Canonical New Table flow — do not fork: in-table uses same NewTableOverlay + embedded TableStakePanel. */}
      {stakeSetupOpen && (
        <NewTableOverlay
          open
          title={stakeSetupTitle}
          ariaLabel={stakeSetupAriaLabel}
          confirmDiscardWhenDirty={stagedNewTableOpen && newTableSetupDirty}
          onClose={closeStakeSetup}
        >
          <TableStakePanel
            gameState={gameState}
            mode={resetSetupOpen ? 'reset' : stakePanelMode}
            resetSetupVariant={resetSetupVariant}
            embeddedInOverlay
            onSetupDirtyChange={stagedNewTableOpen ? setNewTableSetupDirty : undefined}
            onConfirmNewTable={
              navNewTableSetup && onConfirmNavNewTable ? onConfirmNavNewTable : undefined
            }
            onConfirm={(next) => {
              onGameStateChange(next);
              setNavNewTableSetup(false);
              setResetSetupOpen(false);
              setResetSetupVariant('resetTable');
              setStakePanelMode('new');
            }}
            onFinished={() => {
              setResetSetupOpen(false);
              setResetSetupVariant('resetTable');
              setStakePanelMode('new');
            }}
            onlineDispatch={onlineDispatch}
            onlineTableId={onlineTableId}
          />
        </NewTableOverlay>
      )}
    </main>
  );
}
