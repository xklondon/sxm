import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FULL_TABLE_CARD_AREA_CLASS,
  FULL_TABLE_CARD_AREA_CSS,
  FULL_TABLE_CARD_COLUMN_CLASS,
  FULL_TABLE_CARD_COLUMN_GRID_ROWS,
  FULL_TABLE_CARD_COLUMN_VIEW_ROOTS,
} from './blackjackLayoutContract';

const CARD_AREA_CSS = readFileSync(join(process.cwd(), FULL_TABLE_CARD_AREA_CSS), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const INDEX_CSS = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

function cardSlotRules(css: string): string {
  const match = css.match(
    /\.bj-view-full-(?:desktop|mobile) \.bj-table-slot-row\.bj-arc--cards\.bj-full-table-card-area > \.bj-arc__slot\s*\{[^}]*\}/s,
  );
  return match?.[0] ?? '';
}

describe('Full Table card area canonical contract', () => {
  it('imports dedicated CSS after shared, player-row, and card-layout', () => {
    expect(INDEX_CSS.indexOf('bj-table-shared.css')).toBeLessThan(INDEX_CSS.indexOf('bj-full-table-card-area.css'));
    expect(INDEX_CSS.indexOf('bj-player-row-layout.css')).toBeLessThan(
      INDEX_CSS.indexOf('bj-full-table-card-area.css'),
    );
    expect(INDEX_CSS.indexOf('bj-card-layout.css')).toBeLessThan(INDEX_CSS.indexOf('bj-full-table-card-area.css'));
    expect(INDEX_CSS.indexOf('bj-full-table-card-area.css')).toBeLessThan(INDEX_CSS.indexOf('bj-felt-skins.css'));
  });

  it('documents three-zone column grid for Full Table desktop and mobile', () => {
    expect(FULL_TABLE_CARD_COLUMN_CLASS).toBe('bj-arc__slot--card-column');
    expect(FULL_TABLE_CARD_AREA_CLASS).toBe('bj-full-table-card-area');
    expect(FULL_TABLE_CARD_COLUMN_GRID_ROWS).toHaveLength(3);
    expect(FULL_TABLE_CARD_COLUMN_VIEW_ROOTS).toEqual(['bj-view-full-desktop', 'bj-view-full-mobile']);
    expect(PANEL_SRC).toContain('FULL_TABLE_CARD_AREA_CLASS');
  });

  it('fills command-to-actions gap and bottom-aligns columns (desktop + mobile)', () => {
    expect(CARD_AREA_CSS).toMatch(/--bj-full-table-card-column-height:/);
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*flex:\s*1\s+1\s+auto/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*justify-content:\s*flex-end/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*justify-content:\s*flex-end/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*padding-top:\s*0/,
    );
    for (const viewRoot of FULL_TABLE_CARD_COLUMN_VIEW_ROOTS) {
      expect(CARD_AREA_CSS).toMatch(
        new RegExp(
          `\\.${viewRoot} \\.bj-arc--cards\\.bj-full-table-card-area \\.bj-arc__slot--card-column > \\.bj-phone-view__box-value--card-column-below[\\s\\S]*grid-row:\\s*3`,
        ),
      );
      expect(CARD_AREA_CSS).toMatch(
        new RegExp(
          `\\.${viewRoot} \\.bj-arc--cards\\.bj-full-table-card-area \\.bj-arc__slot--card-column > \\.bj-phone-view__box-value--card-column-below[\\s\\S]*align-self:\\s*end`,
        ),
      );
    }
  });

  it('pins card stack bottom directly above value zone', () => {
    for (const viewRoot of FULL_TABLE_CARD_COLUMN_VIEW_ROOTS) {
      expect(CARD_AREA_CSS).toMatch(
        new RegExp(
          `\\.${viewRoot} \\.bj-arc--cards\\.bj-full-table-card-area \\.bj-arc__slot--card-column > \\.bj-arc__cards--stack-vertical[\\s\\S]*grid-row:\\s*2[\\s\\S]*align-self:\\s*end`,
        ),
      );
    }
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc__slot--card-column[\s\S]*grid-template-rows:[\s\S]*var\(--bj-box-value-band-height\)/,
    );
  });

  it('keeps arc row at natural column height (not vertically centered in card area)', () => {
    const arcRowRule =
      CARD_AREA_CSS.match(
        /\.bj-view-full-desktop \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table \.bj-table-slot-row\.bj-arc--cards,[\s\S]*?\{[^}]*\}/,
      )?.[0] ?? '';
    const arcAreaRule =
      CARD_AREA_CSS.match(
        /\.bj-view-full-desktop \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table \.bj-arc--cards\.bj-full-table-card-area,[\s\S]*?\{[^}]*\}/,
      )?.[0] ?? '';
    expect(arcRowRule).toContain('height: auto');
    expect(arcAreaRule).toContain('height: auto');
    expect(arcAreaRule).not.toMatch(/[^-]height:\s*100%/);
  });

  it('forbids flex-grow / vertical centering on Full Table card arc and slots', () => {
    const arcAreaRule =
      CARD_AREA_CSS.match(
        /\.bj-view-full-desktop \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table \.bj-arc--cards\.bj-full-table-card-area,[\s\S]*?\{[^}]*\}/,
      )?.[0] ?? '';
    expect(arcAreaRule).toContain('flex: 0 0 auto');
    expect(arcAreaRule).not.toContain('flex: 1 1 auto');
    for (const viewRoot of FULL_TABLE_CARD_COLUMN_VIEW_ROOTS) {
      expect(CARD_AREA_CSS).toContain(viewRoot);
    }
    const slotRule = cardSlotRules(CARD_AREA_CSS) || cardSlotRules(PLAYER_ROW_CSS);
    expect(slotRule).toContain('align-self: end');
    expect(slotRule).not.toContain('align-self: center');
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--cards > \.bj-arc__slot\s*\{[^}]*align-self:\s*center/,
    );
  });

  it('does not apply Full Table card-column grid to Card View', () => {
    expect(CARD_AREA_CSS).not.toMatch(/\.bj-view-card-desktop\s/);
    expect(CARD_AREA_CSS).not.toMatch(/\.bj-view-card-mobile\s/);
    expect(CARD_AREA_CSS).not.toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero/);
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-arc__slot--card-column[\s\S]*grid-template-rows:/,
    );
  });

  it('keeps active-turn highlight inside fixed value band', () => {
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards\.bj-full-table-card-area \.bj-arc__slot--card-column \.bj-phone-view__box-value--active-turn[\s\S]*height:\s*var\(--bj-box-value-band-height\)/,
    );
  });

  it('does not override desktop grid cards row — flexible 1fr stays in shared shell', () => {
    expect(CARD_AREA_CSS).not.toMatch(/grid-template-rows:[\s\S]*\[cards\]/);
    expect(SHARED_CSS).toContain('--bj-desktop-grid-row-cards: minmax(0, 1fr)');
    expect(SHARED_CSS).toMatch(/\[cards\]\s*var\(--bj-desktop-grid-row-cards\)/);
  });
});
