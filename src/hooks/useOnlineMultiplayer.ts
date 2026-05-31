import { useEffect, useRef, useState } from 'react';

import type { GameState } from '../types';

import { fetchMe, sendTableAction, type AuthUser } from '../api/client';

import { getApiBaseUrl, isOnlineModeEnabled } from '../api/config';

import { io, type Socket } from 'socket.io-client';



const ONLINE_TABLE_KEY = 'sxmcards:online-table-id';



export function getStoredOnlineTableId(): string | null {

  return sessionStorage.getItem(ONLINE_TABLE_KEY);

}



export function setStoredOnlineTableId(tableId: string | null): void {

  if (tableId) {

    sessionStorage.setItem(ONLINE_TABLE_KEY, tableId);

  } else {

    sessionStorage.removeItem(ONLINE_TABLE_KEY);

  }

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

  const [connected, setConnected] = useState(false);

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

    }

  }, [tableId]);



  useEffect(() => {

    if (!tableId || !isOnlineModeEnabled()) {

      return;

    }

    const socket: Socket = io(getApiBaseUrl(), { withCredentials: true });

    socket.on('connect', () => {

      setConnected(true);

      socket.emit('table:subscribe', tableId);

    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('table:update', (payload: { state: GameState; version: number }) => {

      versionRef.current = payload.version;

      setVersion(payload.version);

      onGameStateChangeRef.current(payload.state);

    });

    return () => {

      socket.disconnect();

    };

  }, [tableId]);



  async function dispatchAction(type: string, payload: Record<string, unknown> = {}) {

    if (!tableId) {

      throw new Error('No online table');

    }

    if (actionInFlight) {

      throw new Error('Action already in progress');

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

    } finally {

      setActionInFlight(false);

    }

  }



  return {

    connected,

    version,

    dispatchAction,

    actionInFlight,

    isOnline: Boolean(tableId && isOnlineModeEnabled()),

  };

}


