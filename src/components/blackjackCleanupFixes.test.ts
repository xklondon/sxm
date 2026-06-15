import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ACTIVE_HAND_VALUE_CLASS,
  LAYOUT_SLOT_OWNER_FILES,
} from './blackjackLayoutContract';
import { cardColumnHandValueClassName } from './boxHandValueDisplay';

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

const SHARED_CSS = readSrc('src/styles/bj-table-shared.css');
const CARD_AREA_CSS = readSrc('src/styles/bj-full-table-card-area.css');
const TABLE_INFO_CSS = readSrc('src/components/TableInfoBar.css');
const TABLE_INFO_TSX = readSrc('src/components/TableInfoBar.tsx');
const PANEL_SRC = readSrc('src/components/BlackjackPanel.tsx');

describe('cleanup fixes — bank value padding', () => {
  it('dealer bank hand value uses dedicated padding class', () => {
    expect(TABLE_INFO_CSS).toContain('.bj-dealer-hand-value');
    expect(TABLE_INFO_CSS).toMatch(/\.bj-dealer-hand-value[\s\S]*padding:/);
    expect(TABLE_INFO_TSX).toContain('bj-dealer-hand-value');
    expect(TABLE_INFO_TSX).toContain('bj-table-info-bar--dealer-hand');
  });
});

describe('cleanup fixes — active value highlight', () => {
  it('active turn class is applied only on numeric value span', () => {
    const active = cardColumnHandValueClassName(true, false, true);
    expect(active).toContain(ACTIVE_HAND_VALUE_CLASS);
    expect(active).not.toContain('bj-player-hand-value--emphasis');
  });

  it('active turn CSS uses tight frame rather than oversized ellipse', () => {
    const block = SHARED_CSS.match(
      /\.bj-arc--cards \.bj-phone-view__box-value--active-turn[\s\S]*?\}/,
    )?.[0];
    expect(block).toBeTruthy();
    expect(block).not.toContain('border-radius: 50%');
    expect(block).toContain('border-radius: 0.32em');
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards\.bj-full-table-card-area \.bj-arc__slot--card-column \.bj-phone-view__box-value--active-turn[\s\S]*height:\s*var\(--bj-box-value-band-height\)/,
    );
  });

  it('panel does not duplicate hand value on card stack container', () => {
    for (const file of LAYOUT_SLOT_OWNER_FILES) {
      const src = readSrc(file);
      expect(src).toContain('cardColumnHandValueClassName');
      expect(src).not.toContain("'bj-box--turn'");
    }
  });
});

describe('cleanup fixes — desktop card area position', () => {
  it('lowers desktop full-table card columns toward player boxes', () => {
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*justify-content:\s*flex-end/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*padding-top:\s*0/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards\.bj-full-table-card-area \.bj-arc__slot--card-column > \.bj-phone-view__box-value--card-column-below[\s\S]*grid-row:\s*3/,
    );
  });

  it('does not add desktop card-column padding to mobile full table', () => {
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-arc__slot--card-column\s*\{[^}]*padding-top:/,
    );
  });

  it('panel still maps card columns from displaySlots on desktop arc row', () => {
    expect(PANEL_SRC).toMatch(
      /displaySlots\.map\(\(slot\)[\s\S]*renderArcCardColumn\(slot\.playerId, slot\.slotNumber\)/,
    );
  });
});
