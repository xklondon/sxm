import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MOBILE_LAYOUT_MEDIA } from '../styles/mobileLayoutContract';
import { TABLE_UX } from './tableUxContract';

const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');

describe('mobile Card View chip tray layout', () => {
  it('uses separate flex rows for boxes and chip tray', () => {
    expect(LAYOUT_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*min-height:\s*var\(--bj-card-row-boxes\)/);
    expect(LAYOUT_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*min-height:\s*var\(--bj-card-row-tray\)/);
    expect(LAYOUT_CSS).toMatch(/\.bj-table-layout-shell[\s\S]*flex-direction:\s*column/);
  });

  it('places chip tray row below boxes with extra height on mobile', () => {
    expect(LAYOUT_CSS).toContain(MOBILE_LAYOUT_MEDIA);
    expect(LAYOUT_CSS).toMatch(/--bj-card-row-tray:\s*3\.35rem/);
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--bottom[\s\S]*padding|\.bj-view-card-mobile \.bj-card-layout__tray[\s\S]*padding-top/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--bottom[\s\S]*flex-shrink:\s*0|\.bj-view-card-mobile \.bj-card-layout__tray[\s\S]*flex-shrink:\s*0/,
    );
  });

  it('uses reduced horizontal gap between player boxes on mobile', () => {
    const panelCss = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-zone--boxes \.bj-arc--player-boxes[\s\S]*gap:|\.bj-card-layout__boxes \.bj-arc--player-boxes[\s\S]*gap:/,
    );
    expect(panelCss).toMatch(
      /\.bj-view-full-mobile \.bj-arc__slot[\s\S]*scale\(0\.88\)|\.bj-arc__slot[\s\S]*rotate\(var\(--arc-rot/,
    );
    expect(TABLE_UX.tableZoneBoxes).toBe('bj-table-zone--boxes');
    expect(TABLE_UX.tableZoneBottom).toBe('bj-table-zone--bottom');
  });
});
