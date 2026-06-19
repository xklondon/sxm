import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from './types';
import {
  applyTableStakeSetup,
  createNewBlackjackTable,
  normalizeLoadedGameState,
} from './engine/session';
import type { InvitedTablePlayerSetup } from './features/messaging/tableMessagingTypes';
import type { TableStakeSetupInput } from './engine/session/tableSetup';
import { applySettingsToGameState, loadSettings } from './storage/settingsStorage';
import { loadArchivedGame } from './storage/gameStorage';
import { applyTableVisualPrefs } from './types/tableFeltSkin';
import {
  loadProfile,
  needsLocalProfileSetup,
  syncAuthEmailToProfile,
} from './storage/profileStorage';
import { applyDesignTemplateToDocument } from './design/templates';
import { StartScreen } from './screens/StartScreen';
import { EntryLobbyScreen } from './screens/EntryLobbyScreen';
import type { LoadTableEntry } from './components/LoadTableList';
import { GameSetupScreen } from './screens/GameSetupScreen';
import { TableScreen, type TableNavHandlers } from './screens/TableScreen';
import { LeaveTableConfirmDialog } from './components/LeaveTableConfirmDialog';
import { shouldConfirmLeaveActiveTable } from './tableLeaveGuard';
import { LocalProfileSetup } from './components/LocalProfileSetup';
import { ScoreLedgerModal } from './components/LedgerModals';
import {
  createOnlineTable,
  fetchTable,
  invitePersonToTable,
  isPeopleAdmin,
  logout,
  sendTableAction,
  TableNotFoundError,
  TableMembershipError,
  type AuthUser,
} from './api/client';
import { createTableInvite } from './engine/table/invites';
import { ActiveTablesPanel } from './components/ActiveTablesPanel';
import { AuthFetchError, accessDeniedMessage, isHandledAuthRejection } from './auth/authErrors';
import { PeopleScreen } from './screens/PeopleScreen';
import { setStoredOnlineTableId, useOnlineTable } from './hooks/useOnlineMultiplayer';
import type { OnlineConnectionState } from './hooks/onlineSocket';
import { clearStaleOnlineTableContext } from './onlineTableRecovery';
import { resolveEffectiveOnlineTableId } from './onlineTableBootstrap';
import { useIsMobileViewport } from './hooks/useIsMobileViewport';
import { consumePendingTable, rememberPendingTable } from './session/pendingTable';
import { syncStoredViewerPersonId, applyOnlineTableBootstrap } from './components/viewerIdentity';
import './index.css';

type AppScreen = 'lobby' | 'start' | 'setup' | 'table' | 'people';

interface AppProps {
  user?: AuthUser | null;
  onlineMode?: boolean;
  bootTableId?: string | null;
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

export default function App({ user, onlineMode = false, bootTableId = null, forceNewTable = false }: AppProps) {
  const [dismissStoredTable, setDismissStoredTable] = useState(false);
  const [tableMissingNotice, setTableMissingNotice] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(() =>
    resolveEffectiveOnlineTableId(null, false, bootTableId),
  );
  const resolvedTableId = resolveEffectiveOnlineTableId(
    activeTableId,
    dismissStoredTable,
    bootTableId,
  );
  const initialScreen: AppScreen = resolvedTableId
    ? 'table'
    : onlineMode && user
      ? 'lobby'
      : 'start';
  const [screen, setScreen] = useState<AppScreen>(initialScreen);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loadingOnline, setLoadingOnline] = useState(Boolean(resolvedTableId));
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scoreLedgerOpen, setScoreLedgerOpen] = useState(false);
  const [inviteTableName, setInviteTableName] = useState<string | null>(null);
  const [tableVersion, setTableVersion] = useState<number | null>(null);
  const [tableNavHandlers, setTableNavHandlers] = useState<TableNavHandlers | null>(null);
  const [leaveTableConfirmOpen, setLeaveTableConfirmOpen] = useState(false);
  const pendingLeaveActionRef = useRef<(() => void) | null>(null);
  const [bootstrappingTable, setBootstrappingTable] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [activeTablesOpen, setActiveTablesOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const fetchGenerationRef = useRef(0);
  const recoverInFlightRef = useRef(false);
  const isMobileViewport = useIsMobileViewport();

  const handleGameStateChange = useCallback(
    (next: GameState) => {
      const normalized = normalizeLoadedGameState(next);
      const withVisualPrefs = applyTableVisualPrefs(normalized, loadSettings());
      setGameState(withVisualPrefs);
      if (onlineMode && activeTableId) {
        syncStoredViewerPersonId(activeTableId, withVisualPrefs, user);
      }
    },
    [onlineMode, activeTableId, user],
  );

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
      applyOnlineTableBootstrap({
        tableId: result.tableId,
        state: result.state,
        memberPersonId: result.memberPersonId,
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
      fetchGenerationRef.current += 1;

      const autoCreate =
        options?.autoCreate ??
        (Boolean(bootTableId) && userCanCreateOnlineTable(user));
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
      setScreen(onlineMode && user ? 'lobby' : 'start');
    },
    [user, handleNewOnlineGame, bootTableId, onlineMode],
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
        setGameState(normalizeLoadedGameState(data.state));
        applyOnlineTableBootstrap({
          tableId: data.tableId,
          state: normalizeLoadedGameState(data.state),
          memberPersonId: data.memberPersonId,
        });
        setActiveTableId(data.tableId);
        setTableVersion(data.version);
        setStoredOnlineTableId(data.tableId);
        rememberPendingTable(data.tableId);
        setDismissStoredTable(false);
        setInviteTableName(data.state.tableMeta.controllerName || null);
        setScreen('table');
      })
      .catch((err) => {
        if (fetchGenerationRef.current !== fetchGen) {
          return;
        }
        if (err instanceof TableNotFoundError) {
          recoverMissingOnlineTable({
            autoCreate: Boolean(bootTableId) && userCanCreateOnlineTable(user),
          });
          return;
        }
        if (err instanceof TableMembershipError) {
          clearStaleOnlineTableContext();
          setDismissStoredTable(true);
          setActiveTableId(null);
          setGameState(null);
          setTableVersion(null);
          setTableMissingNotice(
            'You are not seated at this online table. Open it from the lobby or use a fresh invite link.',
          );
          setScreen(onlineMode && user ? 'lobby' : 'start');
          return;
        }
        setStoredOnlineTableId(null);
        setDismissStoredTable(true);
        clearStaleOnlineTableContext();
        setActiveTableId(null);
        setGameState(null);
        setTableVersion(null);
        setTableMissingNotice(
          err instanceof Error ? err.message : 'Could not load table',
        );
        setScreen(onlineMode && user ? 'lobby' : 'start');
      })
      .finally(() => {
        if (fetchGenerationRef.current === fetchGen) {
          setLoadingOnline(false);
        }
      });
  }, [onlineMode, resolvedTableId, user, recoverMissingOnlineTable, bootTableId]);

  const enterOnlineTable = useCallback((tableId: string) => {
    setDismissStoredTable(false);
    setActiveTableId(tableId);
    setTableMissingNotice(null);
    setScreen('table');
  }, []);

  const handleLoadEntry = useCallback(
    (entry: LoadTableEntry) => {
      if (entry.source === 'local' && entry.savedGameId) {
        const state = loadArchivedGame(entry.savedGameId);
        if (!state) {
          window.alert('Saved game not found.');
          return;
        }
        setGameState(normalizeLoadedGameState(state));
        setScreen('table');
        return;
      }
      if (entry.tableId) {
        enterOnlineTable(entry.tableId);
      }
    },
    [enterOnlineTable],
  );

  const handleNewGame = useCallback(() => {
    if (onlineMode) {
      void handleNewOnlineGame();
      return;
    }
    setGameState(createTableWithSettings());
    setScreen('table');
  }, [handleNewOnlineGame, onlineMode]);

  const sendChallengeInvites = useCallback(async (tableId: string, input: TableStakeSetupInput) => {
    const players: InvitedTablePlayerSetup[] =
      input.invitedPlayers?.length
        ? input.invitedPlayers
        : (input.invitedEmails ?? []).map((email) => ({ email }));
    for (const player of players) {
      const displayName = player.email.split('@')[0] || 'Guest';
      await invitePersonToTable(
        tableId,
        player.email,
        displayName,
        undefined,
        player.inviteMessage,
      );
    }
  }, []);

  const handleConfirmNavNewTable = useCallback(
    async (input: TableStakeSetupInput) => {
      if (onlineMode) {
        const profile = loadProfile();
        const displayName = profile.name.trim() || user?.email.split('@')[0] || 'Host';
        const result = await createOnlineTable(displayName);
        consumePendingTable();
        const actionResult = await sendTableAction(
          result.tableId,
          'configureTable',
          input as unknown as Record<string, unknown>,
          result.version,
        );
        if (
          input.tableMode === 'challenge' &&
          ((input.invitedPlayers?.length ?? 0) > 0 || (input.invitedEmails?.length ?? 0) > 0)
        ) {
          await sendChallengeInvites(result.tableId, input);
        }
        const configured = normalizeLoadedGameState(actionResult.state);
        setGameState(configured);
        applyOnlineTableBootstrap({
          tableId: result.tableId,
          state: configured,
          memberPersonId: result.memberPersonId,
        });
        setActiveTableId(result.tableId);
        setTableVersion(actionResult.version);
        setStoredOnlineTableId(result.tableId);
        rememberPendingTable(result.tableId);
        setDismissStoredTable(false);
        setScreen('table');
        return;
      }
      let state = createTableWithSettings();
      state = applyTableStakeSetup(
        { ...state, tableMeta: { ...state.tableMeta, showStakeSetup: false } },
        input,
      );
      if (input.invitedPlayers?.length) {
        for (const player of input.invitedPlayers) {
          const inviteResult = createTableInvite(
            state,
            player.email.split('@')[0] || 'Guest',
            player.email,
            player.inviteMessage ?? '',
          );
          state = inviteResult.state;
        }
      } else if (input.invitedEmails?.length) {
        for (const email of input.invitedEmails) {
          const inviteResult = createTableInvite(state, email.split('@')[0] || 'Guest', email);
          state = inviteResult.state;
        }
      }
      setGameState(state);
      setScreen('table');
    },
    [onlineMode, user?.email, sendChallengeInvites],
  );

  useEffect(() => {
    if (!onlineMode || !forceNewTable) {
      return;
    }
    window.history.replaceState({}, '', '/');
    setScreen('lobby');
  }, [onlineMode, forceNewTable]);

  useEffect(() => {
    if (!shouldConfirmLeaveActiveTable(screen, gameState)) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [screen, gameState]);

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

  function exitTableScreen() {
    setGameState(null);
    setActiveTableId(null);
    setTableVersion(null);
    setStoredOnlineTableId(null);
    setTableNavHandlers(null);
    consumePendingTable();
    setDismissStoredTable(true);
    setScreen(onlineMode && user ? 'lobby' : 'start');
  }

  function requestLeaveTable(onConfirmed?: () => void) {
    pendingLeaveActionRef.current = onConfirmed ?? null;
    setLeaveTableConfirmOpen(true);
  }

  function requestNavigateAway(action: () => void) {
    if (shouldConfirmLeaveActiveTable(screen, gameState)) {
      requestLeaveTable(action);
      return;
    }
    action();
  }

  function handleCancelLeaveTable() {
    setLeaveTableConfirmOpen(false);
    pendingLeaveActionRef.current = null;
  }

  function handleLeaveTableWithoutSaving() {
    setLeaveTableConfirmOpen(false);
    const pending = pendingLeaveActionRef.current;
    pendingLeaveActionRef.current = null;
    if (pending) {
      pending();
      return;
    }
    exitTableScreen();
  }

  function handleSaveAndLeaveTable() {
    setLeaveTableConfirmOpen(false);
    if (tableNavHandlers) {
      tableNavHandlers.saveTable();
    }
    const pending = pendingLeaveActionRef.current;
    pendingLeaveActionRef.current = null;
    if (pending) {
      pending();
      return;
    }
    exitTableScreen();
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
              setScreen(onlineMode && user ? 'lobby' : 'start');
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
  const showPersonalNav = screen === 'table' || screen === 'start' || screen === 'lobby';
  const canOwnTables = user?.canOwnTables ?? !onlineMode;
  const onTableScreen = screen === 'table' && Boolean(gameState);

  function handleStartNewTable() {
    if (onTableScreen && tableNavHandlers) {
      tableNavHandlers.openNewTableSetup();
      return;
    }
    handleNewGame();
  }

  async function handleLoadTable() {
    if (onlineMode && activeTableId) {
      try {
        const data = await fetchTable(activeTableId);
        const normalized = normalizeLoadedGameState(data.state);
        applyOnlineTableBootstrap({
          tableId: data.tableId,
          state: normalized,
          memberPersonId: data.memberPersonId,
        });
        setGameState(normalized);
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
        viewerEmail={user?.email ?? loadProfile().email}
      />
      {onlineMode && user && (
        <ActiveTablesPanel
          open={activeTablesOpen}
          onClose={() => setActiveTablesOpen(false)}
          currentTableId={activeTableId}
          onOpenTable={(tableId) => {
            requestNavigateAway(() => {
              setDismissStoredTable(false);
              enterOnlineTable(tableId);
              setActiveTablesOpen(false);
            });
          }}
        />
      )}
      {showPersonalNav && (
        <header className={`personal-nav${isMobileViewport ? ' personal-nav--mobile' : ''} personal-nav--menu-only`}>
          <div className="personal-nav__identity">
            <span className="personal-nav__user">{personalName}</span>
            {onlineMode && user && (
              <span className="personal-nav__role">{roleLabel}</span>
            )}
            {!onlineMode && <span className="personal-nav__role">LOCAL</span>}
          </div>
          <div className="personal-nav__actions">
            <div className="personal-nav__menu" ref={navMenuRef}>
              <button
                type="button"
                className="secondary personal-nav__menu-btn"
                aria-expanded={navMenuOpen}
                aria-haspopup="menu"
                aria-label="App menu"
                onClick={() => setNavMenuOpen((open) => !open)}
              >
                Menu
              </button>
              {navMenuOpen && (
                <div className="personal-nav__menu-panel" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setNavMenuOpen(false);
                      setScoreLedgerOpen(true);
                    }}
                  >
                    Score Ledger
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setNavMenuOpen(false);
                      setProfileOpen(true);
                    }}
                  >
                    Profile
                  </button>
                  {onlineMode && user && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setNavMenuOpen(false);
                        setActiveTablesOpen(true);
                      }}
                    >
                      Active Tables
                    </button>
                  )}
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
                  {onlineMode && isPeopleAdmin(user) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setNavMenuOpen(false);
                        requestNavigateAway(() => {
                          exitTableScreen();
                          setScreen('people');
                        });
                      }}
                    >
                      People
                    </button>
                  )}
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
                        requestLeaveTable();
                      }}
                    >
                      Leave table
                    </button>
                  )}
                  {onlineMode && user && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setNavMenuOpen(false);
                        requestNavigateAway(() => void handleLogout());
                      }}
                    >
                      Sign out
                    </button>
                  )}
                </div>
              )}
            </div>
            {onlineMode &&
              isOnline &&
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
          </div>
        </header>
      )}
      {screen === 'lobby' && (
        <EntryLobbyScreen
          onConfirmNewTable={handleConfirmNavNewTable}
          onOpenTable={enterOnlineTable}
          onLoadEntry={handleLoadEntry}
          onlineMode={onlineMode}
          canOwnTables={canOwnTables}
          showPeopleAdmin={isPeopleAdmin(user)}
          onOpenPeople={() => setScreen('people')}
        />
      )}
      {screen === 'start' && !onlineMode && (
        <StartScreen
          onNewGame={handleNewGame}
          onlineMode={onlineMode}
          canOwnTables={canOwnTables}
          showPeopleAdmin={isPeopleAdmin(user)}
          onOpenPeople={() => setScreen('people')}
        />
      )}
      {screen === 'people' && isPeopleAdmin(user) && (
        <PeopleScreen
          onBack={() =>
            requestNavigateAway(() => {
              exitTableScreen();
              setScreen(onlineMode && user ? 'lobby' : 'start');
            })
          }
        />
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
          onLeave={requestLeaveTable}
          onlineTableId={isOnline ? activeTableId : null}
          viewerAuth={user}
          onlineDispatch={isOnline ? dispatchAction : undefined}
          onlineActionInFlight={actionInFlight}
          profileOpen={profileOpen}
          onProfileOpenChange={setProfileOpen}
          onRegisterNavHandlers={setTableNavHandlers}
          onConfirmNavNewTable={handleConfirmNavNewTable}
        />
      )}
      <LeaveTableConfirmDialog
        open={leaveTableConfirmOpen}
        onSaveAndLeave={handleSaveAndLeaveTable}
        onLeaveWithoutSaving={handleLeaveTableWithoutSaving}
        onCancel={handleCancelLeaveTable}
      />
    </>
  );
}
