import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');

function desktopShellBlock(): string {
  const start = SHARED_CSS.indexOf('/* Desktop table shell — fixed CSS grid rows');
  const end = SHARED_CSS.indexOf('/* Desktop stage:', start);
  return start >= 0 && end > start ? SHARED_CSS.slice(start, end) : '';
}

describe('desktop canonical grid — Full Table and Card View parity', () => {
  it('defines one desktop zone height token set', () => {
    expect(SHARED_CSS).toContain('--bj-desktop-zone-dealer-height: 7.75rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-command-height: 4rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-command-gap: 0');
    expect(SHARED_CSS).toContain('--bj-command-actions-gap: 0.08rem');
    expect(SHARED_CSS).toContain('--bj-dealer-command-gap: 0.08rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-actions-height: 2.9rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-boxes-height: 6.65rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-tray-height: 4.35rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-boxes-tray-gap: 1.1rem');
    expect(SHARED_CSS).toContain('--bj-desktop-bottom-padding: 0.7rem');
    expect(SHARED_CSS).toContain('--bj-desktop-grid-row-cards: minmax(0, 1fr)');
    expect(SHARED_CSS).not.toContain('--bj-desktop-zone-cards-height: calc(');
  });

  it('uses CSS grid with fixed rows and one flexible CardsArea row on desktop', () => {
    const desktop = desktopShellBlock();
    expect(desktop).toMatch(/\.bj-table-layout-shell\s*\{[\s\S]*display:\s*grid/);
    expect(desktop).toContain('[dealer] var(--bj-desktop-zone-dealer-height)');
    expect(desktop).toContain('[command] var(--bj-desktop-zone-command-height)');
    expect(desktop).toContain('[actions] var(--bj-desktop-zone-actions-height)');
    expect(desktop).toContain('[cards] var(--bj-desktop-grid-row-cards)');
    expect(desktop).toContain('[boxes] var(--bj-desktop-zone-boxes-height)');
    expect(desktop).toContain('[tray] var(--bj-desktop-zone-tray-height)');
    expect(desktop).not.toContain('[gap-dc]');
    expect(desktop).not.toContain('[gap-ac]');
    expect(desktop).not.toContain('[gap-bt]');
  });

  it('assigns each shell zone to a grid row without vertical margin hacks', () => {
    const desktop = desktopShellBlock();
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--dealer[\s\S]*grid-row:\s*dealer/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*grid-row:\s*command/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*grid-row:\s*actions/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*grid-row:\s*cards/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*grid-row:\s*boxes/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--bottom[\s\S]*grid-row:\s*tray/);
    expect(desktop).not.toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*margin-top:/);
    expect(desktop).not.toMatch(/\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*margin-bottom:/);
    expect(desktop).not.toMatch(/\.bj-table-layout-shell > \.bj-table-zone--bottom[\s\S]*margin-top:/);
    expect(desktop).not.toMatch(/\.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*margin-top:\s*auto/);
  });

  it('keeps mobile flex shell with margin-top:auto on boxes', () => {
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell\s*\{[\s\S]*display:\s*flex/);
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*margin-top:\s*auto/,
    );
  });

  it('does not set per-view desktop outer zone heights', () => {
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--dealer\s*\{[\s\S]*height:/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-table-zone--dealer\s*\{[\s\S]*height:/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--boxes\s*\{[\s\S]*height:/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--cards\s*\{[\s\S]*height:/,
    );
  });

  it('contains hero and table card content inside CardsArea without overlap contracts', () => {
    expect(CARD_LAYOUT_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*overflow:\s*hidden/,
    );
    expect(CARD_LAYOUT_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table \.bj-arc--cards[\s\S]*overflow:\s*hidden/,
    );
  });

  it('ties cloth layer to CardsArea child, not shell grid row', () => {
    const feltDesktop = FELT_CSS.match(/@media \(min-width: 721px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    const shellDesktop = desktopShellBlock();
    expect(shellDesktop).not.toMatch(/\.bj-table-layout-shell > \.bj-felt-cloth-layer/);
    expect(FELT_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--cards > \.bj-felt-cloth-layer/);
    expect(feltDesktop).not.toMatch(/top:\s*calc\(/);
    expect(feltDesktop).toMatch(/\.bj-felt-cloth-layer__svg[\s\S]*height:\s*var\(--bj-cloth-band-height\)/);
  });

  it('does not size outer cards zone in bj-card-layout.css', () => {
    expect(CARD_LAYOUT_CSS).not.toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--(?:hero|table)\s*\{[^}]*flex:\s*1\s*1\s*auto/,
    );
    expect(CARD_LAYOUT_CSS).not.toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--(?:hero|table)\s*\{[^}]*height:\s*100%/,
    );
  });

  it('only differs CardsArea inner content between hero and table modifiers', () => {
    expect(CARD_LAYOUT_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*justify-content:\s*center/,
    );
    expect(CARD_LAYOUT_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-zone--cards\.bj-cards-area--table[\s\S]*justify-content:\s*flex-end/,
    );
  });

  it('centers ValueAndChips as one unit in the desktop tray row', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*justify-content:\s*center/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--bottom \.bj-value-chips[\s\S]*margin-inline:\s*auto/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--bottom[\s\S]*margin:\s*0/);
  });
});
