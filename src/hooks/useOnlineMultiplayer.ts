import { useEffect, useRef, useState } from 'react';

import type { GameState } from '../types';

import { fetchMe, fetchTable, sendTableAction, TableMembershipError, type AuthUser } from '../api/client';
import { AuthFetchError } from '../auth/authErrors';
import { applyOnlineTableBootstrap } from '../components/viewerIdentity';

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

  /**
   * Monotonic version guard — mirrors the server's `expectedVersion` write
   * discipline on the read side. Socket broadcasts, poll responses, and HTTP
   * action responses arrive on independent connections with no cross-channel
   * ordering: a delayed older payload must never overwrite newer applied
   * state, and the actor's own broadcast must not re-apply the state its HTTP
   * response already delivered.
   */
  function applyServerState(nextVersion: number, state: GameState): boolean {
    if (versionRef.current !== null && nextVersion <= versionRef.current) {
      return false;
    }
    versionRef.current = nextVersion;
    setVersion(nextVersion);
    onGameStateChangeRef.current(state);
    return true;
  }

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
        if (payload.tableId !== tableId) {
          return;
        }
        applyServerState(payload.version, payload.state);
      },
      onConnectionState: setConnectionState,
      pollTable: async () => {
        const refreshed = await fetchTable(tableId);
        if (!applyServerState(refreshed.version, refreshed.state)) {
          return;
        }
        applyOnlineTableBootstrap({
          tableId: refreshed.tableId,
          state: refreshed.state,
          memberPersonId: refreshed.memberPersonId,
        });
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
      applyServerState(result.version, result.state);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (err instanceof TableMembershipError) {
        throw err;
      }
      if (/stale/i.test(message)) {
        try {
          const refreshed = await fetchTable(tableId);
          if (applyServerState(refreshed.version, refreshed.state)) {
            applyOnlineTableBootstrap({
              tableId: refreshed.tableId,
              state: refreshed.state,
              memberPersonId: refreshed.memberPersonId,
            });
          }
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
