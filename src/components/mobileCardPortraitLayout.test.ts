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

  it('sizes hero cards inside the cards zone and hides hero hand total in portrait', () => {
    expect(PORTRAIT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards-slot[\s\S]*justify-content:\s*flex-end/,
    );
    expect(PORTRAIT_CSS).toMatch(
      /\.bj-view-card-mobile[\s\S]*\.bj-card-view__hero-value\.bj-phone-view__total--hero[\s\S]*display:\s*none/,
    );
  });
});
