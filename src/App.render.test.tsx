// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import App from './App';
import { TableNotFoundError } from './api/client';
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

const rootUser = {
  userId: 'user-1',
  email: 'root@example.com',
  displayName: 'Root',
  canOwnTables: true,
  isRoot: true,
};

describe('App render (hooks order / online bootstrap)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    createOnlineTableMock.mockClear();
    fetchTableMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recovers from 404 with auto new table (not blank)', async () => {
    localStorage.setItem(ONLINE_TABLE_STORAGE_KEY, VALID_TABLE);
    render(<App user={rootUser} onlineMode onlineTableId={VALID_TABLE} />);
    await waitFor(() => {
      expect(createOnlineTableMock).toHaveBeenCalled();
      expect(localStorage.getItem(ONLINE_TABLE_STORAGE_KEY)).toBe(
        '11111111-1111-4111-8111-111111111111',
      );
    });
  });

  it('ignores stale localStorage table id without crashing', async () => {
    localStorage.setItem(ONLINE_TABLE_STORAGE_KEY, 'stale-not-uuid');
    expect(() =>
      render(<App user={rootUser} onlineMode onlineTableId={null} forceNewTable={false} />),
    ).not.toThrow();
  });
});
