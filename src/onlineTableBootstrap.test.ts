import { describe, expect, it } from 'vitest';
import { resolveEffectiveOnlineTableId } from './onlineTableBootstrap';
import { ONLINE_TABLE_STORAGE_KEY } from './onlineTableStorage';

const NEW_TABLE = '11111111-1111-4111-8111-111111111111';
const STALE_TABLE = '60232d60-9604-4fd5-8672-f51713669ee3';

describe('resolveEffectiveOnlineTableId', () => {
  it('prefers active table id over stale prop after recovery create', () => {
    expect(
      resolveEffectiveOnlineTableId(NEW_TABLE, false, STALE_TABLE),
    ).toBe(NEW_TABLE);
  });

  it('returns null when dismissed and no active table', () => {
    expect(resolveEffectiveOnlineTableId(null, true, STALE_TABLE)).toBeNull();
  });

  it('reads prop when no active table and not dismissed', () => {
    expect(resolveEffectiveOnlineTableId(null, false, STALE_TABLE)).toBe(STALE_TABLE);
  });
});

describe('stale storage key', () => {
  it('uses stable localStorage key', () => {
    expect(ONLINE_TABLE_STORAGE_KEY).toBe('sxmcards:online-table-id');
  });
});
