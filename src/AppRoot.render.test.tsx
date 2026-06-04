// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppRoot } from './AppRoot';
import { ONLINE_TABLE_STORAGE_KEY } from './onlineTableStorage';

vi.mock('./debug/bootDiagnostics', () => ({
  BOOT_STAGES: { appRoot: 'app', authMe: 'auth' },
  markBootStage: vi.fn(),
  markBootSucceeded: vi.fn(),
}));

vi.mock('./api/config', () => ({
  isOnlineModeEnabled: () => true,
  apiPath: (path: string) => path,
}));

vi.mock('./debug/ClientConfigScreen', () => ({
  isClientConfigPath: () => false,
  ClientConfigScreen: () => <div>config</div>,
}));

describe('AppRoot render', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders unauthenticated after /api/auth/me 401 without crashing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/auth/me')) {
          return Response.json({ error: 'Authentication required' }, { status: 401 });
        }
        return Response.json({ error: 'not found' }, { status: 404 });
      }),
    );
    expect(() => render(<AppRoot />)).not.toThrow();
    await waitFor(() => {
      expect(
        screen.getByText(/Redirecting to sign in|Loading session|Sign in/i),
      ).toBeTruthy();
    });
  });

  it('renders authenticated root user without crashing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/auth/me')) {
          return Response.json({
            user: {
              userId: 'u1',
              email: 'root@example.com',
              displayName: 'Root',
              canOwnTables: true,
              isRoot: true,
            },
          });
        }
        if (String(url).includes('/api/tables/')) {
          return Response.json({ error: 'Not found' }, { status: 404 });
        }
        return Response.json({});
      }),
    );
    expect(() => render(<AppRoot />)).not.toThrow();
    await waitFor(() => {
      expect(screen.queryByText(/Unhandled/i)).toBeNull();
    });
  });

  it('ignores stale localStorage table id', async () => {
    localStorage.setItem(ONLINE_TABLE_STORAGE_KEY, 'bad-table');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/auth/me')) {
          return Response.json({
            user: {
              userId: 'u1',
              email: 'root@example.com',
              canOwnTables: true,
              isRoot: true,
            },
          });
        }
        return Response.json({ error: 'not found' }, { status: 404 });
      }),
    );
    expect(() => render(<AppRoot />)).not.toThrow();
    await waitFor(() => {
      expect(localStorage.getItem(ONLINE_TABLE_STORAGE_KEY)).toBeNull();
    });
  });
});
