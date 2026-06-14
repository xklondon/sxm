import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FULL_TABLE_CARD_COLUMN_CLASS,
  FULL_TABLE_CARD_COLUMN_GRID_ROWS,
  FULL_TABLE_CARD_COLUMN_VIEW_ROOTS,
} from './blackjackLayoutContract';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const LAYOUT_CONTRACT_SRC = readFileSync(
  join(process.cwd(), 'src/components/blackjackLayoutContract.ts'),
  'utf8',
);

describe('Full Table canonical card-column layout contract', () => {
  it('documents three-zone grid rows for Full Table desktop and mobile', () => {
    expect(LAYOUT_CONTRACT_SRC).toContain(FULL_TABLE_CARD_COLUMN_CLASS);
    expect(FULL_TABLE_CARD_COLUMN_GRID_ROWS).toEqual([
      'var(--bj-full-table-card-outcome-zone-height, 0.72rem)',
      'minmax(var(--bj-table-card-height), auto)',
      'var(--bj-box-value-band-height)',
    ]);
    expect(FULL_TABLE_CARD_COLUMN_VIEW_ROOTS).toEqual([
      'bj-view-full-desktop',
      'bj-view-full-mobile',
    ]);
  });

  it('pins value zone to grid row 3 on Full Table desktop and mobile', () => {
    for (const viewRoot of FULL_TABLE_CARD_COLUMN_VIEW_ROOTS) {
      expect(SHARED_CSS).toMatch(
        new RegExp(
          `\\.${viewRoot} \\.bj-arc--cards \\.bj-arc__slot--card-column > \\.bj-phone-view__box-value--card-column-below[\\s\\S]*grid-row:\\s*3`,
        ),
      );
    }
  });

  it('uses auto column height and bottom-aligned card-row slots', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc__slot--card-column,\s*\n\.bj-view-full-mobile \.bj-arc__slot--card-column[\s\S]*height:\s*auto/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--cards > \.bj-arc__slot[\s\S]*align-self:\s*end/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--cards > \.bj-arc__slot[\s\S]*align-self:\s*end/,
    );
  });

  it('does not apply canonical card-column grid to Card View mobile', () => {
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-arc__slot--card-column[\s\S]*grid-template-rows:/,
    );
  });

  it('keeps active-turn highlight inside fixed value band height', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards \.bj-phone-view__box-value--active-turn,\s*\n\.bj-view-full-mobile \.bj-arc--cards \.bj-phone-view__box-value--active-turn[\s\S]*height:\s*var\(--bj-box-value-band-height\)/,
    );
  });
});
