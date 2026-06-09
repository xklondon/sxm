// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { ONLINE_TABLE_STORAGE_KEY } from './onlineTableStorage';

const VALID_TABLE = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

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
  loadProfile: () => ({ name: 'Tester', email: '' }),
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
  createOnlineTableMock: vi.fn(),
  fetchTableMock: vi.fn(),
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

const rootUser = {
  userId: 'user-1',
  email: 'root@example.com',
  displayName: 'Root',
  canOwnTables: true,
  isRoot: true,
};

describe('entry lobby boot flow', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    createOnlineTableMock.mockClear();
    fetchTableMock.mockClear();
  });

  it('shows Entry Lobby when stored table id exists but no URL table param', async () => {
    localStorage.setItem(ONLINE_TABLE_STORAGE_KEY, VALID_TABLE);
    render(<App user={rootUser} onlineMode bootTableId={null} />);
    await waitFor(() => {
      expect(screen.getByText('Open New Table')).toBeTruthy();
      expect(screen.getByText('Join a Table')).toBeTruthy();
      expect(screen.getByText('Load a Table')).toBeTruthy();
    });
    expect(fetchTableMock).not.toHaveBeenCalled();
    expect(createOnlineTableMock).not.toHaveBeenCalled();
  });

  it('loads table when bootTableId comes from invite URL param', async () => {
    const { createNewBlackjackTable } = await import('./engine/session');
    fetchTableMock.mockResolvedValue({
      tableId: VALID_TABLE,
      version: 1,
      state: createNewBlackjackTable(),
      memberPersonId: 'p1',
    });
    render(<App user={rootUser} onlineMode bootTableId={VALID_TABLE} />);
    await waitFor(() => {
      expect(fetchTableMock).toHaveBeenCalledWith(VALID_TABLE);
    });
  });
});
