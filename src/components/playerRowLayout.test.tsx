import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';
import { MOBILE_LAYOUT_MEDIA, MOBILE_LAYOUT_MEDIA_LANDSCAPE } from '../styles/mobileLayoutContract';
import {
  createMobileLayoutMatchMedia,
  type SimulatedViewport,
} from '../test/mobileLayoutMatchMedia';

const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const CARD_AREA_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const SHELL_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-blackjack-table-shell.css'), 'utf8');
const INDEX_CSS = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const DEBUG_SRC = readFileSync(join(process.cwd(), 'src/components/blackjackLayoutDebug.ts'), 'utf8');

function extractAllMediaBlocks(css: string, mediaQuery: string): string {
  const marker = `@media ${mediaQuery}`;
  const blocks: string[] = [];
  let searchFrom = 0;
  while (searchFrom < css.length) {
    const start = css.indexOf(marker, searchFrom);
    if (start === -1) break;
    let depth = 0;
    const braceStart = css.indexOf('{', start);
    if (braceStart === -1) break;
    let closedAt = -1;
    for (let i = braceStart; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          closedAt = i + 1;
          break;
        }
      }
    }
    if (closedAt === -1) break;
    blocks.push(css.slice(start, closedAt));
    searchFrom = closedAt;
  }
  return blocks.join('\n');
}

const DESKTOP_MIN_WIDTH_CSS = extractAllMediaBlocks(PLAYER_ROW_CSS, '(min-width: 721px)');
const MOBILE_PORTRAIT_CSS = extractAllMediaBlocks(
  PLAYER_ROW_CSS,
  '(max-width: 720px) and (orientation: portrait)',
);

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
  it('imports shared player row CSS after table shared CSS and before card-area contract', () => {
    expect(INDEX_CSS.indexOf('bj-table-shared.css')).toBeLessThan(INDEX_CSS.indexOf('bj-player-row-layout.css'));
    expect(INDEX_CSS.indexOf('bj-player-row-layout.css')).toBeLessThan(
      INDEX_CSS.indexOf('bj-full-table-card-area.css'),
    );
  });

  it('uses one flat bj-table-slot-row for player boxes on all viewports', () => {
    expect(PANEL_SRC).toContain('bj-table-slot-row');
    expect(PANEL_SRC).toContain('bj-table-slot-row--with-add');
    expect(PANEL_SRC).not.toMatch(/deviceView === 'mobile' \? addBoxButton : null/);
    expect(PANEL_SRC).not.toMatch(/deviceView !== 'mobile' \? addBoxButton : null/);
    expect(PANEL_SRC).not.toMatch(/renderPlayerBoxesArc\(\)[\s\S]{0,800}bj-arc--rtl/);
  });

  it('defines responsive player-box sizing contracts per viewport', () => {
    expect(PLAYER_ROW_CSS).toMatch(/\.bj-table-slot-row \{[\s\S]*display:\s*grid/);
    expect(PLAYER_ROW_CSS).toMatch(/SIZING CONTRACTS/);
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*grid-template-columns:\s*repeat\(var\(--slot-count,\s*4\),\s*minmax\(0,\s*max-content\)\)/,
    );
    expect(PLAYER_ROW_CSS).toContain(
      '.bj-view-full-desktop .bj-table-slot-row.bj-arc--player-boxes .bj-phone-view__mini-hand--full-arc',
    );
    expect(PLAYER_ROW_CSS).toMatch(/CONTRACT D — mobile landscape compact horizontal row/);
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*minmax\(0,\s*1fr\)/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row--with-add\.bj-arc--player-boxes[\s\S]*repeat\(calc\(var\(--slot-count,\s*4\) \+ 1\),\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(PLAYER_ROW_CSS).toMatch(/gap:\s*var\(--bj-table-slot-row-gap\)/);
    expect(PLAYER_ROW_CSS).toContain('clamp(4px, 1.2vw, 8px)');
    expect(PLAYER_ROW_CSS).toContain(MOBILE_LAYOUT_MEDIA_LANDSCAPE.split(',')[0]!.trim());
  });

  it('desktop compact row uses fixed box-width spread and shell slot alignment (not mobile 1fr stretch)', () => {
    expect(DESKTOP_MIN_WIDTH_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--player-boxes,\s*\n[\s\S]*?grid-template-columns:\s*repeat\(var\(--slot-count,\s*4\),\s*var\(--bj-full-table-box-width\)\)/,
    );
    expect(DESKTOP_MIN_WIDTH_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*minmax\(0,\s*1fr\)/,
    );
    const spreadPlayerBoxes = DESKTOP_MIN_WIDTH_CSS.match(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--player-boxes,\s*\n[\s\S]*?grid-template-columns:\s*repeat\(var\(--slot-count,\s*4\),\s*var\(--bj-full-table-box-width\)\)/,
    )?.[0] ?? '';
    expect(spreadPlayerBoxes).not.toMatch(/minmax\(0,\s*1fr\)/);
  });

  it('desktop card columns share Full Table spread grid geometry with player boxes', () => {
    expect(DESKTOP_MIN_WIDTH_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--cards[\s\S]*var\(--bj-full-table-box-width\)/,
    );
    expect(DESKTOP_MIN_WIDTH_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row--with-add\.bj-arc--cards[\s\S]*var\(--bj-table-slot-add-size\)/,
    );
    expect(DESKTOP_MIN_WIDTH_CSS).toMatch(/\.bj-table-slot-row__lead-spacer/);
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-table-layout-shell[\s\S]*\.bj-table-zone--cards[\s\S]*\.bj-table-slot-row\.bj-arc--cards[\s\S]*minmax\(0,\s*1fr\)/,
    );
    expect(DESKTOP_MIN_WIDTH_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*minmax\(0,\s*1fr\)/,
    );
  });

  it('mobile equal-column behavior is scoped to portrait media query only', () => {
    expect(MOBILE_PORTRAIT_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*minmax\(0,\s*1fr\)/,
    );
    expect(MOBILE_PORTRAIT_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row--with-add\.bj-arc--player-boxes[\s\S]*minmax\(0,\s*1fr\)/,
    );
    expect(DESKTOP_MIN_WIDTH_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*minmax\(0,\s*1fr\)/,
    );
  });

  it('desktop compact row uses max-content columns and fixed add width', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-slot-row--with-add\.bj-arc--player-boxes[\s\S]*grid-template-columns:\s*var\(--bj-table-slot-add-size\) repeat/,
    );
    expect(PLAYER_ROW_CSS).toMatch(/\.bj-table-slot-row__add[\s\S]*width:\s*var\(--bj-table-slot-add-size\)/);
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-table-slot-row__add[\s\S]*min-height:\s*calc\(var\(--bj-full-table-box-height\)/,
    );
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

  it('aligns owned Box 1 with empty boxes via shared value band and flex-start', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes > \.bj-arc__slot--owned[\s\S]*justify-content:\s*flex-start/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes > \.bj-arc__slot--empty::before[\s\S]*--bj-box-value-band-height/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc\.bj-box--native-assigned[\s\S]*aspect-ratio:\s*1\.05 \/ 1/,
    );
  });

  it('sizes add + as plus-only in the same grid cell as player boxes', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row__add[\s\S]*width:\s*100%/,
    );
    expect(PLAYER_ROW_CSS).toMatch(/\.bj-table-slot-row__add[\s\S]*background:\s*transparent/);
    expect(PLAYER_ROW_CSS).toMatch(/\.bj-table-slot-row__add[\s\S]*border:\s*none/);
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row__add::after[\s\S]*content:\s*'\+'/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row__add::after[\s\S]*aspect-ratio:\s*1\.05 \/ 1/,
    );
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row__add::after\s*\{[^}]*align-self:\s*end/,
    );
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-table-slot-row__add[\s\S]*min-height:\s*calc\(var\(--bj-full-table-box-height\)/,
    );
  });

  it('neutralizes pill/dot compression on mobile portrait player box tiles', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*width:\s*100%[\s\S]*min-width:\s*0[\s\S]*aspect-ratio:\s*1\.05 \/ 1[\s\S]*transform:\s*none[\s\S]*overflow:\s*visible/,
    );
    expect(SHARED_CSS).not.toMatch(/@media \(max-width: 480px\)[\s\S]*\.bj-arc--player-boxes \.bj-arc__slot[\s\S]*width:\s*var\(--bj-full-table-box-width\)/);
  });

  it('keeps tray and player row as separate visible flow zones on mobile', () => {
    // Mobile boxes/tray zone placement + overflow are owned by the shell grid engine
    // (consolidated from bj-player-row-layout.css in the Table Layout Engine pass).
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--boxes,[\s\S]*?overflow:\s*visible/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--bottom,[\s\S]*?overflow:\s*visible/,
    );
    // Boxes + tray are separate grid rows (no overlap), with no zone movers anywhere.
    expect(SHELL_CSS).toMatch(/> \.bj-table-zone--boxes,[\s\S]*?grid-row:\s*boxes/);
    expect(SHELL_CSS).toMatch(/> \.bj-table-zone--bottom,[\s\S]*?grid-row:\s*tray/);
    // bj-player-row-layout.css must not move the boxes/tray zones.
    expect(PLAYER_ROW_CSS).toContain(MOBILE_LAYOUT_MEDIA);
    expect(PLAYER_ROW_CSS).not.toMatch(/translateY\(/);
    expect(PLAYER_ROW_CSS).not.toMatch(/margin-top:\s*-/);
    expect(PLAYER_ROW_CSS).not.toMatch(/\.bj-table-zone--(?:boxes|bottom)[\s\S]{0,200}margin-top:\s*auto/);
  });

  it('uses same slot row class for Full Table cards arc', () => {
    expect(PANEL_SRC).toMatch(
      /className=\{\[[\s\S]*'bj-table-slot-row'[\s\S]*'bj-arc--cards'/,
    );
  });

  it('exposes debug version render-route-canonical-1 with overlap diagnostics', () => {
    expect(DEBUG_SRC).toContain("BLACKJACK_UI_FIX_VERSION = 'render-route-canonical-1'");
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
