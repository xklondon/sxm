import { useCallback, useEffect, useState } from 'react';
import type { GameState } from './types';
import { createNewBlackjackTable } from './engine/session';
import { applySettingsToGameState, loadSettings } from './storage/settingsStorage';
import {
  loadProfile,
  needsLocalProfileSetup,
  syncAuthEmailToProfile,
} from './storage/profileStorage';
import { applyDesignTemplateToDocument } from './design/templates';
import { StartScreen } from './screens/StartScreen';
import { GameSetupScreen } from './screens/GameSetupScreen';
import { TableScreen, type TableNavHandlers } from './screens/TableScreen';
import { LocalProfileSetup } from './components/LocalProfileSetup';
import { ScoreLedgerModal } from './components/LedgerModals';
import { createOnlineTable, isPeopleAdmin, logout, type AuthUser } from './api/client';
import { PeopleScreen } from './screens/PeopleScreen';
import { apiPath } from './api/config';
import {
  setStoredOnlineTableId,
  useOnlineTable,
} from './hooks/useOnlineMultiplayer';
import {
  consumePendingTable,
  getPendingTable,
  rememberPendingTable,
} from './session/pendingTable';
import './index.css';

type AppScreen = 'start' | 'setup' | 'table' | 'people';

interface AppProps {
  user?: AuthUser | null;
  onlineMode?: boolean;
  onlineTableId?: string | null;
}

function createTableWithSettings(): GameState {
  const settings = loadSettings();
  const profile = loadProfile();
  let state = applySettingsToGameState(createNewBlackjackTable(), settings);
  applyDesignTemplateToDocument(state.designTemplateId);
  if (profile.name.trim()) {
    state = {
      ...state,
      tableMeta: { ...state.tableMeta, controllerName: profile.name.trim() },
    };
  }
  return state;
}

function ThemeSync({ templateId }: { templateId: string }) {
  useEffect(() => {
    applyDesignTemplateToDocument(templateId);
  }, [templateId]);
  return null;
}

function formatRoleLabel(role?: AuthUser['role']): string {
  switch (role) {
    case 'root':
    case 'admin':
      return 'admin';
    case 'guest':
      return 'guest';
    default:
      return 'player';
  }
}

export default function App({ user, onlineMode = false, onlineTableId = null }: AppProps) {
  const tableFromUrl = onlineTableId;
  const pendingTable = getPendingTable();
  const resolvedTableId = tableFromUrl ?? pendingTable;
  const [screen, setScreen] = useState<AppScreen>(resolvedTableId ? 'table' : 'start');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(resolvedTableId);
  const [loadingOnline, setLoadingOnline] = useState(Boolean(resolvedTableId));
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scoreLedgerOpen, setScoreLedgerOpen] = useState(false);
  const [inviteTableName, setInviteTableName] = useState<string | null>(null);
  const [tableVersion, setTableVersion] = useState<number | null>(null);
  const [tableNavHandlers, setTableNavHandlers] = useState<TableNavHandlers | null>(null);
  const [autoNewTablePending, setAutoNewTablePending] = useState(
    () => new URLSearchParams(window.location.search).get('newTable') === '1',
  );

  const handleGameStateChange = useCallback((next: GameState) => {
    setGameState(next);
  }, []);

  const { connected, dispatchAction, isOnline, actionInFlight } = useOnlineTable(
    activeTableId,
    handleGameStateChange,
    tableVersion,
  );

  useEffect(() => {
    if (!onlineMode || !user) {
      setProfileSetupOpen(false);
      return;
    }
    syncAuthEmailToProfile(user.email);
    setProfileSetupOpen(needsLocalProfileSetup(true, user.email));
  }, [onlineMode, user]);

  useEffect(() => {
    if (!onlineMode || !resolvedTableId) {
      return;
    }
    rememberPendingTable(resolvedTableId);
  }, [onlineMode, resolvedTableId]);

  useEffect(() => {
    if (!onlineMode || !resolvedTableId) {
      return;
    }
    setLoadingOnline(true);
    fetch(apiPath(`/api/tables/${resolvedTableId}`), { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Could not load table');
        }
        const data = (await res.json()) as { state: GameState; tableId: string; version: number };
        setGameState(data.state);
        setActiveTableId(data.tableId);
        setTableVersion(data.version);
        setStoredOnlineTableId(data.tableId);
        setInviteTableName(data.state.tableMeta.controllerName || null);
        setScreen('table');
      })
      .catch(() => {
        setStoredOnlineTableId(null);
        if (!getPendingTable()) {
          setScreen('start');
        }
      })
      .finally(() => setLoadingOnline(false));
  }, [onlineMode, resolvedTableId]);

  const handleNewOnlineGame = useCallback(async () => {
    const profile = loadProfile();
    const displayName = profile.name.trim() || user?.email.split('@')[0] || 'Host';
    const result = await createOnlineTable(displayName);
    setGameState({
      ...result.state,
      tableMeta: {
        ...result.state.tableMeta,
        showStakeSetup: true,
      },
    });
    setActiveTableId(result.tableId);
    setTableVersion(result.version);
    setStoredOnlineTableId(result.tableId);
    setScreen('table');
  }, [user?.email]);

  const handleNewGame = useCallback(() => {
    if (onlineMode) {
      void handleNewOnlineGame();
      return;
    }
    setGameState(createTableWithSettings());
    setScreen('table');
  }, [handleNewOnlineGame, onlineMode]);

  useEffect(() => {
    if (!autoNewTablePending || resolvedTableId || loadingOnline) {
      return;
    }
    window.history.replaceState({}, '', '/');
    setAutoNewTablePending(false);
    const canCreate = !onlineMode || (user?.canOwnTables ?? true);
    if (canCreate) {
      handleNewGame();
    }
  }, [autoNewTablePending, resolvedTableId, loadingOnline, handleNewGame, onlineMode, user?.canOwnTables]);

  function handleLeaveTable() {
    setGameState(null);
    setActiveTableId(null);
    setTableVersion(null);
    setStoredOnlineTableId(null);
    setTableNavHandlers(null);
    consumePendingTable();
    setScreen('start');
  }

  async function handleLogout() {
    await logout();
    window.location.assign('/login');
  }

  if (loadingOnline) {
    return (
      <main className="start-screen">
        <p>Loading table…</p>
      </main>
    );
  }

  const showOnlineProfileSetup =
    onlineMode && user && profileSetupOpen && (screen === 'table' || Boolean(resolvedTableId));

  const profile = loadProfile();
  const personalName =
    user?.displayName ?? user?.email ?? (profile.name.trim() || 'Player');
  const roleLabel = formatRoleLabel(user?.role);
  const showPersonalNav = screen === 'table' || screen === 'start';
  const canOwnTables = user?.canOwnTables ?? !onlineMode;
  const onTableScreen = screen === 'table' && Boolean(gameState);

  function handleStartNewTable() {
    if (onTableScreen && tableNavHandlers) {
      tableNavHandlers.startNewTable();
      return;
    }
    handleNewGame();
  }

  function handleLoadTable() {
    if (onTableScreen && tableNavHandlers) {
      tableNavHandlers.loadTable();
      return;
    }
    window.alert('Open a table first, then use Load Table.');
  }

  return (
    <>
      {gameState && <ThemeSync templateId={gameState.designTemplateId} />}
      {showOnlineProfileSetup && user && (
        <LocalProfileSetup
          open
          required
          lockedEmail={user.email}
          inviteTableName={inviteTableName}
          onClose={() => {}}
          onSaved={() => setProfileSetupOpen(false)}
        />
      )}
      {!showOnlineProfileSetup && profileOpen && (
        <LocalProfileSetup
          open
          required={!onlineMode && !profile.name.trim()}
          lockedEmail={onlineMode ? user?.email : undefined}
          onClose={() => setProfileOpen(false)}
          onSaved={() => setProfileOpen(false)}
        />
      )}
      <ScoreLedgerModal open={scoreLedgerOpen} onClose={() => setScoreLedgerOpen(false)} />
      {showPersonalNav && (
        <header className="personal-nav">
          <div className="personal-nav__identity">
            <span className="personal-nav__user">{personalName}</span>
            {onlineMode && user && (
              <span className="personal-nav__role">{roleLabel}</span>
            )}
            {!onlineMode && <span className="personal-nav__role">local</span>}
          </div>
          <div className="personal-nav__actions">
            <button type="button" className="secondary" onClick={() => setScoreLedgerOpen(true)}>
              Score Ledger
            </button>
            <button type="button" className="secondary" onClick={() => setProfileOpen(true)}>
              Profile
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleStartNewTable}
              disabled={onlineMode && !canOwnTables}
            >
              Start New Table
            </button>
            <button type="button" className="secondary" onClick={handleLoadTable}>
              Load Table
            </button>
            {onlineMode && isPeopleAdmin(user) && (
              <button type="button" className="secondary" onClick={() => setScreen('people')}>
                People
              </button>
            )}
            {onTableScreen && tableNavHandlers && (
              <button type="button" className="secondary" onClick={() => tableNavHandlers.openAdmin()}>
                Admin
              </button>
            )}
            {onTableScreen && (
              <button type="button" className="secondary" onClick={handleLeaveTable}>
                Leave table
              </button>
            )}
            {onlineMode && user && (
              <>
                {isOnline && (
                  <span className={connected ? 'personal-nav__live personal-nav__live--ok' : 'personal-nav__live'}>
                    {connected ? 'Live' : 'Reconnecting…'}
                  </span>
                )}
                <button type="button" className="secondary" onClick={() => void handleLogout()}>
                  Sign out
                </button>
              </>
            )}
          </div>
        </header>
      )}
      {screen === 'start' && !resolvedTableId && (
        <StartScreen
          onNewGame={handleNewGame}
          onlineMode={onlineMode}
          canOwnTables={canOwnTables}
          showPeopleAdmin={isPeopleAdmin(user)}
          onOpenPeople={() => setScreen('people')}
        />
      )}
      {screen === 'people' && isPeopleAdmin(user) && (
        <PeopleScreen onBack={() => setScreen('start')} />
      )}
      {screen === 'setup' && (
        <GameSetupScreen
          gameState={gameState}
          onGameStateChange={handleGameStateChange}
          onStart={() => setScreen('table')}
          onBack={() => {
            setGameState(null);
            setScreen('start');
          }}
        />
      )}
      {screen === 'table' && gameState && (
        <TableScreen
          gameState={gameState}
          onGameStateChange={handleGameStateChange}
          onLeave={handleLeaveTable}
          onlineTableId={isOnline ? activeTableId : null}
          onlineDispatch={isOnline ? dispatchAction : undefined}
          onlineActionInFlight={actionInFlight}
          profileOpen={profileOpen}
          onProfileOpenChange={setProfileOpen}
          onRegisterNavHandlers={setTableNavHandlers}
        />
      )}
    </>
  );
}
