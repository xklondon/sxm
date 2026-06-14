import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CHIP_CSS = readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');

describe('desktop Full Table layout polish', () => {
  it('renders tray label below the chip plaque row on Full Table desktop', () => {
    expect(CHIP_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-value-chips--with-label[\s\S]*grid-template-rows:\s*auto auto/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-value-chips--with-label \.bj-value-chips__row--label[\s\S]*grid-row:\s*2/,
    );
    expect(CHIP_CSS).not.toMatch(
      /\.bj-view-card-desktop \.bj-value-chips--with-label[\s\S]*grid-row:\s*2/,
    );
  });

  it('spreads Full Table player boxes with fixed width columns across felt width', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*justify-content:\s*space-evenly/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*grid-template-columns:\s*repeat\(var\(--slot-count,\s*4\),\s*var\(--bj-full-table-box-width\)\)/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--cards[\s\S]*grid-template-columns:\s*repeat\(var\(--slot-count,\s*4\),\s*var\(--bj-full-table-box-width\)\)/,
    );
  });

  it('uses fixed bottom value zone and reserved outcome zone on Full Table card columns', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards \.bj-arc__slot--card-column > \.bj-phone-view__box-value--card-column-below[\s\S]*grid-row:\s*3/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards \.bj-arc__slot--card-column > \.bj-card-outcome-marker[\s\S]*grid-row:\s*1/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards \.bj-phone-view__box-value--active-turn[\s\S]*max-height:\s*var\(--bj-box-value-band-height\)/,
    );
    expect(PANEL_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards \.bj-phone-view__box-value--card-column-below[\s\S]*grid-row:\s*3/,
    );
  });

  it('does not apply Full Table spread or card-grid rules to mobile viewports', () => {
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*space-evenly/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-arc--cards \.bj-arc__slot--card-column > \.bj-phone-view__box-value--card-column-below[\s\S]*grid-row:\s*3/,
    );
    expect(CHIP_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-value-chips--with-label[\s\S]*grid-template-rows:\s*auto auto[\s\S]*grid-row:\s*2/,
    );
  });
});
