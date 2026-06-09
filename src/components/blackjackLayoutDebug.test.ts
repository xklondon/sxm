import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isBlackjackLayoutDebugEnabled } from './blackjackLayoutDebug';
import { TABLE_UX } from './tableUxContract';

const SHELL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const DEBUG_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-layout-debug.css'), 'utf8');
const INDEX_CSS = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const DEBUG_SRC = readFileSync(join(process.cwd(), 'src/components/blackjackLayoutDebug.ts'), 'utf8');

function shellRenderBlock(): string {
  return SHELL_SRC.match(/return \(\s*[\s\S]*?\n  \);/)?.[0] ?? '';
}

describe('blackjack layout debug overlay', () => {
  it('is disabled by default and only enables with ?layoutDebug=1', () => {
    expect(DEBUG_SRC).toContain('BLACKJACK_LAYOUT_DEBUG_FORCE = false');
    expect(isBlackjackLayoutDebugEnabled('')).toBe(false);
    expect(isBlackjackLayoutDebugEnabled('?foo=1')).toBe(false);
    expect(isBlackjackLayoutDebugEnabled('?layoutDebug=0')).toBe(false);
    expect(isBlackjackLayoutDebugEnabled('?layoutDebug=1')).toBe(true);
    expect(isBlackjackLayoutDebugEnabled('?view=card&layoutDebug=1')).toBe(true);
  });

  it('wires debug class only when layoutDebug prop is true', () => {
    expect(SHELL_SRC).toContain('layoutDebug?: boolean');
    expect(SHELL_SRC).toContain('layoutDebug ? TABLE_UX.layoutDebug');
    expect(SHELL_SRC).toContain('data-layout-debug={layoutDebug ? \'1\' : undefined}');
    expect(PANEL_SRC).toContain('isBlackjackLayoutDebugEnabled');
    expect(PANEL_SRC).toContain('layoutDebug={layoutDebug}');
    expect(PANEL_SRC).not.toContain('layoutDebug={true}');
  });

  it('renders zone labels only under the debug class', () => {
    expect(INDEX_CSS).toContain('bj-layout-debug.css');
    expect(DEBUG_CSS).toMatch(/\.bj-layout-debug\.bj-table-layout-shell > \.bj-table-zone--dealer::before/);
    expect(DEBUG_CSS).toContain("content: '2 · command / status'");
    expect(DEBUG_CSS).toContain("content: '3 · actions (HIT/STAY)'");
    expect(DEBUG_CSS).toContain("content: '4 · hero / cards'");
    expect(DEBUG_CSS).toContain("content: '0 · header'");
    expect(DEBUG_CSS).not.toMatch(/^\.bj-table-zone--actions::before/m);
    expect(TABLE_UX.layoutDebug).toBe('bj-layout-debug');
  });
});

describe('canonical blackjack zone order and separation', () => {
  it('keeps DOM order dealer → command → actions → hero → boxes → tray', () => {
    const render = shellRenderBlock();
    const dealerIdx = render.indexOf('{dealer}');
    const commandIdx = render.indexOf('BlackjackCommandZone');
    const actionsIdx = render.indexOf('BlackjackActionsZone');
    const cardsIdx = render.indexOf('BlackjackCardsAreaZone');
    const boxesIdx = render.indexOf('BlackjackPlayerBoxesZone');
    const trayIdx = render.indexOf('{chipTray}');
    expect(dealerIdx).toBeLessThan(commandIdx);
    expect(commandIdx).toBeLessThan(actionsIdx);
    expect(actionsIdx).toBeLessThan(cardsIdx);
    expect(cardsIdx).toBeLessThan(boxesIdx);
    expect(boxesIdx).toBeLessThan(trayIdx);
  });

  it('places command zone before actions in desktop grid rows', () => {
    const desktop = SHARED_CSS.slice(
      SHARED_CSS.indexOf('/* Desktop table shell — fixed CSS grid rows'),
      SHARED_CSS.indexOf('/* Desktop stage:', SHARED_CSS.indexOf('/* Desktop table shell — fixed CSS grid rows')),
    );
    expect(desktop).toMatch(/\[dealer\][\s\S]*\[command\][\s\S]*\[actions\][\s\S]*\[cards\]/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*grid-row:\s*command/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*grid-row:\s*actions/);
  });

  it('places HIT/STAY actions zone below command with safe hero gap', () => {
    expect(SHARED_CSS).toContain('--bj-dealer-command-gap: 0.08rem');
    expect(SHARED_CSS).toContain('--bj-command-actions-gap: 0.08rem');
    expect(SHARED_CSS).toContain('--bj-actions-cards-safe-gap: 0.75rem');
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--summary[\s\S]*padding[^;]*var\(--bj-dealer-command-gap\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions[\s\S]*padding-top:\s*var\(--bj-command-actions-gap\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards[\s\S]*margin-top:\s*var\(--bj-actions-cards-safe-gap\)/,
    );
    expect(CARD_VIEW_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--actions \.bj-table-actions > \.bj-table-actions__row:first-child[\s\S]*display:\s*none/,
    );
  });

  it('keeps hero card tops visible with top-aligned fan and inset', () => {
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards-slot[\s\S]*align-items:\s*flex-start/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards--fan[\s\S]*align-items:\s*flex-start/,
    );
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__play-area--controls \.bj-phone-view__hero-center[\s\S]*align-items:\s*center/,
    );
    expect(LAYOUT_CSS).not.toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*margin-top:\s*-/,
    );
  });

  it('shows Card View mobile cloth behind hero; desktop Card View still hides cloth', () => {
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*flex/,
    );
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
  });
});
