// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppRoot } from './AppRoot';

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

describe('AppRoot invite auth routing', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('unauthenticated /join-table shows login and does not bounce to accept', async () => {
    window.history.replaceState({}, '', '/join-table?token=invite-token');
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/auth/me')) {
          return Response.json({ error: 'Authentication required' }, { status: 401 });
        }
        if (String(url).includes('/api/tables/invites/preview')) {
          return Response.json({
            preview: { invitedEmail: 'guest@example.com', tableName: 'Friday Night' },
          });
        }
        return Response.json({ error: 'not found' }, { status: 404 });
      }),
    );

    render(<AppRoot />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send magic link/i })).toBeTruthy();
    });
    expect(assign).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('sxmcards:pending-join')).toContain('token=invite-token');
  });

  it('authenticated /login with returnTo resumes join-table instead of lobby', async () => {
    window.history.replaceState(
      {},
      '',
      '/login?returnTo=%2Fjoin-table%3Ftoken%3Dinvite-token',
    );
    const replace = vi.spyOn(window.location, 'replace').mockImplementation(() => {});
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/auth/me')) {
          return Response.json({
            user: {
              userId: 'u1',
              email: 'guest@example.com',
              displayName: 'Guest',
              canOwnTables: false,
              isRoot: false,
            },
          });
        }
        return Response.json({ error: 'not found' }, { status: 404 });
      }),
    );

    render(<AppRoot />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/join-table?token=invite-token');
    });
    expect(assign.mock.calls.some((call) => String(call[0]).includes('/api/tables/invites/accept'))).toBe(
      false,
    );
  });
});
