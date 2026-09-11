import { describe, expect, it } from 'vitest';
import {
  readBlackjackLayoutCss,
  sharedShellZoneBlock,
} from '../test/readBlackjackLayoutCss';

const { shared: SHARED_CSS, shell: SHELL_CSS, fullTableCardArea: CARD_AREA_CSS, cardLayout: CARD_LAYOUT_CSS } =
  readBlackjackLayoutCss();

function shellZoneBlock(zone: string): string {
  return sharedShellZoneBlock(zone);
}

describe('canonical zone dimensions — Full Table and Card View', () => {
  it('defines one shell height/width token set', () => {
    expect(SHARED_CSS).toContain('--bj-shell-width: min(98vw, 86rem)');
    expect(SHARED_CSS).toContain('--bj-shell-height: min(88vh, 56rem)');
    expect(SHARED_CSS).toContain('--bj-desktop-table-height: var(--bj-shell-height)');
    expect(SHARED_CSS).toMatch(
      /\.bj-table-desktop-shell[\s\S]*height:\s*var\(--bj-desktop-table-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-desktop-shell[\s\S]*max-width:\s*var\(--bj-shell-width\)/,
    );
  });

  it('defines mobile zone height tokens mapped to canonical zone vars', () => {
    expect(SHARED_CSS).toContain('--bj-mobile-zone-dealer-height: 5.15rem');
    expect(SHARED_CSS).toContain('--bj-mobile-zone-command-height: 1.85rem');
    expect(SHARED_CSS).toContain('--bj-mobile-zone-actions-height: 2.65rem');
    expect(SHARED_CSS).toContain('--bj-mobile-zone-boxes-height: 5.75rem');
    expect(SHARED_CSS).toContain('--bj-mobile-zone-tray-height: 3.45rem');
    expect(SHARED_CSS).toContain('--bj-zone-dealer-height: var(--bj-mobile-zone-dealer-height)');
  });

  it('defines canonical zone height tokens', () => {
    expect(SHARED_CSS).toContain('--bj-zone-dealer-height: 7.5rem');
    expect(SHARED_CSS).toContain('--bj-zone-command-height: 2rem');
    expect(SHARED_CSS).toContain('--bj-zone-actions-height: 4.25rem');
    expect(SHARED_CSS).toContain('--bj-zone-boxes-height: 6.25rem');
    expect(SHARED_CSS).toContain('--bj-zone-tray-height: 2.75rem');
    expect(SHARED_CSS).toContain('--bj-player-box-width: 4.85rem');
    expect(SHARED_CSS).toContain('--bj-player-box-height: 4.35rem');
    expect(SHARED_CSS).toContain('--bj-action-panel-width: var(--bj-actions-panel-max-width)');
    expect(SHARED_CSS).toContain('--bj-action-panel-height: var(--bj-zone-actions-height)');
  });

  it('applies identical shell zone heights for all canonical zones', () => {
    expect(shellZoneBlock('.bj-table-zone--dealer')).toContain('height: var(--bj-zone-dealer-height)');
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-dealer-area[\s\S]*height: var\(--bj-desktop-zone-dealer-height\)/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*height: var\(--bj-zone-command-height\)/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*height: var\(--bj-desktop-zone-actions-height\)/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*height: var\(--bj-desktop-zone-boxes-height\)/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--bottom[\s\S]*height: var\(--bj-desktop-zone-tray-height\)/,
    );
  });

  it('gives hero and Full Table card zones flex growth with bottom-pinned columns', () => {
    const heroBlock = SHARED_CSS.match(
      /\.bj-table-layout-shell \.bj-table-zone--cards,\s*\n\s*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero\s*\{[\s\S]*?\}/,
    )?.[0];
    expect(heroBlock).toBeTruthy();
    expect(heroBlock).toContain('flex: 1 1 auto');
    expect(heroBlock).toContain('min-height: var(--bj-zone-cards-min-height)');
    expect(heroBlock).not.toContain('bj-card-row-hero-min');
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*grid-row:\s*cards/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*justify-content:\s*flex-end/,
    );
  });

  it('uses flexible Full Table cards grid row on desktop (1fr)', () => {
    expect(CARD_AREA_CSS).not.toMatch(/\[cards\]\s*var\(--bj-full-table-card-area-height\)/);
    expect(SHELL_CSS).toMatch(/\[cards\]\s*var\(--bj-desktop-grid-row-cards\)/);
    expect(SHELL_CSS).toContain('--bj-desktop-grid-row-cards: minmax(var(--bj-zone-cards-min-height, 0), 1fr)');
    expect(SHELL_CSS).not.toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards[\s\S]*height:\s*var\(--bj-zone-cards-height\)/,
    );
  });

  it('does not set unique desktop zone heights on view roots', () => {
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
      /\.bj-view-full-desktop \.bj-table-zone--boxes\s*\{[\s\S]*height:/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--actions\s*\{[\s\S]*height:/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-table-zone--actions\s*\{[\s\S]*height:/,
    );
  });

  it('does not give cards area modifiers different outer heights in card layout css', () => {
    expect(CARD_LAYOUT_CSS).not.toMatch(
      /\.bj-cards-area--hero\s*\{[\s\S]*height:\s*var\(--bj-card-row-hero-min\)/,
    );
    expect(CARD_LAYOUT_CSS).not.toMatch(
      /\.bj-cards-area--table\s*\{[\s\S]*height:\s*var\(--bj-zone-/,
    );
    expect(CARD_LAYOUT_CSS).toContain('--bj-card-row-dealer: var(--bj-zone-dealer-height');
    expect(CARD_LAYOUT_CSS).toContain('--bj-card-row-boxes: var(--bj-zone-boxes-height');
  });

  it('does not override shell height per view', () => {
    expect(CARD_LAYOUT_CSS).not.toMatch(/\.bj-view-card-desktop \.bj-table-desktop-shell[\s\S]*height:/);
    expect(SHARED_CSS).not.toMatch(/\.bj-view-full-desktop \.bj-table-desktop-shell[\s\S]*height:/);
    expect(SHARED_CSS).not.toMatch(/\.bj-view-card-desktop \.bj-table-desktop-shell[\s\S]*height:/);
  });
});
