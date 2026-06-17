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
    'edf6bddd8256c4dc4b7ee61a36911af1566d5da9f8c8b8364d5a71d2509bb9e2',
  'src/styles/bj-card-desktop-layout.css':
    'c011bf0eec3f0167b37457344c6d86989852611113d12a9576e2e2b77f570c72',
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
