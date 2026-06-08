import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');

function desktopMediaBlock(): string {
  return SHARED_CSS.match(/@media \(min-width: 721px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
}

function shellZoneBlockInDesktop(zone: string): string {
  const desktop = desktopMediaBlock();
  const escaped = zone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    desktop.match(
      new RegExp(`\\.bj-table-layout-shell ${escaped}[\\s\\S]*?\\}`, 'm'),
    )?.[0] ?? ''
  );
}

describe('desktop canonical grid — Full Table and Card View parity', () => {
  it('defines one desktop zone height token set', () => {
    expect(SHARED_CSS).toContain('--bj-desktop-zone-dealer-height: 7.5rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-command-height: 2.25rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-actions-height: 5rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-boxes-height: 6.65rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-tray-height: 3.35rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-boxes-tray-gap: 1.85rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-cards-height: calc(');
  });

  it('maps desktop tokens to canonical zone vars at min-width 721px', () => {
    const desktop = desktopMediaBlock();
    expect(desktop).toContain('--bj-zone-dealer-height: var(--bj-desktop-zone-dealer-height)');
    expect(desktop).toContain('--bj-zone-command-height: var(--bj-desktop-zone-command-height)');
    expect(desktop).toContain('--bj-zone-actions-height: var(--bj-desktop-zone-actions-height)');
    expect(desktop).toContain('--bj-zone-cards-height: var(--bj-desktop-zone-cards-height)');
    expect(desktop).toContain('--bj-zone-boxes-height: var(--bj-desktop-zone-boxes-height)');
    expect(desktop).toContain('--bj-zone-tray-height: var(--bj-desktop-zone-tray-height)');
    expect(desktop).toContain('--bj-zone-boxes-tray-gap: var(--bj-desktop-zone-boxes-tray-gap)');
  });

  it('uses fixed row sizing for all shell zones on desktop', () => {
    const cardsBlock = shellZoneBlockInDesktop('.bj-table-zone--cards,');
    expect(cardsBlock).toContain('flex: 0 0 auto');
    expect(cardsBlock).toContain('height: var(--bj-zone-cards-height)');
    expect(cardsBlock).toContain('overflow: hidden');

    const boxesBlock = shellZoneBlockInDesktop('.bj-table-zone--boxes');
    expect(boxesBlock).toContain('margin-top: 0');

    const summaryBlock = shellZoneBlockInDesktop('.bj-table-zone--summary');
    expect(summaryBlock).toContain('height: var(--bj-zone-command-height)');
    expect(summaryBlock).toContain('overflow: hidden');
  });

  it('gives hero and table cards areas identical outer dimensions on desktop', () => {
    const desktop = desktopMediaBlock();
    expect(desktop).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards,\s*\n\s*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero,\s*\n\s*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*height:\s*var\(--bj-zone-cards-height\)/,
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
      /\.bj-view-full-desktop \.bj-table-zone--boxes\s*\{[\s\S]*height:/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--cards\s*\{[\s\S]*height:/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-table-zone--cards\s*\{[\s\S]*height:/,
    );
  });

  it('contains hero and table card content inside CardsArea without overlap contracts', () => {
    expect(CARD_LAYOUT_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*overflow:\s*hidden/,
    );
    expect(CARD_LAYOUT_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table \.bj-arc--cards[\s\S]*overflow:\s*hidden/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards[\s\S]*margin-top:\s*0[\s\S]*overflow:\s*hidden/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-phone-view__hero-stage[\s\S]*overflow:\s*hidden/,
    );
  });

  it('does not pin player boxes with margin-top:auto on desktop', () => {
    const desktopBoxes = shellZoneBlockInDesktop('.bj-table-zone--boxes');
    expect(desktopBoxes).not.toContain('margin-top: auto');
  });

  it('keeps mobile boxes pinned above tray with margin-top:auto', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*margin-top:\s*auto/,
    );
  });

  it('keeps chip tray gap and height on shared shell bottom zone', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*height:\s*var\(--bj-zone-tray-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*margin-top:\s*var\(--bj-zone-boxes-tray-gap\)/,
    );
  });

  it('only differs CardsArea inner content between hero and table modifiers', () => {
    const desktop = desktopMediaBlock();
    expect(desktop).toContain('.bj-table-layout-shell .bj-table-zone--cards.bj-cards-area--table');
    expect(desktop).toContain('justify-content: flex-end');
    expect(CARD_LAYOUT_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*justify-content:\s*center/,
    );
  });
});
