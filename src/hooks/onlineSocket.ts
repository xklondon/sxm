import { io, type Socket } from 'socket.io-client';

import type { GameState } from '../types';

import { getSocketBaseUrl } from '../api/config';

export type OnlineConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'polling'
  | 'offline';

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 1000;
const RECONNECT_DELAY_MAX_MS = 20_000;
const POLL_INTERVAL_MS = 15_000;

export interface OnlineSocketHandlers {
  tableId: string;
  onTableUpdate: (payload: { tableId: string; state: GameState; version: number }) => void;
  onConnectionState: (state: OnlineConnectionState) => void;
  pollTable: () => Promise<void>;
}

let socket: Socket | null = null;
let subscribedTableId: string | null = null;
let refCount = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let activeHandlers: OnlineSocketHandlers | null = null;
let hasConnectedBefore = false;

function notifyState(state: OnlineConnectionState) {
  activeHandlers?.onConnectionState(state);
}

function clearPollTimer() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPollingFallback() {
  if (!activeHandlers) {
    return;
  }
  clearPollTimer();
  notifyState('polling');
  void activeHandlers.pollTable().catch(() => {});
  pollTimer = setInterval(() => {
    void activeHandlers?.pollTable().catch(() => {});
  }, POLL_INTERVAL_MS);
}

function subscribeTable(tableId: string) {
  if (!socket?.connected) {
    return;
  }
  if (subscribedTableId && subscribedTableId !== tableId) {
    socket.emit('table:unsubscribe', subscribedTableId);
  }
  subscribedTableId = tableId;
  socket.emit('table:subscribe', tableId);
}

function teardownSocket() {
  clearPollTimer();
  if (socket) {
    socket.removeAllListeners();
    socket.io?.removeAllListeners?.();
    socket.disconnect();
    socket = null;
  }
  subscribedTableId = null;
  activeHandlers = null;
  hasConnectedBefore = false;
}

function ensureSocket(): Socket {
  if (socket) {
    return socket;
  }

  notifyState('connecting');

  socket = io(getSocketBaseUrl(), {
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: RECONNECT_DELAY_MS,
    reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
    timeout: 20_000,
  });

  socket.on('connect', () => {
    clearPollTimer();
    notifyState('connected');
    if (activeHandlers) {
      subscribeTable(activeHandlers.tableId);
      if (hasConnectedBefore) {
        // Broadcasts missed while disconnected are never replayed — re-sync
        // once. The client version guard drops it if nothing changed.
        void activeHandlers.pollTable().catch(() => {});
      }
    }
    hasConnectedBefore = true;
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io client disconnect') {
      notifyState('idle');
      return;
    }
    notifyState('reconnecting');
  });

  socket.on('connect_error', () => {
    if (socket?.active) {
      notifyState('reconnecting');
    }
  });

  if (socket.io) {
    socket.io.on('reconnect_attempt', () => {
      notifyState('reconnecting');
    });

    socket.io.on('reconnect_failed', () => {
      startPollingFallback();
    });
  }

  socket.on('table:update', (payload: { tableId: string; state: GameState; version: number }) => {
    activeHandlers?.onTableUpdate(payload);
  });

  return socket;
}

/**
 * Single shared Socket.IO connection per browser tab.
 * Ref-counted so React StrictMode and table switches do not leak sockets.
 */
export function acquireOnlineSocket(handlers: OnlineSocketHandlers): () => void {
  refCount += 1;
  activeHandlers = handlers;
  subscribedTableId = handlers.tableId;

  const s = ensureSocket();
  if (s.connected) {
    subscribeTable(handlers.tableId);
    notifyState('connected');
  }

  return () => {
    refCount = Math.max(0, refCount - 1);
    if (refCount > 0) {
      return;
    }
    notifyState('idle');
    teardownSocket();
  };
}

/** Test-only reset — clears module singleton between vitest cases. */
export function resetOnlineSocketForTests(): void {
  refCount = 0;
  teardownSocket();
}
