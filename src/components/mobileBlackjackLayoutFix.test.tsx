import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { ValueAndChipsBar } from './ChipStack';
import { DEFAULT_TABLE_TRAY_LABEL } from '../types/tableFeltSkin';
import { tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';
import {
  createMobileLayoutMatchMedia,
  type SimulatedViewport,
} from '../test/mobileLayoutMatchMedia';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CHIP_CSS = readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

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

function mobileVisibleBlock(count: 4 | 5 | 6 | 7): string {
  const marker = `.bj-view-full-mobile .bj-arc--visible-${count},`;
  const start = SHARED_CSS.indexOf(marker);
  if (start < 0) return '';
  const end = SHARED_CSS.indexOf('\n  }\n', start);
  return end > start ? SHARED_CSS.slice(start, end) : SHARED_CSS.slice(start, start + 900);
}

describe('mobile blackjack layout fix', () => {
  describe('A — no horizontal scroll', () => {
    it('hides horizontal overflow on mobile table shell and view roots', () => {
      expect(SHARED_CSS).toMatch(
        /\.bj-view-full-mobile,\s*\n\s*\.bj-view-card-mobile[\s\S]*overflow-x:\s*hidden/,
      );
      expect(SHARED_CSS).toMatch(
        /\.bj-view-full-mobile \.bj-arc--player-boxes[\s\S]*max-width:\s*100%/,
      );
      expect(SHARED_CSS).not.toMatch(/--bj-cloth-mobile-width:\s*min\(118%/);
    });

    it('fits box width to slot count instead of fixed desktop widths on mobile', () => {
      expect(SHARED_CSS).toMatch(
        /\.bj-view-full-mobile \.bj-arc--player-boxes[\s\S]*--bj-full-table-box-width:\s*min\([\s\S]*var\(--slot-count/,
      );
      expect(SHARED_CSS).toMatch(
        /@media \(min-width: 721px\)[\s\S]*\.bj-arc--visible-4[\s\S]*--bj-full-table-box-width:/,
      );
    });
  });

  describe('B — adaptive box and card sizing', () => {
    it('defines mobile box tokens per visible count with 4 largest and 7 smallest', () => {
      const four = mobileVisibleBlock(4);
      const seven = mobileVisibleBlock(7);
      expect(four).toContain('--bj-mobile-box-width: 5.35rem');
      expect(four).toContain('--bj-mobile-box-card-scale: 1.12');
      expect(seven).toContain('--bj-mobile-box-width: 3.05rem');
      expect(seven).toContain('--bj-mobile-box-card-scale: 0.76');
      expect(5.35).toBeGreaterThan(3.05);
      expect(1.12).toBeGreaterThan(0.76);
    });

    it('scales mini player cards with box card scale token', () => {
      expect(SHARED_CSS).toMatch(
        /\.bj-view-full-mobile \.bj-phone-view__mini-hand-card-stack \.bj-phone-view__mini-card[\s\S]*--bj-mobile-box-card-scale/,
      );
    });

    it('reserves box top visibility without negative margin hacks', () => {
      expect(SHARED_CSS).toMatch(
        /\.bj-view-full-mobile \.bj-table-zone--boxes[\s\S]*overflow-y:\s*visible/,
      );
      expect(SHARED_CSS).toMatch(
        /\.bj-view-full-mobile \.bj-table-zone--boxes[\s\S]*padding-top:/,
      );
      const mobileBoxBlock = SHARED_CSS.slice(
        SHARED_CSS.indexOf('.bj-view-full-mobile .bj-arc--player-boxes .bj-player-box-mobile'),
        SHARED_CSS.indexOf('.bj-view-full-mobile .bj-arc--player-boxes .bj-player-box-mobile') + 1200,
      );
      expect(mobileBoxBlock).not.toMatch(/margin-top:\s*-/);
      expect(mobileBoxBlock).not.toMatch(/translateY\(/i);
    });
  });

  describe('C — add box + button', () => {
    it('renders inline + control with aria-label during betting', () => {
      const html = renderMobilePanel(tableAfterStartPlaying(500));
      expect(html).toContain('bj-player-boxes-wrap__add');
      expect(html).toContain('aria-label="Add player box"');
      expect(html).toContain('>+</button>');
      expect(html).toContain('bj-arc--visible-4');
    });

    it('wires + click to expand visible box count in panel source', () => {
      expect(PANEL_SRC).toContain('setExpandedVisibleBoxCount');
      expect(PANEL_SRC).toContain('canAddVisibleBox && inBetting');
    });
  });

  describe('D — mobile tray two-row layout', () => {
    it('uses row 1 for available + chips and row 2 for label only', () => {
      const html = renderToStaticMarkup(
        <ValueAndChipsBar
          available={500}
          showChips
          onChipClick={noop}
          trayLabel={DEFAULT_TABLE_TRAY_LABEL}
        />,
      );
      expect(html).toContain('bj-value-chips__row--main');
      expect(html).toContain('bj-value-chips__row--label');
      expect(html.indexOf('Available: 500')).toBeLessThan(html.indexOf(DEFAULT_TABLE_TRAY_LABEL));
      expect(CHIP_CSS).toMatch(
        /@media \(max-width: 720px\)[\s\S]*\.bj-view-full-mobile \.bj-value-chips[\s\S]*flex-direction:\s*column/,
      );
      expect(CHIP_CSS).toMatch(
        /\.bj-view-full-mobile \.bj-value-chips__row--main[\s\S]*flex-wrap:\s*nowrap/,
      );
    });

    it('keeps tray full width on mobile without horizontal overflow', () => {
      expect(SHARED_CSS).toMatch(
        /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--bottom \.bj-casino__tray-wrap[\s\S]*width:\s*100%/,
      );
    });
  });
});
