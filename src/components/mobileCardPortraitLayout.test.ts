import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CARD_VIEW_MOBILE_PORTRAIT_LAYOUT_OWNER_FILES,
  CARD_VIEW_MOBILE_ROOT,
} from './blackjackLayoutContract';

const PORTRAIT_CSS = readFileSync(
  join(process.cwd(), CARD_VIEW_MOBILE_PORTRAIT_LAYOUT_OWNER_FILES[0]!),
  'utf8',
);

describe('Mobile Card View portrait layout owner', () => {
  it('scopes rules to portrait card-mobile view only', () => {
    expect(PORTRAIT_CSS).toMatch(/orientation:\s*portrait/);
    expect(PORTRAIT_CSS).toContain(`.${CARD_VIEW_MOBILE_ROOT}`);
    expect(PORTRAIT_CSS).not.toMatch(/^\s*\.bj-view-card-desktop/m);
    expect(PORTRAIT_CSS).not.toMatch(/^\s*\.bj-view-full-desktop/m);
    expect(PORTRAIT_CSS).not.toMatch(/^\s*\.bj-view-full-mobile/m);
  });

  it('only styles hero cards inside the cards zone — no shell zone placement', () => {
    expect(PORTRAIT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell::after[\s\S]*display:\s*none/,
    );
    expect(PORTRAIT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*--bj-card-hero-card-width/,
    );
    expect(PORTRAIT_CSS).not.toMatch(/\.bj-table-zone--actions/);
    expect(PORTRAIT_CSS).not.toMatch(/\.bj-table-zone--boxes/);
    expect(PORTRAIT_CSS).not.toMatch(/\.bj-table-zone--bottom/);
  });
});
