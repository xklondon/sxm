// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../types';

const socketHarness = vi.hoisted(() => ({
  onTableUpdate: null as
    | ((payload: { tableId: string; version: number; state: unknown }) => void)
    | null,
}));

vi.mock('./onlineSocket', () => ({
  acquireOnlineSocket: vi.fn(
    (opts: { onTableUpdate: (payload: { tableId: string; version: number; state: unknown }) => void }) => {
      socketHarness.onTableUpdate = opts.onTableUpdate;
      return () => {
        socketHarness.onTableUpdate = null;
      };
    },
  ),
}));

const sendTableActionMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client', () => ({
  fetchMe: vi.fn(),
  fetchTable: vi.fn(),
  sendTableAction: sendTableActionMock,
  TableMembershipError: class TableMembershipError extends Error {},
}));

vi.mock('../api/config', () => ({
  isOnlineModeEnabled: () => true,
}));

vi.mock('../components/viewerIdentity', () => ({
  applyOnlineTableBootstrap: vi.fn(),
}));

import { useOnlineTable } from './useOnlineMultiplayer';

function fakeState(marker: string): GameState {
  return { marker } as unknown as GameState;
}

describe('useOnlineTable — monotonic version guard', () => {
  const onGameStateChange = vi.fn();

  beforeEach(() => {
    onGameStateChange.mockClear();
    sendTableActionMock.mockReset();
  });

  afterEach(() => {
    socketHarness.onTableUpdate = null;
  });

  it('drops a socket broadcast older than the applied version', () => {
    renderHook(() => useOnlineTable('t1', onGameStateChange, 5));

    act(() => {
      socketHarness.onTableUpdate!({ tableId: 't1', version: 6, state: fakeState('v6') });
    });
    expect(onGameStateChange).toHaveBeenCalledTimes(1);

    act(() => {
      socketHarness.onTableUpdate!({ tableId: 't1', version: 5, state: fakeState('v5-late') });
    });
    // Stale broadcast must not regress the applied state.
    expect(onGameStateChange).toHaveBeenCalledTimes(1);
    expect(onGameStateChange).toHaveBeenLastCalledWith(fakeState('v6'));
  });

  it('does not re-apply the actor\'s own broadcast after the HTTP response (same version)', async () => {
    sendTableActionMock.mockResolvedValue({ version: 7, state: fakeState('v7-http') });
    const { result } = renderHook(() => useOnlineTable('t1', onGameStateChange, 6));

    await act(async () => {
      await result.current.dispatchAction('hit', {});
    });
    expect(onGameStateChange).toHaveBeenCalledTimes(1);

    act(() => {
      socketHarness.onTableUpdate!({ tableId: 't1', version: 7, state: fakeState('v7-broadcast') });
    });
    // Duplicate (equal-version) broadcast is dropped — no double apply.
    expect(onGameStateChange).toHaveBeenCalledTimes(1);
  });

  it('ignores broadcasts for a different table', () => {
    renderHook(() => useOnlineTable('t1', onGameStateChange, null));

    act(() => {
      socketHarness.onTableUpdate!({ tableId: 'other', version: 99, state: fakeState('foreign') });
    });
    expect(onGameStateChange).not.toHaveBeenCalled();
  });

  it('still applies newer broadcasts after the guard drops older ones', () => {
    renderHook(() => useOnlineTable('t1', onGameStateChange, 3));

    act(() => {
      socketHarness.onTableUpdate!({ tableId: 't1', version: 2, state: fakeState('v2') });
      socketHarness.onTableUpdate!({ tableId: 't1', version: 4, state: fakeState('v4') });
    });
    expect(onGameStateChange).toHaveBeenCalledTimes(1);
    expect(onGameStateChange).toHaveBeenLastCalledWith(fakeState('v4'));
  });
});
