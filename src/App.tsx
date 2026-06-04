import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  createOnlineTable,
  fetchTable,
  isPeopleAdmin,
  logout,
  TableNotFoundError,
  type AuthUser,
} from './api/client';
import { AuthFetchError, accessDeniedMessage, isHandledAuthRejection } from './auth/authErrors';
import { PeopleScreen } from './screens/PeopleScreen';
import { setStoredOnlineTableId, useOnlineTable } from './hooks/useOnlineMultiplayer';
import type { OnlineConnectionState } from './hooks/onlineSocket';
import { clearStaleOnlineTableContext } from './onlineTableRecovery';
import { resolveEffectiveOnlineTableId } from './onlineTableBootstrap';
import { useIsMobileViewport } from './hooks/useIsMobileViewport';
import { consumePendingTable, rememberPendingTable } from './session/pendingTable';
import './index.css';

type AppScreen = 'start' | 'setup' | 'table' | 'people';

interface AppProps {
  user?: AuthUser | null;
  onlineMode?: boolean;
  onlineTableId?: string | null;
  forceNewTable?: boolean;
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

function userCanCreateOnlineTable(user?: AuthUser | null): boolean {
  return (
    user?.canOwnTables === true ||
    user?.isRoot === true ||
    user?.role === 'root' ||
    user?.role === 'admin'
  );
}

function formatConnectionLabel(state: OnlineConnectionState): string {
  switch (state) {
    case 'connected':
      return 'Live';
    case 'connecting':
      return 'Connecting…';
    case 'reconnecting':
      return 'Connection lost — reconnecting';
    case 'polling':
      return 'Connection lost — syncing';
    case 'offline':
      return 'Connection lost — actions still work';
    default:
      return '';
  }
}

function formatRoleLabel(user?: AuthUser | null): string {
  if (user?.isRoot || user?.role === 'root' || user?.role === 'admin') {
    return 'ADMIN';
  }
  switch (user?.role) {
    case 'guest':
      return 'GUEST';
    default:
      return 'PLAYER';
  }
}

export default function App({ user, onlineMode = false, onlineTableId = null, forceNewTable = false }: AppProps) {
  const [dismissStoredTable, setDismissStoredTable] = useState(false);
  const [tableMissingNotice, setTableMissingNotice] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(() =>
    resolveEffectiveOnlineTableId(null, false, onlineTableId),
  );
  const resolvedTableId = resolveEffectiveOnlineTableId(
    activeTableId,
    dismissStoredTable,
    onlineTableId,
  );
  const [screen, setScreen] = useState<AppScreen>(resolvedTableId ? 'table' : 'start');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loadingOnline, setLoadingOnline] = useState(Boolean(resolvedTableId));
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scoreLedgerOpen, setScoreLedgerOpen] = useState(false);
  const [inviteTableName, setInviteTableName] = useState<string | null>(null);
  const [tableVersion, setTableVersion] = useState<number | null>(null);
  const [tableNavHandlers, setTableNavHandlers] = useState<TableNavHandlers | null>(null);
  const [tableBootstrapDone, setTableBootstrapDone] = useState(Boolean(resolvedTableId));
  const [bootstrappingTable, setBootstrappingTable] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const fetchGenerationRef = useRef(0);
  const autoCreateStartedRef = useRef(false);
  const recoverInFlightRef = useRef(false);
  const isMobileViewport = useIsMobileViewport();

  const handleGameStateChange = useCallback((next: GameState) => {
    setGameState(next);
  }, []);

  const { connected, connectionState, dispatchAction, isOnline, actionInFlight } = useOnlineTable(
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
    setProfileSetupOpen(needsLocalProfileSetup(true, user.email, user.displayName));
  }, [onlineMode, user]);

  useEffect(() => {
    if (!onlineMode || !resolvedTableId) {
      return;
    }
    rememberPendingTable(resolvedTableId);
  }, [onlineMode, resolvedTableId]);

  const handleNewOnlineGame = useCallback(async () => {
    setBootstrapError(null);
    setTableMissingNotice(null);
    const profile = loadProfile();
    const displayName = profile.name.trim() || user?.email.split('@')[0] || 'Host';
    try {
      const result = await createOnlineTable(displayName);
      consumePendingTable();
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
      rememberPendingTable(result.tableId);
      setDismissStoredTable(false);
      setScreen('table');
    } catch (err) {
      if (err instanceof AuthFetchError && err.status === 403) {
        setBootstrapError(accessDeniedMessage(err.code));
      } else if (isHandledAuthRejection(err)) {
        setBootstrapError(err instanceof Error ? err.message : 'Sign in required');
      } else {
        setBootstrapError(err instanceof Error ? err.message : 'Could not create table');
      }
      setScreen('start');
    }
  }, [user?.email]);

  const recoverMissingOnlineTable = useCallback(
    (options?: { notice?: string; autoCreate?: boolean }) => {
      if (recoverInFlightRef.current) {
        return;
      }
      recoverInFlightRef.current = true;
      clearStaleOnlineTableContext();
      setDismissStoredTable(true);
      setActiveTableId(null);
      setGameState(null);
      setTableVersion(null);
      setInviteTableName(null);
      setTableNavHandlers(null);
      setTableBootstrapDone(true);
      fetchGenerationRef.current += 1;

      const autoCreate = options?.autoCreate ?? userCanCreateOnlineTable(user);
      if (autoCreate) {
        setTableMissingNotice(null);
        setScreen('table');
        setBootstrappingTable(true);
        void handleNewOnlineGame().finally(() => {
          setBootstrappingTable(false);
          recoverInFlightRef.current = false;
        });
        return;
      }

      recoverInFlightRef.current = false;
      setTableMissingNotice(
        options?.notice ??
          'This table is no longer on the server (it may have been cleared after a restart). Ask the host for a new invite link.',
      );
      setScreen('start');
    },
    [user, handleNewOnlineGame],
  );

  useEffect(() => {
    if (!onlineMode || !resolvedTableId) {
      setLoadingOnline(false);
      return;
    }
    const fetchGen = fetchGenerationRef.current + 1;
    fetchGenerationRef.current = fetchGen;
    setLoadingOnline(true);
    setTableMissingNotice(null);
    fetchTable(resolvedTableId)
      .then((data) => {
        if (fetchGenerationRef.current !== fetchGen) {
          return;
        }
        setGameState(data.state);
        setActiveTableId(data.tableId);
        setTableVersion(data.version);
        setStoredOnlineTableId(data.tableId);
        rememberPendingTable(data.tableId);
        setDismissStoredTable(false);
        setInviteTableName(data.state.tableMeta.controllerName || null);
        setScreen('table');
        setTableBootstrapDone(true);
      })
      .catch((err) => {
        if (fetchGenerationRef.current !== fetchGen) {
          return;
        }
        if (err instanceof TableNotFoundError) {
          recoverMissingOnlineTable({ autoCreate: userCanCreateOnlineTable(user) });
          return;
        }
        setStoredOnlineTableId(null);
        setDismissStoredTable(true);
        clearStaleOnlineTableContext();
        setActiveTableId(null);
        setGameState(null);
        setTableVersion(null);
        setTableBootstrapDone(false);
        autoCreateStartedRef.current = false;
        setTableMissingNotice(
          err instanceof Error ? err.message : 'Could not load table',
        );
        setScreen('start');
      })
      .finally(() => {
        if (fetchGenerationRef.current === fetchGen) {
          setLoadingOnline(false);
        }
      });
  }, [onlineMode, resolvedTableId, user, recoverMissingOnlineTable]);

  const handleNewGame = useCallback(() => {
    if (onlineMode) {
      void handleNewOnlineGame();
      return;
    }
    setGameState(createTableWithSettings());
    setScreen('table');
  }, [handleNewOnlineGame, onlineMode]);

  useEffect(() => {
    if (!onlineMode || !user || resolvedTableId || loadingOnline || tableBootstrapDone) {
      return;
    }
    if (autoCreateStartedRef.current) {
      return;
    }
    autoCreateStartedRef.current = true;
    setTableBootstrapDone(true);
    if (forceNewTable) {
      window.history.replaceState({}, '', '/');
    }
    const canCreate = user.canOwnTables ?? true;
    if (!canCreate) {
      setScreen('start');
      return;
    }
    setScreen('table');
    setBootstrappingTable(true);
    void handleNewOnlineGame().finally(() => setBootstrappingTable(false));
  }, [
    onlineMode,
    user,
    resolvedTableId,
    loadingOnline,
    tableBootstrapDone,
    forceNewTable,
    handleNewOnlineGame,
  ]);

  useEffect(() => {
    if (!navMenuOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (!navMenuRef.current?.contains(event.target as Node)) {
        setNavMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [navMenuOpen]);

  function handleLeaveTable() {
    setGameState(null);
    setActiveTableId(null);
    setTableVersion(null);
    setStoredOnlineTableId(null);
    setTableNavHandlers(null);
    consumePendingTable();
    setTableBootstrapDone(false);
    setScreen('start');
  }

  async function handleLogout() {
    await logout();
    window.location.assign('/login');
  }

  if (bootstrapError) {
    return (
      <main className="start-screen">
        <p>{bootstrapError}</p>
        <button type="button" onClick={() => window.location.assign('/login')}>
          Back to sign in
        </button>
      </main>
    );
  }

  const bootstrapBusy = loadingOnline || bootstrappingTable;

  if (bootstrapBusy) {
    return (
      <main className="start-screen">
        <p>{bootstrappingTable ? 'Opening new table…' : 'Loading table…'}</p>
      </main>
    );
  }

  if (tableMissingNotice) {
    return (
      <main className="start-screen">
        <p>{tableMissingNotice}</p>
        <div className="start-screen__actions" style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          {userCanCreateOnlineTable(user) && (
            <button type="button" onClick={() => void handleNewOnlineGame()}>
              Start new table
            </button>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setTableMissingNotice(null);
              setScreen('start');
            }}
          >
            Back
          </button>
        </div>
      </main>
    );
  }

  const showOnlineProfileSetup =
    onlineMode && user && profileSetupOpen && (screen === 'table' || Boolean(resolvedTableId));

  const profile = loadProfile();
  const personalName =
    user?.displayName ?? user?.email ?? (profile.name.trim() || 'Player');
  const roleLabel = formatRoleLabel(user);
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

  async function handleLoadTable() {
    if (onlineMode && activeTableId) {
      try {
        const data = await fetchTable(activeTableId);
        setGameState(data.state);
        setTableVersion(data.version);
        setStoredOnlineTableId(data.tableId);
        setScreen('table');
      } catch (err) {
        if (err instanceof TableNotFoundError) {
          recoverMissingOnlineTable({
            autoCreate: userCanCreateOnlineTable(user),
            notice: 'Table not found — start a new table or ask the host for a new invite.',
          });
          return;
        }
        window.alert(err instanceof Error ? err.message : 'Could not load table');
      }
      return;
    }
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
      <ScoreLedgerModal
        open={scoreLedgerOpen}
        onClose={() => setScoreLedgerOpen(false)}
        activeTableId={gameState?.session.id ?? activeTableId}
        gameStatus={gameState?.tableMeta.gameStatus}
      />
      {showPersonalNav && (
        <header className={`personal-nav${isMobileViewport ? ' personal-nav--mobile' : ''}`}>
          <div className="personal-nav__identity">
            <span className="personal-nav__user">{personalName}</span>
            {onlineMode && user && (
              <span className="personal-nav__role">{roleLabel}</span>
            )}
            {!onlineMode && <span className="personal-nav__role">LOCAL</span>}
          </div>
          <div className="personal-nav__actions">
            <button type="button" className="secondary" onClick={() => setScoreLedgerOpen(true)}>
              Score Ledger
            </button>
            <button type="button" className="secondary" onClick={() => setProfileOpen(true)}>
              Profile
            </button>
            {isMobileViewport ? (
              <>
                {onlineMode && user && (
                  <button type="button" className="secondary" onClick={() => void handleLogout()}>
                    Sign out
                  </button>
                )}
                <div className="personal-nav__menu" ref={navMenuRef}>
                  <button
                    type="button"
                    className="secondary personal-nav__menu-btn"
                    aria-expanded={navMenuOpen}
                    aria-haspopup="menu"
                    aria-label="More actions"
                    onClick={() => setNavMenuOpen((open) => !open)}
                  >
                    ⋯
                  </button>
                  {navMenuOpen && (
                    <div className="personal-nav__menu-panel" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setNavMenuOpen(false);
                          handleStartNewTable();
                        }}
                        disabled={onlineMode && !canOwnTables}
                      >
                        Start New Table
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setNavMenuOpen(false);
                          handleLoadTable();
                        }}
                      >
                        Load Table
                      </button>
                      {onTableScreen && tableNavHandlers && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setNavMenuOpen(false);
                            tableNavHandlers.openAdmin();
                          }}
                        >
                          Admin
                        </button>
                      )}
                      {onTableScreen && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setNavMenuOpen(false);
                            handleLeaveTable();
                          }}
                        >
                          Leave table
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
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
                    {isOnline &&
                      activeTableId &&
                      gameState &&
                      connectionState !== 'idle' &&
                      connectionState !== 'connecting' && (
                      <span
                        className={
                          connected ? 'personal-nav__live personal-nav__live--ok' : 'personal-nav__live'
                        }
                      >
                        {formatConnectionLabel(connectionState)}
                      </span>
                    )}
                    <button type="button" className="secondary" onClick={() => void handleLogout()}>
                      Sign out
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </header>
      )}
      {screen === 'start' &&
        !resolvedTableId &&
        !(onlineMode && user && userCanCreateOnlineTable(user) && !tableMissingNotice) && (
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
