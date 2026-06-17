import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FULL_TABLE_MOBILE_LANDSCAPE_LAYOUT_OWNER_FILES,
  FULL_TABLE_MOBILE_VIEW_ROOT,
} from './blackjackLayoutContract';

const LANDSCAPE_CSS = readFileSync(
  join(process.cwd(), FULL_TABLE_MOBILE_LANDSCAPE_LAYOUT_OWNER_FILES[0]!),
  'utf8',
);

describe('Mobile Full Table landscape layout owner', () => {
  it('scopes rules to full-mobile landscape only', () => {
    expect(LANDSCAPE_CSS).toMatch(/max-width:\s*920px/);
    expect(LANDSCAPE_CSS).toMatch(/orientation:\s*landscape/);
    expect(LANDSCAPE_CSS).toContain(`.${FULL_TABLE_MOBILE_VIEW_ROOT}`);
    expect(LANDSCAPE_CSS).not.toContain('.bj-view-card-mobile');
    expect(LANDSCAPE_CSS).not.toContain('.bj-view-full-desktop');
    expect(LANDSCAPE_CSS).not.toContain('.bj-view-card-desktop');
  });

  it('uses grid shell with cards, actions, boxes, and tray bands', () => {
    expect(LANDSCAPE_CSS).toMatch(/grid-template-areas[\s\S]*cards[\s\S]*actions[\s\S]*boxes[\s\S]*tray/);
    expect(LANDSCAPE_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table/,
    );
    expect(LANDSCAPE_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*margin-top:\s*0/,
    );
  });
});
