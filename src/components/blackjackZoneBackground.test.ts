import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_AREA_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const SHELL_SRC = readFileSync(
  join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'),
  'utf8',
);

function desktopShellBlock(): string {
  const start = SHARED_CSS.indexOf('/* Desktop table shell — fixed CSS grid rows');
  const end = SHARED_CSS.indexOf('/* Desktop stage:', start);
  return start >= 0 && end > start ? SHARED_CSS.slice(start, end) : '';
}

describe('blackjack zone backgrounds — continuous felt surface', () => {
  it('paints one felt background on the layout shell', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell\s*\{[\s\S]*background:\s*var\(--bj-table-felt-bg\)/,
    );
  });

  it('keeps shell zones transparent (no per-row felt patches)', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--dealer,\s*\n\s*\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*background:\s*transparent/,
    );
    const desktop = desktopShellBlock();
    expect(desktop).not.toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--dealer\s*\{[^}]*background:\s*var\(--bj-desktop-felt-bg\)/,
    );
    expect(desktop).not.toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--summary\s*\{[^}]*background:\s*var\(--bj-desktop-felt-bg\)/,
    );
    expect(desktop).not.toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--actions\s*\{[^}]*background:\s*var\(--bj-desktop-felt-bg\)/,
    );
  });

  it('does not give CardsArea a separate solid background patch', () => {
    expect(SHARED_CSS).not.toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--cards\s*\{[^}]*background:\s*(?!transparent)/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--(?:hero|table)\s*\{[^}]*background:/,
    );
  });

  it('removes empty grid gap rows that caused visual banding', () => {
    const desktop = desktopShellBlock();
    expect(desktop).not.toContain('[gap-dc]');
    expect(desktop).not.toContain('[gap-ca]');
    expect(desktop).not.toContain('[gap-ac]');
    expect(desktop).not.toContain('[gap-cb]');
    expect(desktop).not.toContain('[gap-bt]');
    expect(desktop).toContain('[cards] var(--bj-desktop-grid-row-cards)');
  });

  it('places CardsArea directly between command and actions grid rows', () => {
    const desktop = desktopShellBlock();
    expect(desktop).toMatch(/\[command\][\s\S]*\[cards\][\s\S]*\[actions\]/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*grid-row:\s*cards/);
  });

  it('uses identical CardsArea outer flex growth for hero; Full Table bottom-pins columns', () => {
    const heroBlock =
      SHARED_CSS.match(
        /\.bj-table-layout-shell \.bj-table-zone--cards,\s*\n\s*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero\s*\{[\s\S]*?\}/,
      )?.[0] ?? '';
    expect(heroBlock).toContain('flex: 1 1 auto');
    expect(heroBlock).not.toContain('background:');
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*flex:\s*1\s+1\s+auto/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*justify-content:\s*flex-end/,
    );
  });

  it('keeps cloth inside CardsArea without overlapping command/actions', () => {
    expect(FELT_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--cards > \.bj-felt-cloth-layer/);
    expect(SHELL_SRC).toMatch(
      /<BlackjackCardsAreaZone[\s\S]*\{feltClothLayer\}[\s\S]*\{cardsArea\}/,
    );
  });

  it('uses the same felt token on desktop rail surface and shell', () => {
    expect(SHARED_CSS).toContain('--bj-desktop-felt-bg: var(--bj-table-felt-bg)');
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-casino__felt,\s*\n\s*\.bj-view-card-desktop \.bj-casino__felt[\s\S]*background:\s*var\(--bj-table-felt-bg\)/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-casino__felt\.bj-table-surface[\s\S]*background-image:\s*none/,
    );
  });
});
