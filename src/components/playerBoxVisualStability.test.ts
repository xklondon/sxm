import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const SUMMARY_CSS = readFileSync(join(process.cwd(), 'src/components/RoundSummaryOverlay.css'), 'utf8');

describe('player box visual stability contract', () => {
  it('locks player box shell height across selection, stake, and semantic states', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc[\s\S]*height:\s*var\(--bj-full-table-box-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc\.bj-phone-view__bet-chip--pulse[\s\S]*height:\s*var\(--bj-full-table-box-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--has-stake[\s\S]*height:\s*var\(--bj-full-table-box-height\)/,
    );
  });

  it('uses pulse/glow only for selected state inside player boxes', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc\.bj-box--selected[\s\S]*box-shadow:\s*none/,
    );
    expect(SHARED_CSS).toMatch(/@keyframes bj-bet-pulse[\s\S]*inset 0 0 0 2px/);
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc\.bj-phone-view__bet-chip--pulse[\s\S]*transform:\s*none/,
    );
  });

  it('reserves fixed stake slot space without inner frame chrome', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc \.bj-phone-view__mini-stake-slot[\s\S]*height:\s*var\(--bj-full-table-stake-min-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc \.bj-phone-view__mini-stake-slot[\s\S]*overflow:\s*hidden/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-bet-zone[\s\S]*border:\s*none[\s\S]*max-height:\s*var\(--bj-full-table-stake-min-height\)/,
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
    expect(SHARED_CSS).toContain('--bj-desktop-zone-boxes-tray-gap: 1.85rem');
    expect(SHARED_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*margin-top:\s*var\(--bj-desktop-zone-boxes-tray-gap\)/,
    );
    expect(SHARED_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*--bj-zone-boxes-tray-gap:\s*0\.85rem/,
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
