// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('./design/templates', () => ({
  applyDesignTemplateToDocument: vi.fn(),
}));

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
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not crash when online table load finishes (loading → idle)', async () => {
    localStorage.setItem(ONLINE_TABLE_STORAGE_KEY, VALID_TABLE);
    expect(() =>
      render(<App user={rootUser} onlineMode onlineTableId={VALID_TABLE} />),
    ).not.toThrow();
    await waitFor(() => {
      expect(screen.getByText(/Loading table|New online table|Opening new table/i)).toBeTruthy();
    });
  });

  it('ignores stale localStorage table id without crashing', async () => {
    localStorage.setItem(ONLINE_TABLE_STORAGE_KEY, 'stale-not-uuid');
    expect(() =>
      render(<App user={rootUser} onlineMode onlineTableId={null} forceNewTable={false} />),
    ).not.toThrow();
  });
});
