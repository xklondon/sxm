import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CARD_VIEW_DESKTOP_FROZEN,
  CARD_VIEW_LAYOUT_OWNER_FILES,
  FULL_TABLE_DESKTOP_FROZEN,
  FULL_TABLE_LAYOUT_OWNER_FILES,
  FULL_TABLE_MOBILE_PORTRAIT_FROZEN,
  FULL_TABLE_PLAY_ZONE_CSS,
} from './blackjackLayoutContract';

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(join(process.cwd(), path))).digest('hex');
}

/** Frozen view CSS — update hashes only when deliberately changing a frozen view. */
const FROZEN_LAYOUT_FILE_SHA256: Record<string, string> = {
  'src/styles/bj-full-table-card-area.css':
    'e76e5a8ec4b1bd613e93a2531fc850c7c613825ce2f6cc4f840ba4716e861cae',
  'src/styles/bj-card-desktop-layout.css':
    'b0805be82480f2b2af7b64ddcda461c6a926075353a32c24f2623a1b3cdf8b36',
};

describe('frozen layout view integrity', () => {
  it('marks Desktop Full Table, Desktop Card View, and Mobile Portrait Full Table as frozen', () => {
    expect(FULL_TABLE_DESKTOP_FROZEN).toBe(true);
    expect(CARD_VIEW_DESKTOP_FROZEN).toBe(true);
    expect(FULL_TABLE_MOBILE_PORTRAIT_FROZEN).toBe(true);
  });

  it('does not mutate frozen owner CSS files during mobile/double pass', () => {
    for (const [path, expected] of Object.entries(FROZEN_LAYOUT_FILE_SHA256)) {
      expect(sha256(path), path).toBe(expected);
    }
  });

  it('lists frozen Full Table desktop owner paths', () => {
    expect(FULL_TABLE_LAYOUT_OWNER_FILES).toContain(FULL_TABLE_PLAY_ZONE_CSS);
    expect(CARD_VIEW_LAYOUT_OWNER_FILES).toContain('src/styles/bj-card-desktop-layout.css');
  });
});
