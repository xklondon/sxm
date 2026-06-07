import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { TABLE_UX } from './tableUxContract';
import { tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';

const noop = () => {};

let simulatedWidth = 390;
const globalRef = globalThis as unknown as { window?: unknown };
const hadWindow = 'window' in globalRef;

beforeAll(() => {
  globalRef.window = {
    matchMedia: (query: string) => {
      const m = /max-width:\s*(\d+)/.exec(query);
      const max = m ? Number(m[1]) : Number.POSITIVE_INFINITY;
      return {
        matches: simulatedWidth <= max,
        media: query,
        addEventListener: noop,
        removeEventListener: noop,
        addListener: noop,
        removeListener: noop,
        onchange: null,
        dispatchEvent: () => false,
      };
    },
  };
});

afterAll(() => {
  if (!hadWindow) {
    delete globalRef.window;
  }
});

function renderAt(width: number, viewMode: 'full' | 'card' = 'card'): string {
  simulatedWidth = width;
  const state: GameState = {
    ...tableAfterStartPlaying(500),
    tableViewMode: viewMode,
  };
  return renderToStaticMarkup(<BlackjackPanel gameState={state} onGameStateChange={noop} />);
}

function readCss(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('mobile layout cleanup', () => {
  const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
  const sharedCss = readCss('src/styles/bj-table-shared.css');
  const panelCss = readCss('src/components/BlackjackPanel.css');
  const cardLayoutCss = readCss('src/styles/bj-card-layout.css');

  it('uses shared mobile table shell class on rail-wrap', () => {
    expect(panelSrc).toContain('TABLE_UX.mobileTableShell');
    expect(renderAt(390, 'full')).toContain(TABLE_UX.mobileTableShell);
    expect(renderAt(390, 'card')).toContain(TABLE_UX.mobileTableShell);
  });

  it('mobile Full Table and Card View share felt/rail tokens in CSS', () => {
    expect(sharedCss).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt[\s\S]*min-height:\s*var\(--bj-mobile-felt-min-height\)/,
    );
    expect(sharedCss).toMatch(
      /\.bj-view-full-mobile \.bj-casino__rail,\s*\n\s*\.bj-view-card-mobile \.bj-casino__rail[\s\S]*padding:\s*var\(--bj-mobile-rail-padding\)/,
    );
  });

  it('mobile header hides Play Ledger and Settings nav buttons', () => {
    const mobile = renderAt(390, 'card');
    const desktop = renderAt(1280, 'card');
    expect(mobile).toContain('This Table');
    expect(mobile).not.toMatch(/bj-casino__table-nav[\s\S]*>Play Ledger</);
    expect(mobile).not.toMatch(/bj-casino__table-nav[\s\S]*>Settings</);
    expect(desktop).toContain('Play Ledger');
    expect(desktop).toContain('Settings');
  });

  it('mobile This Table overlay exposes Play Ledger and Settings tabs in source', () => {
    expect(panelSrc).toContain('renderMobileSidePanelTabs');
    expect(panelSrc).toContain("setMobileSidePanelTab('playLedger')");
    expect(panelSrc).toContain("setMobileSidePanelTab('settings')");
    expect(panelSrc).toContain('<PlayLedgerPanel');
    expect(panelSrc).toContain('embedded');
  });

  it('mobile side panel is overlay, not below-table flow', () => {
    const closed = renderAt(390, 'card');
    expect(closed).not.toContain('bj-casino__this-table--below');
    expect(closed).not.toContain(TABLE_UX.mobileSidePanelOverlay);
    expect(panelSrc).toContain("renderSideRailPanel('overlay')");
    expect(panelSrc).toContain('TABLE_UX.mobileSidePanelOverlay');
    expect(sharedCss).toContain(TABLE_UX.mobileSidePanelOverlay);
    expect(sharedCss).toContain(TABLE_UX.mobileSidePanelSheet);
  });

  it('desktop side rail remains docked', () => {
    const desktop = renderAt(1280, 'card');
    expect(desktop).toContain(TABLE_UX.sideRailDock);
    expect(desktop).not.toContain(TABLE_UX.mobileSidePanelOverlay);
    expect(desktop).not.toContain('bj-casino__this-table--below');
  });

  it('mobile Card View mini-row fits seven boxes without horizontal scroll', () => {
    expect(panelCss).toMatch(/\.bj-view-card-mobile \.bj-phone-view__mini-row[\s\S]*overflow-x:\s*hidden/);
    expect(panelCss).toMatch(/grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
    expect(cardLayoutCss).toMatch(
      /\.bj-view-card-mobile \.bj-card-layout__boxes \.bj-phone-view__mini-row[\s\S]*overflow-x:\s*hidden/,
    );
    const mobile = renderAt(390, 'card');
    expect(mobile).toContain('bj-phone-view__mini-row');
    expect(mobile.match(/aria-label="(?:Join )?[Bb]ox \d/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
  });

  it('mobile landscape uses shared shell and landscape felt height token', () => {
    expect(sharedCss).toMatch(/@media \(orientation: landscape\)[\s\S]*--bj-mobile-felt-min-height:\s*min\(68dvh,\s*100%\)/);
    expect(panelCss).toMatch(/@media \(max-width: 720px\) and \(orientation: landscape\)/);
  });

  it('mobile Full Table arc fits shell without inner horizontal scroll', () => {
    expect(panelCss).toContain('contract: mobile-arc-fit');
    expect(panelCss).toMatch(/\.bj-view-full-mobile \.bj-casino__felt-main[\s\S]*overflow-x:\s*hidden/);
    expect(panelCss).not.toMatch(/\.bj-view-full-mobile \.bj-arc[\s\S]*min-width:\s*calc\(100% \+ 2\.5rem\)/);
  });
});
