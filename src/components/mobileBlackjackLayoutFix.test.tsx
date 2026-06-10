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
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
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

function mobilePlayerBoxBlock(count: 4 | 5 | 6 | 7): string {
  const marker = `.bj-arc--player-boxes.bj-arc--visible-${count},`;
  const start = SHARED_CSS.indexOf(marker);
  if (start < 0) return '';
  const end = SHARED_CSS.indexOf('\n  }\n', start);
  return end > start ? SHARED_CSS.slice(start, end) : SHARED_CSS.slice(start, start + 900);
}

function mobileFullTableCardsBlock(count: 4 | 5 | 6 | 7): string {
  const marker = `.bj-view-full-mobile .bj-arc--cards.bj-arc--visible-${count}`;
  const start = SHARED_CSS.indexOf(marker);
  if (start < 0) return '';
  const end = SHARED_CSS.indexOf('\n  }\n', start);
  return end > start ? SHARED_CSS.slice(start, end) : SHARED_CSS.slice(start, start + 500);
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
        /\.bj-view-full-mobile \.bj-arc--player-boxes[\s\S]*--bj-full-table-box-width:\s*calc\([\s\S]*var\(--slot-count/,
      );
      expect(SHARED_CSS).toMatch(
        /@media \(min-width: 721px\)[\s\S]*\.bj-arc--visible-4[\s\S]*--bj-full-table-box-width:/,
      );
    });
  });

  describe('B — adaptive box and card sizing', () => {
    it('defines mobile box tokens per visible count with 4 largest and 7 smallest', () => {
      const four = mobilePlayerBoxBlock(4);
      const seven = mobilePlayerBoxBlock(7);
      expect(four).toContain('--bj-mobile-box-width: 6.25rem');
      expect(four).toContain('--bj-mobile-box-card-scale: 1.2');
      expect(seven).toContain('--bj-mobile-box-width: 3.5rem');
      expect(seven).toContain('--bj-mobile-box-card-scale: 0.84');
      expect(6.25).toBeGreaterThan(3.5);
      expect(1.2).toBeGreaterThan(0.84);
    });

    it('scales Full Table card tokens from box width and includes Card View mobile', () => {
      const four = mobileFullTableCardsBlock(4);
      const seven = mobileFullTableCardsBlock(7);
      expect(four).toContain('--bj-table-card-width: calc(var(--bj-full-table-box-width');
      expect(four).toContain('.bj-view-card-mobile .bj-arc--cards.bj-arc--visible-4');
      expect(seven).toContain('--bj-table-card-width: calc(var(--bj-full-table-box-width');
      expect(parseFloat(four.match(/\*\s*(0\.\d+)/)?.[1] ?? '0')).toBeGreaterThan(
        parseFloat(seven.match(/\*\s*(0\.\d+)/)?.[1] ?? '1'),
      );
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
    it('renders inline + control before player boxes on mobile during betting', () => {
      const html = renderMobilePanel(tableAfterStartPlaying(500));
      expect(html).toContain('bj-player-boxes-wrap__add');
      expect(html).toContain('aria-label="Add player box"');
      expect(html).toContain('bj-player-boxes-wrap__add--leading');
      expect(html).toContain('>+</button>');
      expect(html).toContain('bj-arc--visible-4');
      const addIdx = html.indexOf('bj-player-boxes-wrap__add');
      const arcIdx = html.indexOf('bj-arc--player-boxes');
      expect(addIdx).toBeGreaterThan(-1);
      expect(arcIdx).toBeGreaterThan(addIdx);
    });

    it('uses grid row with compact leading + button before boxes', () => {
      expect(SHARED_CSS).toMatch(
        /\.bj-view-full-mobile \.bj-player-boxes-wrap__row[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/,
      );
      expect(SHARED_CSS).toMatch(/--bj-mobile-add-button-width:\s*1\.5rem/);
      expect(SHARED_CSS).toMatch(/--bj-mobile-box-gap:\s*0\.03rem/);
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
      /\.bj-view-full-mobile \.bj-value-chips__stash[\s\S]*justify-content:\s*center/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-value-chips .chip-tray__chips[\s\S]*justify-content:\s*center/,
    );
    });

    it('keeps tray full width on mobile without horizontal overflow', () => {
      expect(SHARED_CSS).toMatch(
        /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--bottom \.bj-casino__tray-wrap[\s\S]*width:\s*100%/,
      );
    });

    it('reserves safe-area padding above browser chrome for mobile tray', () => {
      expect(SHARED_CSS).toMatch(
        /--bj-zone-tray-padding-bottom:\s*max\(0\.85rem,\s*calc\(env\(safe-area-inset-bottom/,
      );
      expect(CHIP_CSS).toMatch(
        /padding-bottom:\s*max\(0\.85rem,\s*calc\(env\(safe-area-inset-bottom/,
      );
    });

    it('does not force vertical overflow on mobile table shell', () => {
      expect(SHARED_CSS).toMatch(
        /--bj-mobile-table-canvas-height:\s*calc\([\s\S]*100svh[\s\S]*env\(safe-area-inset-top/,
      );
      expect(PANEL_CSS).toMatch(
        /\.bj-view-full-mobile,\s*\n\s*\.bj-view-card-mobile[\s\S]*max-height:\s*var\(--bj-mobile-table-canvas-height/,
      );
    });

    it('keeps stake chips visible inside mobile player boxes', () => {
      expect(SHARED_CSS).toMatch(
        /--bj-full-table-stake-min-height:\s*1\.15rem/,
      );
      expect(SHARED_CSS).toMatch(
        /\.bj-view-full-mobile \.bj-arc--player-boxes[\s\S]*overflow-y:\s*visible/,
      );
    });
  });

  describe('E — mobile action button integration', () => {
    it('uses compact casino-style hit/stand tokens in mobile actions zone', () => {
      expect(SHARED_CSS).toMatch(
        /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--actions \.ds-btn--hit[\s\S]*min-height:\s*1\.55rem/,
      );
      expect(SHARED_CSS).toMatch(
        /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--actions \.ds-btn--stand[\s\S]*border-radius:\s*0\.38rem/,
      );
    });
  });
});
