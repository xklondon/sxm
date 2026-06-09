// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { resetOnlineSocketForTests } from './hooks/onlineSocket';
import { ONLINE_TABLE_STORAGE_KEY } from './onlineTableStorage';
import { TableNotFoundError } from './api/client';

const STALE_TABLE = '60232d60-9604-4fd5-8672-f51713669ee3';

const rootUser = {
  userId: 'user-1',
  email: 'root@example.com',
  displayName: 'Root',
  canOwnTables: true,
  isRoot: true,
};

vi.mock('./api/config', () => ({
  isOnlineModeEnabled: () => true,
  apiPath: (path: string) => path,
  getSocketBaseUrl: () => 'http://127.0.0.1:3017',
}));

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
    connected: false,
    active: true,
    io: { on: vi.fn(), removeAllListeners: vi.fn() },
  }),
}));

vi.mock('./storage/settingsStorage', () => ({
  loadSettings: () => ({}),
}));

vi.mock('./storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Root', email: 'root@example.com' }),
  needsLocalProfileSetup: () => false,
  syncAuthEmailToProfile: vi.fn(),
}));

vi.mock('./design/templates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./design/templates')>();
  return {
    ...actual,
    applyDesignTemplateToDocument: vi.fn(),
  };
});

const { createOnlineTableMock, fetchTableMock } = vi.hoisted(() => ({
  createOnlineTableMock: vi.fn(async () => {
    const { createNewBlackjackTable } = await import('./engine/session');
    return {
      tableId: '11111111-1111-4111-8111-111111111111',
      version: 1,
      state: createNewBlackjackTable(),
    };
  }),
  fetchTableMock: vi.fn(async (tableId: string) => {
    throw new TableNotFoundError(tableId);
  }),
}));

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>();
  return {
    ...actual,
    createOnlineTable: createOnlineTableMock,
    fetchTable: fetchTableMock,
    logout: vi.fn(),
  };
});

describe('stale localStorage table id (GET /api/tables/:id 404)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', `/?table=${STALE_TABLE}`);
    localStorage.setItem(ONLINE_TABLE_STORAGE_KEY, STALE_TABLE);
    createOnlineTableMock.mockClear();
    fetchTableMock.mockClear();
  });

  afterEach(() => {
    resetOnlineSocketForTests();
    vi.unstubAllGlobals();
  });

  it('clears stored id and auto-opens new table for owner (no blank screen)', async () => {
    render(<App user={rootUser} onlineMode bootTableId={STALE_TABLE} />);

    await waitFor(() => {
      expect(fetchTableMock).toHaveBeenCalledWith(STALE_TABLE);
    });

    await waitFor(() => {
      expect(localStorage.getItem(ONLINE_TABLE_STORAGE_KEY)).toBe(
        '11111111-1111-4111-8111-111111111111',
      );
    });

    expect(createOnlineTableMock).toHaveBeenCalled();
    expect(screen.queryByText(/no longer on the server/i)).toBeNull();
  });

  it('shows CTA for guest without create permission', async () => {
    const guest = {
      userId: 'g1',
      email: 'guest@example.com',
      canOwnTables: false,
      canPlay: true,
    };
    render(<App user={guest} onlineMode bootTableId={STALE_TABLE} />);

    await waitFor(() => {
      expect(
        screen.getByText(/no longer on the server|Table not found|new invite/i),
      ).toBeTruthy();
    });
    expect(localStorage.getItem(ONLINE_TABLE_STORAGE_KEY)).toBeNull();
    expect(createOnlineTableMock).not.toHaveBeenCalled();
    expect(screen.getByText(/no longer on the server/i)).toBeTruthy();
  });
});
