import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss, shellDesktopDirectZoneBlock } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');

function desktopShellBlock(): string {
  return SHELL_CSS;
}

describe('desktop canonical grid — Full Table and Card View parity', () => {
  it('defines one desktop zone height token set', () => {
    expect(SHELL_CSS).toContain('--bj-desktop-zone-dealer-height: 7.15rem');
    expect(SHELL_CSS).toContain('--bj-desktop-zone-command-height: 4.35rem');
    expect(SHELL_CSS).toContain('--bj-desktop-dealer-command-gap: 0.4125rem');
    expect(SHELL_CSS).toContain('--bj-desktop-zone-actions-height: 2.5rem');
    expect(SHELL_CSS).toContain('--bj-desktop-zone-boxes-height: 6.1rem');
    expect(SHELL_CSS).toContain('--bj-desktop-zone-tray-height: 4.15rem');
    expect(SHELL_CSS).toContain('--bj-desktop-zone-boxes-tray-gap: 0.42rem');
    expect(SHELL_CSS).toContain('--bj-desktop-bottom-padding: 0.42rem');
    expect(SHELL_CSS).toContain('--bj-desktop-grid-row-cards: minmax(var(--bj-zone-cards-min-height, 0), 1fr)');
    expect(SHELL_CSS).not.toContain('--bj-desktop-zone-cards-height: calc(');
  });

  it('uses CSS grid with fixed rows and one flexible CardsArea row on desktop', () => {
    const desktop = desktopShellBlock();
    expect(desktop).toMatch(/\.bj-table-layout-shell\s*\{[\s\S]*display:\s*grid/);
    expect(desktop).toContain('[dealer] var(--bj-desktop-zone-dealer-height)');
    expect(desktop).toContain('[command] var(--bj-desktop-zone-command-height)');
    expect(desktop).toContain('[cards] var(--bj-desktop-grid-row-cards)');
    expect(desktop).toContain('[actions] var(--bj-desktop-zone-actions-height)');
    expect(desktop).toContain('[boxes] var(--bj-desktop-zone-boxes-height)');
    expect(desktop).toContain('[tray] var(--bj-desktop-zone-tray-height)');
    expect(desktop).not.toContain('[gap-dc]');
    expect(desktop).not.toContain('[gap-ac]');
    expect(desktop).not.toContain('[gap-bt]');
  });

  it('assigns each shell zone to a grid row without vertical margin hacks', () => {
    const desktop = desktopShellBlock();
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-dealer-area[\s\S]*grid-row:\s*dealer/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*grid-row:\s*command/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*grid-row:\s*actions/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*grid-row:\s*cards/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*grid-row:\s*boxes/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--bottom[\s\S]*grid-row:\s*tray/);
    const summaryZone = shellDesktopDirectZoneBlock('.bj-table-zone--summary');
    const actionsZone = shellDesktopDirectZoneBlock('.bj-table-zone--actions');
    const bottomZone = shellDesktopDirectZoneBlock('.bj-table-zone--bottom');
    const boxesZone = shellDesktopDirectZoneBlock('.bj-table-zone--boxes');
    expect(summaryZone).not.toMatch(/margin-top:/);
    expect(actionsZone).not.toMatch(/margin-bottom:/);
    expect(bottomZone).not.toMatch(/margin-top:/);
    expect(bottomZone).toMatch(/padding-top:\s*var\(--bj-desktop-zone-boxes-tray-gap\)/);
    expect(boxesZone).not.toMatch(/margin-top:\s*auto/);
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

  it('contains hero card content inside CardsArea; Full Table table mode in play-zone CSS', () => {
    expect(CARD_LAYOUT_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*overflow:\s*hidden/,
    );
    const playZoneCss = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
    expect(playZoneCss).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards\.bj-full-table-card-area[\s\S]*overflow:\s*visible/,
    );
  });

  it('ties cloth layer to CardsArea child, not shell grid row', () => {
    const shellDesktop = desktopShellBlock();
    expect(shellDesktop).not.toMatch(/\.bj-table-layout-shell > \.bj-felt-cloth-layer/);
    expect(FELT_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--cards > \.bj-felt-cloth-layer/);
    expect(FELT_CSS).not.toMatch(/top:\s*calc\(/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer__svg[\s\S]*width:\s*var\(--bj-cloth-svg-width\)/);
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
    const playZoneCss = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
    expect(CARD_LAYOUT_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*justify-content:\s*center/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*justify-content:\s*flex-end/,
    );
  });

  it('centers ValueAndChips as one unit in the desktop tray row', () => {
    expect(SHELL_CSS).toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--bottom[\s\S]*justify-content:\s*center/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--bottom[\s\S]*margin:\s*0/,
    );
  });
});
