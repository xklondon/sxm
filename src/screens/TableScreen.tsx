import { useCallback, useEffect, useState } from 'react';
import type { GameState } from '../types';
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
  normalizeLoadedGameState,
  removeSeatFromTable,
  recordTableOutcome,
} from '../engine/session';
import type { TableStakeSetupInput } from '../engine/session/tableSetup';
import type { ZilchTableStakeSetupInput } from '../engine/session/zilchTableSetup';
import type { HoldemTableStakeSetupInput } from '../engine/session/holdemTableSetup';
import { log } from '../utils/logger';
import {
  loadCurrentGame,
  saveCurrentGame,
} from '../storage/gameStorage';
import { LedgerPanel } from '../components/LedgerPanel';
import { PlayingCard } from '../components/PlayingCard';
import { BlackjackPanel } from '../components/BlackjackPanel';
import { PokerPanel } from '../games/poker/components/PokerPanel';
import { ZilchPanel } from '../components/ZilchPanel';
import {
  TableStakePanel,
  type TableResetSetupVariant,
  type TableStakePanelMode,
} from '../components/TableStakePanel';
import { NewTableOverlay } from '../components/NewTableOverlay';
import { InviteModal } from '../components/InviteModal';
import { AdminPanel } from '../components/AdminPanel';
import { TableChatDock } from '../features/messaging/TableChatDock';
import { loadProfile } from '../storage/profileStorage';
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
  onConfirmNavNewTable?: (input: TableStakeSetupInput | ZilchTableStakeSetupInput | HoldemTableStakeSetupInput) => void | Promise<void>;
}

export function TableScreen({
  gameState,
  onGameStateChange,
  onLeave,
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
    ledger: _ledger,
    deck,
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
  const [setupFlowKey, setSetupFlowKey] = useState(0);

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
    const winnerId = gameState.selectedSeatId ?? defaultBlackjackSeatId(gameState);
    const loserId = bankId && bankId !== winnerId ? bankId : session.playerIds.find((id) => id !== winnerId) ?? null;
    if (!winnerId) {
      return;
    }
    onGameStateChange(recordTableOutcome(gameState, winnerId, loserId));
  }

  function handleLeaveBox() {
    const selectedSeatId = gameState.selectedSeatId;
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

  function openSetupFlow(options: {
    reset?: boolean;
    variant?: TableResetSetupVariant;
    navNew?: boolean;
  }) {
    setSetupFlowKey((key) => key + 1);
    if (options.reset) {
      setResetSetupOpen(true);
      setResetSetupVariant(options.variant ?? 'resetTable');
      setStakePanelMode('reset');
      setNavNewTableSetup(false);
      return;
    }
    setNavNewTableSetup(Boolean(options.navNew));
    setResetSetupOpen(false);
    setResetSetupVariant('resetTable');
    setStakePanelMode('new');
    if (options.navNew) {
      onGameStateChange({
        ...gameState,
        tableMeta: { ...gameState.tableMeta, showStakeSetup: true },
      });
    }
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

  const stakeSetupOpen = (isBlackjack || isZilch || isHoldem) && (tableMeta.showStakeSetup || resetSetupOpen);
  const stagedNewTableOpen = stakeSetupOpen && !resetSetupOpen;
  const stakeSetupTitle = resetSetupOpen
    ? resetSetupVariant === 'newGame'
      ? 'New game'
      : 'Reset table'
    : 'Start new table';
  const stakeSetupAriaLabel = resetSetupOpen
    ? resetSetupVariant === 'newGame'
      ? 'New game setup'
      : 'Reset table setup'
    : 'Start new table setup';
  const setupEntryPoint = resetSetupOpen ? 'reset-table' : 'menu-new-table';

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
      openSetupFlow({ navNew: true });
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
  const profile = loadProfile();
  const chatTableId = onlineTableId ?? session.id;
  const chatUserEmail = viewerAuth?.email ?? profile.email ?? null;
  const chatUserName = viewerAuth?.displayName ?? profile.name ?? null;

  return (
    <main className="table-screen table-screen--casino">
      <InviteModal
        gameState={gameState}
        open={inviteOpen && (isBlackjack || isZilch || isHoldem)}
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

      <div
        className={`table-screen__layout table-screen__layout--wide${
          isBlackjack || isZilch || isHoldem ? ' table-screen__layout--full' : ''
        }`}
      >
        <section className="table-felt table-felt--casino" aria-label="Table">
          {isZilch && (
            <ZilchPanel
              gameState={gameState}
              onGameStateChange={onGameStateChange}
              onInviteTable={() => setInviteOpen(true)}
              onlineTableId={onlineTableId}
              viewerAuth={viewerAuth}
              onlineDispatch={onlineDispatch}
              onlineActionInFlight={onlineActionInFlight}
              onBeginTableReset={(variant = 'resetTable') => {
                openSetupFlow({ reset: true, variant });
              }}
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
              onExitTable={onLeave}
              onBeginTableReset={(variant = 'resetTable') => {
                openSetupFlow({ reset: true, variant });
              }}
            />
          )}

          {isHoldem && (
            <PokerPanel
              gameState={gameState}
              onGameStateChange={onGameStateChange}
              onlineTableId={onlineTableId}
              onlineDispatch={onlineDispatch}
              viewerAuth={viewerAuth}
              onInviteTable={() => setInviteOpen(true)}
              onBeginTableReset={(variant = 'resetTable') => {
                openSetupFlow({ reset: true, variant });
              }}
              onExitTable={onLeave}
            />
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

        {!isBlackjack && !isZilch && !isHoldem && (
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
            entryPoint={setupEntryPoint}
            setupFlowKey={setupFlowKey}
            onSetupDirtyChange={stagedNewTableOpen ? setNewTableSetupDirty : undefined}
            onConfirmNewTable={
              navNewTableSetup && onConfirmNavNewTable ? onConfirmNavNewTable : undefined
            }
            onConfirm={(next) => {
              onGameStateChange(normalizeLoadedGameState(next));
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
      {!isHoldem && (
        <TableChatDock
          tableId={chatTableId}
          currentUserEmail={chatUserEmail}
          currentUserName={chatUserName}
          preferServer={Boolean(onlineTableId)}
        />
      )}
    </main>
  );
}
