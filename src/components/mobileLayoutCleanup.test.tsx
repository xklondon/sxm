import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { TABLE_UX } from './tableUxContract';
import { tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';
import {
  MOBILE_LAYOUT_MEDIA,
} from '../styles/mobileLayoutContract';
import {
  createMobileLayoutMatchMedia,
  type SimulatedViewport,
} from '../test/mobileLayoutMatchMedia';

const noop = () => {};

let simulatedViewport: SimulatedViewport = { width: 390, height: 844 };
const globalRef = globalThis as unknown as { window?: unknown };
const hadWindow = 'window' in globalRef;

beforeAll(() => {
  globalRef.window = {
    matchMedia: createMobileLayoutMatchMedia(() => simulatedViewport),
  };
});

afterAll(() => {
  if (!hadWindow) {
    delete globalRef.window;
  }
});

function renderAt(
  viewport: SimulatedViewport,
  viewMode: 'full' | 'card' = 'card',
): string {
  simulatedViewport = viewport;
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

  it('uses shared mobile table shell class on rail-wrap', () => {
    expect(panelSrc).toContain('TABLE_UX.mobileTableShell');
    expect(renderAt({ width: 390, height: 844 }, 'full')).toContain(TABLE_UX.mobileTableShell);
    expect(renderAt({ width: 390, height: 844 }, 'card')).toContain(TABLE_UX.mobileTableShell);
  });

  it('mobile Full Table and Card View share felt/rail tokens in CSS', () => {
    expect(sharedCss).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt[\s\S]*min-height:\s*var\(--bj-mobile-felt-min-height\)/,
    );
    expect(sharedCss).toContain('--bj-mobile-felt-min-height: 0');
    expect(sharedCss).toMatch(
      /\.bj-view-full-mobile \.bj-casino__rail,\s*\n\s*\.bj-view-card-mobile \.bj-casino__rail[\s\S]*padding:\s*var\(--bj-mobile-rail-padding\)/,
    );
  });

  it('mobile header hides Play Ledger and Settings nav buttons', () => {
    const mobile = renderAt({ width: 390, height: 844 }, 'card');
    const desktop = renderAt({ width: 1280, height: 800 }, 'card');
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
    const closed = renderAt({ width: 390, height: 844 }, 'card');
    expect(closed).not.toContain('bj-casino__this-table--below');
    expect(closed).not.toContain(TABLE_UX.mobileSidePanelOverlay);
    expect(panelSrc).toContain("renderSideRailPanel('overlay')");
    expect(panelSrc).toContain('TABLE_UX.mobileSidePanelOverlay');
    expect(sharedCss).toContain(TABLE_UX.mobileSidePanelOverlay);
    expect(sharedCss).toContain(TABLE_UX.mobileSidePanelSheet);
  });

  it('desktop side rail remains docked', () => {
    const desktop = renderAt({ width: 1280, height: 800 }, 'card');
    expect(desktop).toContain(TABLE_UX.sideRailDock);
    expect(desktop).not.toContain(TABLE_UX.mobileSidePanelOverlay);
    expect(desktop).not.toContain('bj-casino__this-table--below');
  });

  it('mobile Full Table and Card View share player box arc contract', () => {
    const playerRowCss = readCss('src/styles/bj-player-row-layout.css');
    expect(playerRowCss).toMatch(/\.bj-table-slot-row \{[\s\S]*display:\s*grid/);
    expect(playerRowCss).toMatch(
      /\.bj-view-card-mobile \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*minmax\(0,\s*1fr\)/,
    );
    const mobile = renderAt({ width: 390, height: 844 }, 'card');
    expect(mobile).toContain('bj-arc--player-boxes');
    expect(mobile).toContain('bj-table-slot-row');
    expect(mobile.match(/aria-label="(?:Join )?[Bb]ox \d/g)?.length ?? 0).toBe(4);
  });

  it('mobile landscape uses shared shell tokens and compresses felt height', () => {
    expect(sharedCss).toContain(MOBILE_LAYOUT_MEDIA);
    expect(sharedCss).toMatch(
      /@media \(orientation: landscape\)[\s\S]*--bj-mobile-felt-min-height:\s*0/,
    );
    expect(panelCss).toMatch(
      /@media \(max-width: 720px\) and \(orientation: landscape\)[\s\S]*pointer: coarse\)/,
    );
  });

  it('mobile Full Table arc fits shell without inner horizontal scroll', () => {
    expect(panelCss).toContain('contract: mobile-arc-fit');
    const playerRowCss = readCss('src/styles/bj-player-row-layout.css');
    expect(playerRowCss).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell[\s\S]*overflow:\s*visible/,
    );
    expect(panelCss).not.toMatch(/\.bj-view-full-mobile \.bj-arc[\s\S]*min-width:\s*calc\(100% \+ 2\.5rem\)/);
  });
});

describe('mobile landscape layout source of truth', () => {
  const sharedCss = readCss('src/styles/bj-table-shared.css');

  it('keeps mobile classification when landscape width exceeds 720px', () => {
    const landscapePhone = renderAt({ width: 844, height: 390 }, 'card');
    expect(landscapePhone).toContain('bj-view-card-mobile');
    expect(landscapePhone).toContain('data-device-view="mobile"');
    expect(landscapePhone).not.toContain('bj-view-card-desktop');
  });

  it('Card View and Full Table landscape render chip tray in mobile shell', () => {
    const card = renderAt({ width: 844, height: 390 }, 'card');
    const full = renderAt({ width: 844, height: 390 }, 'full');
    expect(card).toContain(TABLE_UX.tableZoneBottom);
    expect(card).toContain('bj-value-chips');
    expect(card).toContain('chip-tray');
    expect(full).toContain('bj-casino__tray-wrap');
    expect(full).toContain('bj-value-chips');
  });

  it('shared CSS pins chip tray with flex-shrink and flexible card grid rows', () => {
    expect(sharedCss).toMatch(
      /\.bj-view-full-mobile \.bj-casino__tray-wrap[\s\S]*flex-shrink:\s*0|\.bj-view-card-mobile \.bj-casino__tray-wrap[\s\S]*flex-shrink:\s*0/,
    );
    expect(sharedCss).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*height:\s*var\(--bj-zone-tray-height\)/,
    );
    expect(sharedCss).toContain(MOBILE_LAYOUT_MEDIA);
  });

  it('landscape overlay sheet leaves room to dismiss and see table', () => {
    expect(sharedCss).toMatch(
      /\.bj-casino__mobile-panel-sheet[\s\S]*max-height:\s*min\(72dvh/,
    );
  });
});
