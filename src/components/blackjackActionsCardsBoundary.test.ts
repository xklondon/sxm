import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const SHELL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');
const CARD_AREA_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');

const VIEW_ROOTS = [
  '.bj-view-card-desktop',
  '.bj-view-full-desktop',
  '.bj-view-card-mobile',
  '.bj-view-full-mobile',
] as const;

function shellRenderBlock(): string {
  return SHELL_SRC.match(/return \(\s*[\s\S]*?\n  \);/)?.[0] ?? '';
}

function shellCardsGapBlock(): string {
  const start = SHELL_CSS.indexOf('.bj-table-layout-shell > .bj-table-zone--cards');
  return start >= 0 ? SHELL_CSS.slice(start, start + 280) : '';
}

describe('blackjack canonical shell order — Dealer → Command → Cards → Actions', () => {
  it('renders shell zones in canonical DOM order', () => {
    const render = shellRenderBlock();
    const dealerIdx = render.indexOf('{dealer}');
    const commandIdx = render.indexOf('BlackjackCommandZone');
    const cardsIdx = render.indexOf('BlackjackCardsAreaZone');
    const actionsIdx = render.indexOf('BlackjackActionsZone');
    const boxesIdx = render.indexOf('BlackjackPlayerBoxesZone');
    const trayIdx = render.indexOf('{chipTray}');
    expect(dealerIdx).toBeGreaterThan(-1);
    expect(dealerIdx).toBeLessThan(commandIdx);
    expect(commandIdx).toBeLessThan(cardsIdx);
    expect(cardsIdx).toBeLessThan(actionsIdx);
    expect(actionsIdx).toBeLessThan(boxesIdx);
    expect(boxesIdx).toBeLessThan(trayIdx);
  });

  it('places command directly after dealer zone in desktop grid', () => {
    const desktop = SHELL_CSS;
    expect(desktop).toMatch(/\[dealer\][\s\S]*\[command\][\s\S]*\[cards\][\s\S]*\[actions\]/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*grid-row:\s*command/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*grid-row:\s*actions/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*grid-row:\s*cards/);
  });

  it('keeps Command→Cards gap smaller than Cards→Actions gap', () => {
    const cards = shellCardsGapBlock();
    expect(SHELL_CSS).toContain('--bj-command-cards-gap: 0.08rem');
    expect(SHARED_CSS).toContain('--bj-dealer-command-gap: 0.08rem');
    expect(SHELL_CSS).toContain('--bj-cards-actions-gap: var(--bj-desktop-actions-zone-padding-top)');
    expect(cards).toMatch(/margin:\s*var\(--bj-command-cards-gap\)/);
    expect(SHELL_CSS).toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*padding-top:\s*var\(--bj-desktop-dealer-command-gap\)/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*padding-top:\s*var\(--bj-desktop-actions-zone-padding-top\)/,
    );
  });

  it('anchors compact action panel below cards without overlapping player boxes', () => {
    expect(SHELL_CSS).toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*justify-content:\s*flex-start/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions[\s\S]*max-height:\s*var\(--bj-actions-panel-compact-max-height\)/,
    );
    expect(SHELL_CSS).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*z-index:\s*3/);
    expect(SHELL_CSS).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*z-index:\s*5/);
    expect(SHELL_CSS).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*z-index:\s*6/);
  });

  it('reveals hero card tops in Card View cards zone', () => {
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__play-area[\s\S]*justify-content:\s*flex-start/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards-slot[\s\S]*align-items:\s*flex-start/,
    );
    for (const view of VIEW_ROOTS) {
      expect(SHARED_CSS).toContain(view);
    }
  });

  it('keeps Full Table card stacks bottom-aligned', () => {
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*justify-content:\s*flex-end/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-full-table-card-area[\s\S]*align-items:\s*end/,
    );
  });
});
