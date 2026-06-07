import { useEffect, useRef, useState } from 'react';

import type { GameState } from '../types';

import { fetchMe, fetchTable, sendTableAction, type AuthUser } from '../api/client';
import { AuthFetchError } from '../auth/authErrors';

import { isOnlineModeEnabled } from '../api/config';

import {
  acquireOnlineSocket,
  type OnlineConnectionState,
} from './onlineSocket';

import {
  readStoredOnlineTableId,
  writeStoredOnlineTableId,
} from '../onlineTableStorage';

export function getStoredOnlineTableId(): string | null {
  return readStoredOnlineTableId();
}

export function setStoredOnlineTableId(tableId: string | null): void {
  writeStoredOnlineTableId(tableId);
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(isOnlineModeEnabled());

  useEffect(() => {
    if (!isOnlineModeEnabled()) {
      setLoading(false);
      return;
    }

    fetchMe()
      .then(setUser)
      .catch((err) => {
        setUser(null);
        if (err instanceof AuthFetchError) {
          return;
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, setUser, onlineMode: isOnlineModeEnabled() };
}

export function useOnlineTable(
  tableId: string | null,
  onGameStateChange: (state: GameState) => void,
  tableVersion: number | null = null,
) {
  const versionRef = useRef<number | null>(tableVersion);
  const [version, setVersion] = useState<number | null>(tableVersion);
  const [connectionState, setConnectionState] = useState<OnlineConnectionState>('idle');
  const [actionInFlight, setActionInFlight] = useState(false);
  const onGameStateChangeRef = useRef(onGameStateChange);
  onGameStateChangeRef.current = onGameStateChange;

  useEffect(() => {
    versionRef.current = tableVersion;
    setVersion(tableVersion);
  }, [tableId, tableVersion]);

  useEffect(() => {
    if (!tableId) {
      versionRef.current = null;
      setVersion(null);
      setConnectionState('idle');
    }
  }, [tableId]);

  useEffect(() => {
    if (!tableId || !isOnlineModeEnabled()) {
      setConnectionState('idle');
      return;
    }

    return acquireOnlineSocket({
      tableId,
      onTableUpdate: (payload) => {
        versionRef.current = payload.version;
        setVersion(payload.version);
        onGameStateChangeRef.current(payload.state);
      },
      onConnectionState: setConnectionState,
      pollTable: async () => {
        const refreshed = await fetchTable(tableId);
        versionRef.current = refreshed.version;
        setVersion(refreshed.version);
        onGameStateChangeRef.current(refreshed.state);
      },
    });
  }, [tableId]);

  async function dispatchAction(type: string, payload: Record<string, unknown> = {}) {
    if (!tableId) {
      throw new Error('No online table');
    }
    if (actionInFlight) {
      return null;
    }
    setActionInFlight(true);
    try {
      const result = await sendTableAction(
        tableId,
        type,
        payload,
        versionRef.current ?? undefined,
      );
      versionRef.current = result.version;
      setVersion(result.version);
      onGameStateChangeRef.current(result.state);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/stale/i.test(message)) {
        try {
          const refreshed = await fetchTable(tableId);
          versionRef.current = refreshed.version;
          setVersion(refreshed.version);
          onGameStateChangeRef.current(refreshed.state);
        } catch {
          // Ignore refetch failure; fall through to the retry message.
        }
        throw new Error('Table refreshed — try again');
      }
      throw err;
    } finally {
      setActionInFlight(false);
    }
  }

  return {
    connected: connectionState === 'connected',
    connectionState,
    version,
    dispatchAction,
    actionInFlight,
    isOnline: Boolean(tableId && isOnlineModeEnabled()),
  };
}
