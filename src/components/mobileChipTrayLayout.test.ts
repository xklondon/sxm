import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MOBILE_LAYOUT_MEDIA } from '../styles/mobileLayoutContract';
import { TABLE_UX } from './tableUxContract';

const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');

describe('mobile Card View chip tray layout', () => {
  it('uses separate flex rows for boxes and chip tray', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*height:\s*var\(--bj-zone-boxes-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*height:\s*var\(--bj-zone-tray-height\)/,
    );
    expect(LAYOUT_CSS).toMatch(/\.bj-table-layout-shell[\s\S]*flex-direction:\s*column/);
  });

  it('places chip tray row below boxes with extra height on mobile', () => {
    expect(SHARED_CSS).toContain(MOBILE_LAYOUT_MEDIA);
    expect(SHARED_CSS).toContain('--bj-mobile-zone-tray-height: 4.35rem');
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__tray-wrap,\s*\n\s*\.bj-view-card-mobile \.bj-casino__tray-wrap[\s\S]*flex-shrink:\s*0/,
    );
  });

  it('uses reduced horizontal gap between player boxes on mobile', () => {
    const panelCss = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-arc--player-boxes,\s*\n\s*\.bj-view-card-mobile \.bj-arc--player-boxes[\s\S]*gap:\s*0\.04rem/,
    );
    expect(panelCss).toMatch(
      /\.bj-view-full-mobile \.bj-arc--cards \.bj-arc__slot[\s\S]*scale\(0\.88\)|\.bj-view-full-mobile \.bj-arc--cards \.bj-arc__slot[\s\S]*rotate\(var\(--arc-rot/,
    );
    expect(TABLE_UX.tableZoneBoxes).toBe('bj-table-zone--boxes');
    expect(TABLE_UX.tableZoneBottom).toBe('bj-table-zone--bottom');
  });
});
