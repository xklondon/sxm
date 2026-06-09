// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ONLINE_TABLE_STORAGE_KEY,
  isValidOnlineTableId,
  readStoredOnlineTableId,
  resolveOnlineTableId,
  resolveBootTableId,
  writeStoredOnlineTableId,
} from './onlineTableStorage';

const VALID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

describe('onlineTableStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rejects garbage table ids', () => {
    expect(isValidOnlineTableId('')).toBe(false);
    expect(isValidOnlineTableId('stale-table-id')).toBe(false);
    expect(isValidOnlineTableId('<script>')).toBe(false);
  });

  it('clears invalid localStorage on read', () => {
    localStorage.setItem(ONLINE_TABLE_STORAGE_KEY, 'not-a-uuid');
    expect(readStoredOnlineTableId()).toBeNull();
    expect(localStorage.getItem(ONLINE_TABLE_STORAGE_KEY)).toBeNull();
  });

  it('resolveOnlineTableId prefers valid URL over storage', () => {
    writeStoredOnlineTableId(VALID);
    const other = 'b2c3d4e5-f6a7-4890-b123-456789abcdef';
    expect(resolveOnlineTableId(other, false)).toBe(other);
  });

  it('forceNewTable ignores storage', () => {
    writeStoredOnlineTableId(VALID);
    expect(resolveOnlineTableId(null, true)).toBeNull();
  });

  it('resolveBootTableId ignores stored table id', () => {
    writeStoredOnlineTableId(VALID);
    expect(resolveBootTableId(null, false)).toBeNull();
    expect(resolveBootTableId(VALID, false)).toBe(VALID);
  });
});
