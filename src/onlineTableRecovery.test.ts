// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { ONLINE_TABLE_STORAGE_KEY } from './onlineTableStorage';
import { clearStaleOnlineTableContext, clearOnlineTableFromUrl } from './onlineTableRecovery';

describe('onlineTableRecovery', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/?table=60232d60-9604-4fd5-8672-f51713669ee3');
  });

  it('clearStaleOnlineTableContext removes storage and URL table param', () => {
    localStorage.setItem(ONLINE_TABLE_STORAGE_KEY, '60232d60-9604-4fd5-8672-f51713669ee3');
    clearStaleOnlineTableContext();
    expect(localStorage.getItem(ONLINE_TABLE_STORAGE_KEY)).toBeNull();
    expect(window.location.search).not.toContain('table=');
  });

  it('clearOnlineTableFromUrl is safe when no params', () => {
    window.history.replaceState({}, '', '/');
    expect(() => clearOnlineTableFromUrl()).not.toThrow();
    expect(window.location.pathname).toBe('/');
  });
});
