import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';
import { MOBILE_LAYOUT_MEDIA } from '../styles/mobileLayoutContract';
import {
  createMobileLayoutMatchMedia,
  type SimulatedViewport,
} from '../test/mobileLayoutMatchMedia';

const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const INDEX_CSS = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const DEBUG_SRC = readFileSync(join(process.cwd(), 'src/components/blackjackLayoutDebug.ts'), 'utf8');

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

function renderMobilePanel(state: GameState): string {
  simulatedViewport = { width: 390, height: 844 };
  return renderToStaticMarkup(
    <BlackjackPanel gameState={{ ...state, tableViewMode: 'full' }} onGameStateChange={noop} />,
  );
}

describe('canonical player row layout engine', () => {
  it('imports shared player row CSS after table shared CSS', () => {
    expect(INDEX_CSS.indexOf('bj-table-shared.css')).toBeLessThan(INDEX_CSS.indexOf('bj-player-row-layout.css'));
  });

  it('uses one flat bj-table-slot-row for player boxes on all viewports', () => {
    expect(PANEL_SRC).toContain('bj-table-slot-row');
    expect(PANEL_SRC).toContain('bj-table-slot-row--with-add');
    expect(PANEL_SRC).not.toMatch(/deviceView === 'mobile' \? addBoxButton : null/);
    expect(PANEL_SRC).not.toMatch(/deviceView !== 'mobile' \? addBoxButton : null/);
    expect(PANEL_SRC).not.toMatch(/renderPlayerBoxesArc\(\)[\s\S]{0,800}bj-arc--rtl/);
  });

  it('defines canonical grid row with slot-count columns and optional add column', () => {
    expect(PLAYER_ROW_CSS).toMatch(/\.bj-table-slot-row \{[\s\S]*display:\s*grid/);
    expect(PLAYER_ROW_CSS).toMatch(
      /grid-template-columns:\s*repeat\(var\(--slot-count,\s*4\),\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-slot-row--with-add[\s\S]*grid-template-columns:\s*auto repeat\(var\(--slot-count,\s*4\),\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(PLAYER_ROW_CSS).toMatch(/gap:\s*var\(--bj-table-slot-row-gap\)/);
    expect(PLAYER_ROW_CSS).toContain('clamp(4px, 1.2vw, 8px)');
  });

  it('renders + as first DOM child before player box slots', () => {
    const html = renderMobilePanel(tableAfterStartPlaying(500));
    expect(html).toContain('bj-table-slot-row');
    expect(html).toContain('bj-table-slot-row__add');
    const rowStart = html.indexOf('bj-table-slot-row bj-arc bj-arc--player-boxes');
    expect(rowStart).toBeGreaterThan(-1);
    const rowSlice = html.slice(rowStart, rowStart + 1200);
    const addIdx = rowSlice.indexOf('bj-table-slot-row__add');
    const slotIdx = rowSlice.indexOf('bj-arc__slot');
    expect(addIdx).toBeGreaterThan(-1);
    expect(slotIdx).toBeGreaterThan(addIdx);
  });

  it('neutralizes pill/dot compression on player box tiles inside slot row', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*width:\s*100%[\s\S]*min-width:\s*0[\s\S]*aspect-ratio:\s*1\.05 \/ 1[\s\S]*transform:\s*none[\s\S]*overflow:\s*visible/,
    );
    expect(SHARED_CSS).not.toMatch(/@media \(max-width: 480px\)[\s\S]*\.bj-arc--player-boxes \.bj-arc__slot[\s\S]*width:\s*var\(--bj-full-table-box-width\)/);
  });

  it('keeps tray and player row as separate visible flow zones on mobile', () => {
    expect(PLAYER_ROW_CSS).toContain(MOBILE_LAYOUT_MEDIA);
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*overflow:\s*visible/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*overflow:\s*visible/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*position:\s*static/,
    );
    expect(PLAYER_ROW_CSS).not.toMatch(/translateY\(/);
    expect(PLAYER_ROW_CSS).not.toMatch(/margin-top:\s*-/);
  });

  it('uses same slot row class for Full Table cards arc', () => {
    expect(PANEL_SRC).toMatch(
      /className=\{\['bj-table-slot-row',\s*'bj-arc',\s*'bj-arc--cards'/,
    );
  });

  it('exposes debug version mobile-box-tray-final-2 with overlap diagnostics', () => {
    expect(DEBUG_SRC).toContain("BLACKJACK_UI_FIX_VERSION = 'mobile-box-tray-final-2'");
    expect(DEBUG_SRC).toContain('trayOverlapsPlayerRow');
    expect(DEBUG_SRC).toContain('trayOverflowChain');
  });
});

describe('player row layout — jsdom computed style smoke', () => {
  it('reports grid display for slot row when stylesheets are loaded', () => {
    if (typeof document === 'undefined') {
      return;
    }
    const style = document.createElement('style');
    style.textContent = PLAYER_ROW_CSS;
    document.head.appendChild(style);

    const row = document.createElement('div');
    row.className = 'bj-table-slot-row bj-arc bj-arc--player-boxes bj-arc--visible-4 bj-table-slot-row--with-add';
    row.style.setProperty('--slot-count', '4');
    document.body.appendChild(row);

    const computed = window.getComputedStyle(row);
    expect(computed.display).toBe('grid');
    expect(computed.gridTemplateColumns).toContain(' ');

    document.body.removeChild(row);
    document.head.removeChild(style);
  });
});
