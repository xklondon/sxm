import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const SUMMARY_CSS = readFileSync(join(process.cwd(), 'src/components/RoundSummaryOverlay.css'), 'utf8');

describe('player box visual stability contract', () => {
  it('locks player box shell height across selection, stake, and semantic states on desktop', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*height:\s*var\(--bj-full-table-box-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc[\s\S]*height:\s*var\(--bj-full-table-box-height\)/,
    );
  });

  it('uses pulse/glow only for selected state inside player boxes', () => {
    expect(PLAYER_ROW_CSS).toContain(
      '.bj-player-box-mobile.bj-box--selected.bj-phone-view__bet-chip--pulse',
    );
    expect(PLAYER_ROW_CSS).toContain(
      '.bj-player-box-mobile.bj-phone-view__bet-chip--pulse:not(.bj-box--selected)',
    );
    expect(PLAYER_ROW_CSS).toContain('animation: bj-bet-pulse');
    expect(PLAYER_ROW_CSS).toContain('animation: none');
    expect(SHARED_CSS).toMatch(/@keyframes bj-bet-pulse[\s\S]*inset 0 0 0 2px/);
  });

  it('reserves stake slot space in shared player row layout', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*\.bj-phone-view__mini-stake-slot[\s\S]*overflow:\s*visible/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-bet-zone[\s\S]*min-height:\s*var\(--bj-full-table-stake-min-height\)/,
    );
  });

  it('hides Leave button from player box display', () => {
    expect(SHARED_CSS).toMatch(/\.bj-arc--player-boxes \.bj-arc__leave[\s\S]*display:\s*none/);
    expect(PANEL_SRC).not.toMatch(/className="bj-arc__leave"/);
  });

  it('neutralizes slot wrapper chrome so mini-hand is the sole frame', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-arc__slot--owned[\s\S]*border:\s*none[\s\S]*box-shadow:\s*none/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-arc__slot--empty[\s\S]*border:\s*none/,
    );
  });

  it('separates desktop chip tray from player boxes without mobile regression', () => {
    expect(SHARED_CSS).toContain('--bj-desktop-zone-boxes-tray-gap: 1.1rem');
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*margin-top:\s*var\(--bj-zone-boxes-tray-gap\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*margin-top:\s*var\(--bj-zone-boxes-tray-gap\)/,
    );
  });
});

describe('mobile player box visual stability contract', () => {
  it('uses canonical slot row grid for mobile player boxes', () => {
    expect(PLAYER_ROW_CSS).toMatch(/\.bj-table-slot-row \{[\s\S]*display:\s*grid/);
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*minmax\(0,\s*1fr\)/,
    );
  });

  it('locks mobile portrait player box dimensions via aspect-ratio inside slot row', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*aspect-ratio:\s*1\.05 \/ 1/,
    );
    expect(PLAYER_ROW_CSS).toContain('.bj-table-slot-row.bj-arc--player-boxes .bj-player-box-mobile');
  });

  it('keeps stake slot visible inside slot row boxes', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*\.bj-phone-view__mini-stake-slot[\s\S]*overflow:\s*visible/,
    );
  });

  it('does not use 480px fixed slot width override', () => {
    expect(SHARED_CSS).not.toMatch(
      /@media \(max-width: 480px\)[\s\S]*\.bj-view-full-mobile \.bj-arc--player-boxes \.bj-arc__slot[\s\S]*var\(--bj-full-table-box-width\)/,
    );
  });

  it('uses inset glow for selected player boxes in slot row', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*\.bj-box--selected[\s\S]*box-shadow:\s*inset 0 0 0 2px/,
    );
  });
});

describe('mobile round summary overlay fit', () => {
  it('caps overlay height to viewport and scrolls list internally', () => {
    expect(SUMMARY_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.bj-round-summary-overlay \.invite-modal\.bj-round-summary[\s\S]*max-height:\s*calc\(100dvh/,
    );
    expect(SUMMARY_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.bj-round-summary__list[\s\S]*overflow-y:\s*auto/,
    );
    expect(SUMMARY_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.bj-round-summary__actions[\s\S]*flex-shrink:\s*0/,
    );
    expect(SUMMARY_CSS).toMatch(/env\(safe-area-inset-bottom/);
  });
});
