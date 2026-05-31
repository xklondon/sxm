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
import { TableScreen } from './screens/TableScreen';
import { LocalProfileSetup } from './components/LocalProfileSetup';
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

export default function App({ user, onlineMode = false, onlineTableId = null }: AppProps) {
  const tableFromUrl = onlineTableId;
  const pendingTable = getPendingTable();
  const resolvedTableId = tableFromUrl ?? pendingTable;
  const [screen, setScreen] = useState<AppScreen>(resolvedTableId ? 'table' : 'start');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(resolvedTableId);
  const [loadingOnline, setLoadingOnline] = useState(Boolean(resolvedTableId));
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const [inviteTableName, setInviteTableName] = useState<string | null>(null);
  const [tableVersion, setTableVersion] = useState<number | null>(null);

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

  async function handleNewOnlineGame() {
    const profile = loadProfile();
    const displayName = profile.name.trim() || user?.email.split('@')[0] || 'Host';
    const result = await createOnlineTable(displayName);
    setGameState(result.state);
    setActiveTableId(result.tableId);
    setTableVersion(result.version);
    setStoredOnlineTableId(result.tableId);
    setScreen('table');
  }

  function handleNewGame() {
    if (onlineMode) {
      void handleNewOnlineGame();
      return;
    }
    setGameState(createTableWithSettings());
    setScreen('table');
  }

  function handleLeaveTable() {
    setGameState(null);
    setActiveTableId(null);
    setTableVersion(null);
    setStoredOnlineTableId(null);
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

  return (
    <>
      {gameState && <ThemeSync templateId={gameState.designTemplateId} />}
      {showOnlineProfileSetup && (
        <LocalProfileSetup
          open
          required
          lockedEmail={user.email}
          inviteTableName={inviteTableName}
          onClose={() => {}}
          onSaved={() => setProfileSetupOpen(false)}
        />
      )}
      {onlineMode && user && (
        <header className="online-bar">
          <span>{user.displayName ?? user.email}</span>
          {isPeopleAdmin(user) && (
            <button type="button" className="secondary" onClick={() => setScreen('people')}>
              People
            </button>
          )}
          {isOnline && (
            <span className={connected ? 'online-bar__ok' : 'online-bar__warn'}>
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
          )}
          <button type="button" className="secondary" onClick={() => void handleLogout()}>
            Sign out
          </button>
        </header>
      )}
      {screen === 'start' && !resolvedTableId && (
        <StartScreen
          onNewGame={handleNewGame}
          onlineMode={onlineMode}
          canOwnTables={user?.canOwnTables ?? !onlineMode}
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
        />
      )}
    </>
  );
}
