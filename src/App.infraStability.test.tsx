// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { createNewBlackjackTable } from './engine/session';
import { resetOnlineSocketForTests } from './hooks/onlineSocket';

const rootUser = {
  userId: 'user-1',
  email: 'root@example.com',
  displayName: 'Root',
  canOwnTables: true,
  isRoot: true,
};

const mockSocket = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    handlers,
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      handlers.set(event, fn);
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(() => handlers.clear()),
    io: { on: vi.fn(), removeAllListeners: vi.fn() },
    connected: false,
    active: true,
    fireDisconnect() {
      handlers.get('disconnect')?.('transport close');
    },
  };
});

vi.mock('./api/config', () => ({
  isOnlineModeEnabled: () => true,
  apiPath: (path: string) => path,
  getSocketBaseUrl: () => 'http://127.0.0.1:3017',
}));

vi.mock('socket.io-client', () => ({
  io: () => mockSocket,
}));

vi.mock('./storage/settingsStorage', () => ({
  loadSettings: () => ({}),
}));

vi.mock('./storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Root', email: 'root@example.com', initials: 'RO', playFlow: 'auto-18' }),
  needsLocalProfileSetup: () => false,
  syncAuthEmailToProfile: vi.fn(),
  getStoredViewerPersonIdForTable: () => null,
  setStoredViewerPersonIdForTable: vi.fn(),
}));

vi.mock('./design/templates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./design/templates')>();
  return { ...actual, applyDesignTemplateToDocument: vi.fn() };
});

const tableId = '22222222-2222-4222-8222-222222222222';

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>();
  return {
    ...actual,
    fetchTable: vi.fn(async () => ({
      tableId,
      version: 1,
      state: createNewBlackjackTable(),
    })),
    createOnlineTable: vi.fn(),
    logout: vi.fn(),
  };
});

describe('infra stability — socket disconnect', () => {
  beforeEach(() => {
    resetOnlineSocketForTests();
    mockSocket.handlers.clear();
    window.history.replaceState({}, '', `/?table=${tableId}`);
  });

  afterEach(() => {
    resetOnlineSocketForTests();
  });

  it('keeps table UI mounted when socket disconnects', async () => {
    render(<App user={rootUser} onlineMode onlineTableId={tableId} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'This Table' })).toBeTruthy();
    });

    mockSocket.fireDisconnect();

    await waitFor(() => {
      expect(screen.getByText(/Connection lost — reconnecting/i)).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'This Table' })).toBeTruthy();
  });
});
