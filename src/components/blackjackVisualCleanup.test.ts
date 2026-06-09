import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const MAGIC8_CSS = readFileSync(join(process.cwd(), 'src/components/magic8/Magic8Ball.css'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const ACTION_PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackActionPanel.tsx'), 'utf8');
const DEALER_BLOCK_SRC = readFileSync(join(process.cwd(), 'src/components/DealerBlock.tsx'), 'utf8');

function desktopShellBlock(): string {
  const start = SHARED_CSS.indexOf('/* Desktop table shell — fixed CSS grid rows');
  const end = SHARED_CSS.indexOf('/* Desktop stage:', start);
  return start >= 0 && end > start ? SHARED_CSS.slice(start, end) : '';
}

describe('blackjack visual cleanup — cloth, player boxes, desktop tray', () => {
  it('uses balanced cloth title and red rule tokens within readable max values', () => {
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size: 104px');
    expect(FELT_CSS).toContain('--bj-cloth-insurance-font-size: 52px');
    expect(FELT_CSS).toContain('--bj-cloth-dealer-rule-font-size: var(--bj-cloth-insurance-font-size)');
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size-mobile: 88px');
    expect(FELT_CSS).toContain('--bj-cloth-insurance-font-size-mobile: 44px');
    expect(FELT_CSS).toMatch(
      /\.bj-felt-cloth-layer__title[\s\S]*font-size:\s*var\(--bj-cloth-title-font-size\)/,
    );
    expect(FELT_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.bj-felt-cloth-layer__title[\s\S]*var\(--bj-cloth-title-font-size-mobile\)/,
    );
    expect(FELT_CSS).toMatch(
      /\.bj-felt-cloth-layer__insurance[\s\S]*font-size:\s*var\(--bj-cloth-insurance-font-size\)/,
    );
    const titlePx = Number.parseInt(FELT_CSS.match(/--bj-cloth-title-font-size:\s*(\d+)px/)?.[1] ?? '0', 10);
    const insurancePx = Number.parseInt(
      FELT_CSS.match(/--bj-cloth-insurance-font-size:\s*(\d+)px/)?.[1] ?? '0',
      10,
    );
    const rulePx = Number.parseInt(
      FELT_CSS.match(/--bj-cloth-insurance-font-size:\s*(\d+)px/)?.[1] ?? '0',
      10,
    );
    expect(titlePx).toBeLessThanOrEqual(120);
    expect(insurancePx).toBeLessThanOrEqual(60);
    expect(rulePx).toBeLessThanOrEqual(60);
    expect(FELT_CSS).toMatch(
      /--bj-cloth-dealer-rule-font-size:\s*var\(--bj-cloth-insurance-font-size\)/,
    );
    expect(titlePx).toBeGreaterThan(insurancePx);
  });

  it('keeps cloth layer non-interactive and behind gameplay', () => {
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*pointer-events:\s*none/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*z-index:\s*0/);
  });

  it('neutralizes player box slot wrapper chrome', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-arc__slot--owned[\s\S]*border:\s*none[\s\S]*box-shadow:\s*none/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-arc__slot--empty[\s\S]*border:\s*none/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-bet-zone[\s\S]*border:\s*none[\s\S]*background:\s*transparent/,
    );
  });

  it('removes inner stake/bet frame inside owned player boxes', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc \.bj-phone-view__mini-stake-slot[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-stake-slot--reserved[\s\S]*opacity:\s*0/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-arc--player-boxes \.bj-arc__leave[\s\S]*display:\s*none/);
  });

  it('locks player box dimensions; selection adds pulse only', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc[\s\S]*height:\s*var\(--bj-full-table-box-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc\.bj-phone-view__bet-chip--pulse[\s\S]*transform:\s*none[\s\S]*height:\s*var\(--bj-full-table-box-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc\.bj-box--selected[\s\S]*box-shadow:\s*none/,
    );
    expect(SHARED_CSS).toMatch(/@keyframes bj-bet-pulse[\s\S]*inset 0 0 0 2px/);
  });

  it('uses one visible frame on player box mini-hand tiles', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc[\s\S]*box-shadow:\s*none/,
    );
  });

  it('keeps selected pulse visual-only without layout displacement', () => {
    expect(SHARED_CSS).toMatch(/@keyframes bj-bet-pulse[\s\S]*inset 0 0 0 2px/);
    expect(SHARED_CSS).not.toMatch(/@keyframes bj-bet-pulse[\s\S]*0 0 0 6px/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__bet-chip--pulse[\s\S]*transform:\s*none/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__bet-chip--pulse[\s\S]*margin:\s*0/);
    expect(SHARED_CSS).toMatch(/@keyframes bj-turn-pulse[\s\S]*inset 0 0 0/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand\.bj-box--turn[\s\S]*filter:\s*none/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand\.bj-box--turn[\s\S]*transform:\s*none/);
  });

  it('uses consistent ownership border width on mini-hand', () => {
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand\.bj-box--native-assigned[\s\S]*border:\s*1\.5px solid/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand\.bj-box--co-box[\s\S]*border:\s*1\.5px solid/);
  });

  it('adds desktop tray separation via margin and taller zone heights', () => {
    expect(SHARED_CSS).toContain('--bj-desktop-zone-boxes-height: 6.65rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-tray-height: 4.35rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-boxes-tray-gap: 1.1rem');
    expect(SHARED_CSS).toContain('--bj-desktop-grid-row-cards: minmax(0, 1fr)');
    expect(SHARED_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*--bj-zone-boxes-height:\s*var\(--bj-desktop-zone-boxes-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*margin-top:\s*var\(--bj-zone-boxes-tray-gap\)/,
    );
    expect(SHARED_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*--bj-zone-boxes-tray-gap:\s*var\(--bj-desktop-zone-boxes-tray-gap\)/,
    );
    expect(SHARED_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*overflow:\s*hidden/,
    );
    expect(SHARED_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*--bj-zone-boxes-tray-gap:\s*0\.85rem/,
    );
  });

  it('routes mobile Magic 8 response away from dealer centerline', () => {
    expect(MAGIC8_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.magic8-table-zone[\s\S]*flex-direction:\s*column/,
    );
    expect(MAGIC8_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.magic8-table-zone[\s\S]*max-width:\s*min\(36vw,\s*8\.75rem\)/,
    );
    expect(MAGIC8_CSS).toMatch(/\.magic8-table-zone[\s\S]*z-index:\s*2/);
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--dealer[\s\S]*z-index:\s*2/);
    expect(PANEL_CSS).toMatch(/\.bj-casino__felt > \.magic8-table-zone[\s\S]*pointer-events:\s*none/);
  });

  it('keeps Magic 8 response separate from command box styling', () => {
    expect(MAGIC8_CSS).toContain('.magic8-table-answer');
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__status/);
    expect(PANEL_CSS).not.toMatch(/magic8-table-answer/);
  });
});

describe('blackjack visual cleanup — command route and dealer/command grid', () => {
  it('mounts one canonical command route via BlackjackCommandBox with dealer omitCommand', () => {
    expect(PANEL_SRC).toContain('omitCommand');
    expect(PANEL_SRC).toContain('<BlackjackCommandBox');
    expect(PANEL_SRC.split('<BlackjackCommandBox').length - 1).toBe(1);
    expect(DEALER_BLOCK_SRC).toMatch(/omitCommand[\s\S]*!omitCommand \?/);
  });

  it('does not pass waitMessage into BlackjackActionPanel from Panel', () => {
    expect(PANEL_SRC).not.toMatch(/waitMessage=\{waitMessage\}/);
    expect(PANEL_SRC).not.toMatch(/BlackjackActionPanel[\s\S]*waitMessage/);
    expect(ACTION_PANEL_SRC).toContain('bj-table-actions__wait-msg');
  });

  it('assigns dealer and command to separate grid rows without z-index overlap hacks', () => {
    const desktop = desktopShellBlock();
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--dealer[\s\S]*grid-row:\s*dealer/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*grid-row:\s*command/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*padding-top:\s*var\(--bj-actions-command-gap\)/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*justify-content:\s*flex-start/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--dealer[\s\S]*z-index:\s*2/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*z-index:\s*3/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*z-index:\s*4/);
    expect(desktop).not.toMatch(/\.bj-table-layout-shell > \.bj-table-zone--dealer[\s\S]*margin-bottom:\s*-/);
    expect(desktop).not.toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*margin-top:\s*-/);
  });

  it('reserves taller dealer and command rows on desktop', () => {
    expect(SHARED_CSS).toContain('--bj-desktop-zone-dealer-height: 7.75rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-command-height: 4rem');
    const desktop = desktopShellBlock();
    expect(desktop).toContain('[dealer] var(--bj-desktop-zone-dealer-height)');
    expect(desktop).toContain('[command] var(--bj-desktop-zone-command-height)');
  });
});

describe('blackjack visual cleanup — Full Table and Card View player box parity', () => {
  it('bottom-aligns player boxes zone for both desktop view roots', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-zone--boxes[\s\S]*justify-content:\s*flex-end/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--boxes[\s\S]*justify-content:\s*flex-end/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*justify-content:\s*flex-end/,
    );
  });

  it('uses one shell-scoped player-box arc contract without per-view desktop overrides', () => {
    expect(PANEL_CSS).not.toMatch(/\.bj-view-full-desktop \.bj-arc--player-boxes/);
    expect(PANEL_CSS).not.toMatch(/\.bj-view-card-desktop \.bj-arc--player-boxes/);
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes \.bj-arc--player-boxes[\s\S]*margin-top:\s*0/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes \.bj-arc--player-boxes \.bj-arc__slot[\s\S]*width:\s*var\(--bj-player-box-width\)/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-arc--player-boxes\s*\{[\s\S]*padding:/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-card-desktop \.bj-arc--player-boxes\s*\{[\s\S]*padding:/,
    );
  });

  it('gives desktop arc slots the same overflow contract in Full Table and Card View', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc__slot,\s*\n\s*\.bj-view-card-desktop \.bj-arc__slot[\s\S]*overflow:\s*visible/,
    );
  });
});
