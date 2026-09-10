// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { acquireOnlineSocket, resetOnlineSocketForTests } from './onlineSocket';

const mockSocket = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const ioHandlers = new Map<string, (...args: unknown[]) => void>();
  return {
    handlers,
    ioHandlers,
    connected: false,
    active: true,
    emit: vi.fn(),
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      handlers.set(event, fn);
    }),
    disconnect: vi.fn(() => {
      mockSocket.connected = false;
      handlers.get('disconnect')?.('io client disconnect');
    }),
    removeAllListeners: vi.fn(() => {
      handlers.clear();
      ioHandlers.clear();
    }),
    io: {
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        ioHandlers.set(event, fn);
      }),
      removeAllListeners: vi.fn(() => ioHandlers.clear()),
    },
    fireConnect() {
      mockSocket.connected = true;
      handlers.get('connect')?.();
    },
    fireDisconnect(reason = 'transport close') {
      mockSocket.connected = false;
      handlers.get('disconnect')?.(reason);
    },
    fireReconnectFailed() {
      ioHandlers.get('reconnect_failed')?.();
    },
  };
});

let ioCallCount = 0;

vi.mock('socket.io-client', () => ({
  io: () => {
    ioCallCount += 1;
    return mockSocket;
  },
}));

vi.mock('../api/config', () => ({
  getSocketBaseUrl: () => 'http://127.0.0.1:3017',
}));

describe('onlineSocket manager', () => {
  beforeEach(() => {
    ioCallCount = 0;
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.connected = false;
    resetOnlineSocketForTests();
  });

  afterEach(() => {
    resetOnlineSocketForTests();
  });

  it('creates only one socket for duplicate acquire (StrictMode-style)', () => {
    const states: string[] = [];
    const releaseA = acquireOnlineSocket({
      tableId: 'table-a',
      onTableUpdate: vi.fn(),
      onConnectionState: (s) => states.push(`a:${s}`),
      pollTable: vi.fn(async () => {}),
    });
    const releaseB = acquireOnlineSocket({
      tableId: 'table-a',
      onTableUpdate: vi.fn(),
      onConnectionState: (s) => states.push(`b:${s}`),
      pollTable: vi.fn(async () => {}),
    });

    expect(ioCallCount).toBe(1);

    releaseA();
    expect(mockSocket.disconnect).not.toHaveBeenCalled();

    releaseB();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(ioCallCount).toBe(1);
  });

  it('switches table subscription without a second socket', () => {
    const releaseA = acquireOnlineSocket({
      tableId: 'table-a',
      onTableUpdate: vi.fn(),
      onConnectionState: vi.fn(),
      pollTable: vi.fn(async () => {}),
    });
    releaseA();

    acquireOnlineSocket({
      tableId: 'table-b',
      onTableUpdate: vi.fn(),
      onConnectionState: vi.fn(),
      pollTable: vi.fn(async () => {}),
    });

    expect(ioCallCount).toBe(2);
    mockSocket.fireConnect();
    expect(mockSocket.emit).toHaveBeenCalledWith('table:subscribe', 'table-b');
  });

  it('enters polling fallback after reconnect_failed without throwing', async () => {
    const pollTable = vi.fn(async () => {});
    const states: string[] = [];

    acquireOnlineSocket({
      tableId: 'table-a',
      onTableUpdate: vi.fn(),
      onConnectionState: (s) => states.push(s),
      pollTable,
    });

    mockSocket.fireReconnectFailed();

    await vi.waitFor(() => {
      expect(states).toContain('polling');
      expect(pollTable).toHaveBeenCalled();
    });
  });

  it('re-fetches table state once after a reconnect (not on first connect)', () => {
    const pollTable = vi.fn(async () => {});
    acquireOnlineSocket({
      tableId: 'table-a',
      onTableUpdate: vi.fn(),
      onConnectionState: vi.fn(),
      pollTable,
    });

    mockSocket.fireConnect();
    expect(pollTable).not.toHaveBeenCalled();

    mockSocket.fireDisconnect('transport close');
    mockSocket.fireConnect();
    expect(pollTable).toHaveBeenCalledTimes(1);
  });

  it('disconnect does not leave an unhandled rejection path', () => {
    acquireOnlineSocket({
      tableId: 'table-a',
      onTableUpdate: vi.fn(),
      onConnectionState: vi.fn(),
      pollTable: vi.fn(async () => {
        throw new Error('poll failed');
      }),
    });

    expect(() => mockSocket.fireDisconnect('transport close')).not.toThrow();
  });
});
