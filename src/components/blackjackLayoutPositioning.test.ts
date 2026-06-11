import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUND_SUMMARY_OVERLAY_DELAY_MS } from './roundSummaryOverlayTiming';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const ACTION_PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackActionPanel.tsx'), 'utf8');

describe('player boxes bottom placement and cards area growth', () => {
  it('uses flex-column shell with mobile cards flex-grow and boxes pinned above tray', () => {
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell\s*\{[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column/);
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards[\s\S]*flex:\s*1\s*1\s*auto/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*margin-top:\s*auto/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*margin-top:\s*var\(--bj-zone-boxes-tray-gap\)/,
    );
  });

  it('uses fixed desktop CSS grid rows without margin-top:auto on boxes', () => {
    const desktop = SHARED_CSS.slice(
      SHARED_CSS.indexOf('/* Desktop table shell — fixed CSS grid rows'),
      SHARED_CSS.indexOf('/* Desktop stage:'),
    );
    expect(desktop).toMatch(/\.bj-table-layout-shell\s*\{[\s\S]*display:\s*grid/);
    expect(desktop).toMatch(/\[cards\]\s*var\(--bj-desktop-grid-row-cards\)/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*margin:\s*0/);
  });

  it('does not reserve tray gap inside player boxes zone padding', () => {
    expect(SHARED_CSS).not.toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*padding-bottom:\s*calc\(var\(--bj-card-boxes-padding-bottom\) \+ var\(--bj-zone-boxes-tray-gap\)\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*padding:[\s\S]*var\(--bj-card-boxes-padding-bottom\)/,
    );
  });

  it('bottom-aligns player boxes in all view roots', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-zone--boxes[\s\S]*justify-content:\s*flex-end/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--boxes[\s\S]*justify-content:\s*flex-end/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--boxes[\s\S]*justify-content:\s*flex-end/,
    );
  });
});

describe('Card View actions route', () => {
  it('serves Hit/Stand from shared BlackjackActionPanel in the actions zone for all views', () => {
    expect(PANEL_SRC).toContain('BlackjackActionPanel');
    expect(PANEL_SRC).toContain('renderActionsContent');
    expect(PANEL_SRC).toMatch(/variant="table"/);
    expect(ACTION_PANEL_SRC).toContain('bj-table-actions__btn');
  });

  it('routes mobile Card View Hit/Stay through actions zone and side indicators beside hero', () => {
    expect(CARD_VIEW_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--actions \.bj-table-actions > \.bj-table-actions__row:first-child[\s\S]*display:\s*none/,
    );
    expect(CARD_VIEW_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__side-action[\s\S]*display:\s*none/,
    );
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__side-action/,
    );
    expect(CARD_VIEW_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-table-zone--actions \.bj-table-actions > \.bj-table-actions__row:first-child[\s\S]*display:\s*none/,
    );
  });
});

describe('round summary overlay delay', () => {
  it('waits three seconds after reveal before opening overlay', () => {
    expect(ROUND_SUMMARY_OVERLAY_DELAY_MS).toBe(3000);
    expect(PANEL_SRC).toContain('ROUND_SUMMARY_OVERLAY_DELAY_MS');
    expect(PANEL_SRC).toContain('roundSummaryDelayReady');
    expect(PANEL_SRC).toMatch(/cardRevealComplete &&[\s\S]*roundSummaryDelayReady/);
    expect(PANEL_SRC).toMatch(/setRoundSummaryDelayReady\(true\)/);
    expect(PANEL_SRC).toMatch(/clearTimeout\(timer\)/);
  });
});
