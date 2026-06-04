import { describe, expect, it, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('fetchMe', () => {
  it('401 response is treated as unauthenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: 'Authentication required' }, { status: 401 }),
      ),
    );
    const { fetchMe } = await import('./client');
    await expect(fetchMe()).resolves.toBeNull();
  });

  it('404 response is treated as unauthenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'Not found' }, { status: 404 })),
    );
    const { fetchMe } = await import('./client');
    await expect(fetchMe()).resolves.toBeNull();
  });

  it('403 response throws AuthFetchError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: 'Ask an admin for an invite.', code: 'NOT_REGISTERED' },
          { status: 403 },
        ),
      ),
    );
    const { fetchMe } = await import('./client');
    await expect(fetchMe()).rejects.toMatchObject({ status: 403, code: 'NOT_REGISTERED' });
  });

  it('network failure surfaces as error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Network down');
    }));
    const { fetchMe, isSessionCheckConnectivityError } = await import('./client');
    await expect(fetchMe()).rejects.toThrow(/Network down/i);
    expect(isSessionCheckConnectivityError(new Error('Network down'))).toBe(true);
    expect(isSessionCheckConnectivityError(new Error('Request timed out'))).toBe(true);
  });
});
