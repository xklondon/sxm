import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('useOnlineMultiplayer membership errors', () => {
  it('re-throws TableMembershipError without wrapping as stale refresh', () => {
    const src = readFileSync(join(process.cwd(), 'src/hooks/useOnlineMultiplayer.ts'), 'utf8');
    expect(src).toContain('TableMembershipError');
    expect(src).toMatch(/if \(err instanceof TableMembershipError\)[\s\S]*throw err/);
  });
});
