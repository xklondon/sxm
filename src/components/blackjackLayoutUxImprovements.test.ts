import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHELL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const STAKE_TSX = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.tsx'), 'utf8');
const STAKE_CSS = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.css'), 'utf8');

function shellRenderBlock(): string {
  return SHELL_SRC.match(/return \(\s*[\s\S]*?\n  \);/)?.[0] ?? '';
}

function desktopShellBlock(): string {
  const start = SHARED_CSS.indexOf('/* Desktop table shell — fixed CSS grid rows');
  const end = SHARED_CSS.indexOf('/* Desktop stage:', start);
  return start >= 0 && end > start ? SHARED_CSS.slice(start, end) : '';
}

describe('blackjack layout UX improvements', () => {
  describe('1 — HIT/STAY below Cards Area', () => {
    it('renders shell zones dealer → command → cards → actions → boxes → tray', () => {
      const render = shellRenderBlock();
      const order = [
        '{dealer}',
        'BlackjackCommandZone',
        'BlackjackCardsAreaZone',
        'BlackjackActionsZone',
        'BlackjackPlayerBoxesZone',
        '{chipTray}',
      ] as const;
      let last = -1;
      for (const token of order) {
        const idx = render.indexOf(token);
        expect(idx).toBeGreaterThan(-1);
        expect(idx).toBeGreaterThan(last);
        last = idx;
      }
    });

    it('places cards grid row before actions on desktop', () => {
      const desktop = desktopShellBlock();
      expect(desktop).toMatch(/\[dealer\][\s\S]*\[command\][\s\S]*\[cards\][\s\S]*\[actions\]/);
    });

    it('uses command→cards and cards→actions gap tokens', () => {
      expect(SHARED_CSS).toContain('--bj-command-cards-gap: 0.35rem');
      expect(SHARED_CSS).toContain('--bj-cards-actions-gap: 0.55rem');
      expect(SHARED_CSS).toMatch(
        /\.bj-table-layout-shell \.bj-table-zone--cards[\s\S]*margin-top:\s*var\(--bj-command-cards-gap\)/,
      );
      expect(SHARED_CSS).toMatch(
        /\.bj-table-layout-shell \.bj-table-zone--actions[\s\S]*padding-top:\s*var\(--bj-cards-actions-gap\)/,
      );
    });
  });

  describe('2 — Full Table per-box card columns', () => {
    it('renders arc card columns with box slot data and split mini-zones', () => {
      expect(PANEL_SRC).toContain('renderArcCardColumn');
      expect(PANEL_SRC).toContain('data-box-slot={slotNumber}');
      expect(PANEL_SRC).toContain('bj-arc__split-hands');
      expect(PANEL_SRC).toContain('getVisibleHandCardIds');
      expect(SHARED_CSS).toContain('.bj-arc__split-hands');
      expect(SHARED_CSS).toContain('.bj-arc__split-hand');
    });
  });

  describe('3 — four default boxes with adaptive arc sizing', () => {
    it('starts with four visible boxes and add-box control', () => {
      expect(PANEL_SRC).toContain('DEFAULT_VISIBLE_TABLE_BOXES');
      expect(PANEL_SRC).toContain('expandedVisibleBoxCount');
      expect(PANEL_SRC).toContain('bj-player-boxes-wrap__add');
      expect(PANEL_SRC).toContain('aria-label="Add player box"');
      expect(SHARED_CSS).toContain('.bj-arc--visible-4');
      expect(SHARED_CSS).toContain('.bj-arc--visible-7');
    });

    it('uses larger box tokens at 4 boxes than at 7 on desktop', () => {
      const four = SHARED_CSS.match(
        /@media \(min-width: 721px\)[\s\S]*\.bj-arc--visible-4\s*\{[\s\S]*?\}/,
      )?.[0] ?? '';
      const seven = SHARED_CSS.match(
        /@media \(min-width: 721px\)[\s\S]*\.bj-arc--visible-7\s*\{[\s\S]*?\}/,
      )?.[0] ?? '';
      expect(four).toContain('--bj-full-table-box-width');
      expect(four).toMatch(/\*\s*1\.22/);
      expect(seven).toContain('var(--bj-player-box-width)');
    });

    it('uses larger mobile box tokens at 4 boxes than at 7', () => {
      expect(SHARED_CSS).toMatch(
        /\.bj-arc--player-boxes\.bj-arc--visible-4[\s\S]*--bj-mobile-box-width:\s*6\.25rem/,
      );
      expect(SHARED_CSS).toMatch(
        /\.bj-arc--player-boxes\.bj-arc--visible-7[\s\S]*--bj-mobile-box-width:\s*3\.5rem/,
      );
    });

    it('avoids horizontal scroll on mobile table shell', () => {
      expect(SHARED_CSS).toMatch(/overflow-x:\s*hidden/);
    });
  });

  describe('4 — New Table compact UI', () => {
    it('applies compact class for staged new table flow', () => {
      expect(STAKE_TSX).toContain('table-stake-panel--compact');
      expect(STAKE_CSS).toContain('.table-stake-panel--compact');
      expect(STAKE_CSS).toMatch(/\.table-stake-panel--compact \.table-stake-panel__sub[\s\S]*display:\s*none/);
      expect(STAKE_CSS).toMatch(/\.table-stake-panel--compact \.table-stake-panel__select-btn[\s\S]*font-size:\s*0\.78rem/);
      expect(STAKE_CSS).toMatch(/\.table-stake-panel--compact \.table-stake-panel__select-btn[\s\S]*background:\s*rgb\(8 22 16/);
    });

    it('keeps table name field and practice/challenge mode stage', () => {
      expect(STAKE_TSX).toContain('Table name');
      expect(STAKE_TSX).toContain("selectBlackjackMode('practice')");
      expect(STAKE_TSX).toContain("selectBlackjackMode('challenge')");
    });
  });

  describe('5 — mobile landscape Full Table fit', () => {
    it('uses landscape compact tokens and full viewport canvas height', () => {
      expect(SHARED_CSS).toMatch(
        /@media \(min-width: 721px\) and \(orientation: landscape\)[\s\S]*--bj-mobile-landscape-compact:\s*1/,
      );
      expect(SHARED_CSS).toMatch(
        /@media \(min-width: 721px\) and \(orientation: landscape\)[\s\S]*--bj-mobile-table-canvas-height:\s*min\([\s\S]*env\(safe-area-inset-bottom/,
      );
    });

    it('keeps chip tray padding above safe area in landscape', () => {
      expect(SHARED_CSS).toMatch(
        /@media \(min-width: 721px\) and \(orientation: landscape\)[\s\S]*--bj-zone-tray-padding-bottom:\s*max\(0\.55rem,\s*calc\(env\(safe-area-inset-bottom/,
      );
    });

    it('scopes landscape compact sizing to mobile views only', () => {
      expect(LAYOUT_CSS).toMatch(
        /\.bj-view-card-mobile[\s\S]*--bj-cardview-command-cards-gap/,
      );
      expect(SHARED_CSS).not.toMatch(
        /\.bj-view-full-desktop\s*\{[\s\S]*--bj-mobile-landscape-compact/,
      );
    });
  });
});
