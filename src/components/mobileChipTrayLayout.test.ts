import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');

describe('mobile Card View chip tray layout', () => {
  it('uses separate grid rows for boxes and chip tray', () => {
    expect(LAYOUT_CSS).toMatch(/grid-template-rows:[\s\S]*var\(--bj-card-row-boxes\)[\s\S]*var\(--bj-card-row-tray\)/);
  });

  it('places chip tray row below boxes with extra height on mobile', () => {
    expect(LAYOUT_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*--bj-card-row-tray:\s*3\.35rem/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-card-layout__tray[\s\S]*padding-top/,
    );
  });

  it('uses reduced horizontal gap between player boxes on mobile', () => {
    expect(PANEL_CSS).toMatch(/\.bj-view-card-mobile \.bj-phone-view__mini-row[\s\S]*gap:\s*0\.06rem/);
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-card-layout__boxes \.bj-phone-view__mini-row[\s\S]*gap:\s*0\.06rem/,
    );
  });
});
