import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');

function shellZoneBlock(zone: string): string {
  const escaped = zone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    SHARED_CSS.match(
      new RegExp(`^\\.bj-table-layout-shell ${escaped}\\s*\\{[\\s\\S]*?\\}`, 'm'),
    )?.[0] ?? ''
  );
}

describe('canonical zone dimensions — Full Table and Card View', () => {
  it('defines one shell height/width token set', () => {
    expect(SHARED_CSS).toContain('--bj-shell-width: min(98vw, 86rem)');
    expect(SHARED_CSS).toContain('--bj-shell-height: min(88vh, 56rem)');
    expect(SHARED_CSS).toMatch(
      /\.bj-table-desktop-shell[\s\S]*height:\s*var\(--bj-shell-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-desktop-shell[\s\S]*max-width:\s*var\(--bj-shell-width\)/,
    );
  });

  it('defines mobile zone height tokens mapped to canonical zone vars', () => {
    expect(SHARED_CSS).toContain('--bj-mobile-zone-dealer-height: 6.25rem');
    expect(SHARED_CSS).toContain('--bj-mobile-zone-command-height: 2.65rem');
    expect(SHARED_CSS).toContain('--bj-mobile-zone-actions-height: 2.9rem');
    expect(SHARED_CSS).toContain('--bj-mobile-zone-boxes-height: 6rem');
    expect(SHARED_CSS).toContain('--bj-mobile-zone-tray-height: 4.35rem');
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
    expect(shellZoneBlock('.bj-table-zone--summary')).toContain('min-height: var(--bj-zone-command-height)');
    expect(shellZoneBlock('.bj-table-zone--summary')).toContain('max-height: var(--bj-zone-command-max-height)');
    expect(shellZoneBlock('.bj-table-zone--actions')).toContain('height: var(--bj-zone-actions-height)');
    expect(shellZoneBlock('.bj-table-zone--boxes')).toContain('height: var(--bj-zone-boxes-height)');
    expect(shellZoneBlock('.bj-table-zone--bottom')).toContain('height: var(--bj-zone-tray-height)');
  });

  it('gives hero and table cards areas the same outer zone flex contract on mobile', () => {
    const cardsBlock = SHARED_CSS.match(
      /\.bj-table-layout-shell \.bj-table-zone--cards,\s*\n\s*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero,\s*\n\s*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table\s*\{[\s\S]*?\}/,
    )?.[0];
    expect(cardsBlock).toBeTruthy();
    expect(cardsBlock).toContain('flex: 1 1 auto');
    expect(cardsBlock).toContain('min-height: var(--bj-zone-cards-min-height)');
    expect(cardsBlock).not.toContain('bj-card-row-hero-min');
  });

  it('uses flexible CardsArea grid row on desktop instead of calc height token', () => {
    const desktop = SHARED_CSS.slice(
      SHARED_CSS.indexOf('/* Desktop table shell — fixed CSS grid rows'),
      SHARED_CSS.indexOf('/* Desktop stage:'),
    );
    expect(SHARED_CSS).toContain('--bj-desktop-grid-row-cards: minmax(0, 1fr)');
    expect(desktop).toMatch(/\[cards\]\s*var\(--bj-desktop-grid-row-cards\)/);
    expect(desktop).not.toMatch(
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
