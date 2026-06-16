// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { resetOnlineSocketForTests } from './hooks/onlineSocket';
import { ONLINE_TABLE_STORAGE_KEY } from './onlineTableStorage';
import { TableMembershipError } from './api/client';

const TABLE_ID = '60232d60-9604-4fd5-8672-f51713669ee3';

const guestUser = {
  userId: 'guest-1',
  email: 'guest@example.com',
  displayName: 'Guest',
  canOwnTables: false,
  canPlay: true,
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
  loadProfile: () => ({ name: 'Guest', email: 'guest@example.com' }),
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

const { fetchTableMock } = vi.hoisted(() => ({
  fetchTableMock: vi.fn(async () => {
    throw new TableMembershipError(TABLE_ID);
  }),
}));

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>();
  return {
    ...actual,
    fetchTable: fetchTableMock,
    logout: vi.fn(),
  };
});

describe('online table membership recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', `/?table=${TABLE_ID}`);
    localStorage.setItem(ONLINE_TABLE_STORAGE_KEY, TABLE_ID);
    fetchTableMock.mockClear();
  });

  afterEach(() => {
    resetOnlineSocketForTests();
    vi.unstubAllGlobals();
  });

  it('clears stale table id and shows lobby prompt when user is not a member', async () => {
    render(<App user={guestUser} onlineMode bootTableId={TABLE_ID} />);

    await waitFor(() => {
      expect(fetchTableMock).toHaveBeenCalledWith(TABLE_ID);
    });

    await waitFor(() => {
      expect(localStorage.getItem(ONLINE_TABLE_STORAGE_KEY)).toBeNull();
    });

    expect(screen.getByText(/not seated at this online table/i)).toBeTruthy();
  });
});
