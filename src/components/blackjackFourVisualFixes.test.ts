import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const CLOTH_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackFeltClothLayer.tsx'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

describe('blackjack four visual fixes', () => {
  it('renders classic cloth centered in CardsArea with readable arcs and no top clip', () => {
    expect(CLOTH_SRC).toContain('viewBox="0 0 1000 280"');
    expect(CLOTH_SRC).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(CLOTH_SRC).toContain('M 72 88 Q 500 46 928 88');
    expect(CLOTH_SRC).toContain('M 100 150 Q 500 126 900 150');
    expect(CLOTH_SRC).toContain('M 92 200 Q 500 176 908 200');
    expect(CLOTH_SRC).toContain('M 92 240 Q 500 216 908 240');
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*overflow:\s*visible/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*align-items:\s*center/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer__svg[\s\S]*width:\s*var\(--bj-cloth-svg-width\)/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer__title[\s\S]*font-size:\s*var\(--bj-cloth-title-font-size\)/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer__insurance[\s\S]*fill:\s*#c41e3a/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer__dealer-rule[\s\S]*fill:\s*rgb\(0 0 0/);
    expect(FELT_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--cards > \.bj-felt-cloth-layer/);
    const titlePx = Number.parseInt(
      FELT_CSS.match(/--bj-cloth-title-font-size:\s*(\d+)px/)?.[1] ?? '0',
      10,
    );
    expect(titlePx).toBeGreaterThan(40);
    expect(titlePx).toBeLessThanOrEqual(80);
  });

  it('keeps cloth as a CardsArea child in panel wiring', () => {
    expect(PANEL_SRC).toContain('BlackjackFeltClothLayer');
    expect(PANEL_SRC).toContain('feltClothLayer');
  });

  it('centers Card View hero cards horizontally while keeping top alignment', () => {
    const guard = LAYOUT_CSS.slice(
      LAYOUT_CSS.indexOf('Card View layout guards'),
      LAYOUT_CSS.indexOf('/* Deprecated grid wrapper'),
    );
    expect(guard).toMatch(/\.bj-phone-view__hero-center[\s\S]*align-items:\s*center/);
    expect(guard).toMatch(/\.bj-phone-view__cards-slot[\s\S]*justify-content:\s*center/);
    expect(guard).toMatch(/\.bj-phone-view__cards[\s\S]*justify-content:\s*center/);
    expect(guard).toMatch(/\.bj-phone-view__cards--fan[\s\S]*justify-content:\s*center/);
    expect(guard).toMatch(/align-items:\s*flex-start/);
  });

  it('places box value above the player box frame with reserved band height', () => {
    expect(PANEL_SRC).toContain('BOX_CARD_VALUE_ABOVE');
    expect(PANEL_SRC).toMatch(
      /bj-arc__slot--owned[\s\S]*BOX_CARD_VALUE_ABOVE[\s\S]*TABLE_UX\.fullArcBox/,
    );
    expect(SHARED_CSS).toContain('--bj-box-value-band-height');
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-arc__slot--owned \.bj-phone-view__box-value--above[\s\S]*min-height:\s*var\(--bj-box-value-band-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-phone-view__mini-hand--full-arc[\s\S]*height:\s*var\(--bj-full-table-box-height\)/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-phone-view__mini-hand--full-arc \.bj-phone-view__box-value/,
    );
  });

  it('removes Hit/Stay action panel wrapper border only', () => {
    expect(SHARED_CSS).toMatch(/\.bj-table-actions,\s*\n\.bj-phone-view__phase-actions--insurance[\s\S]*border:\s*none/);
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions[\s\S]*border:\s*none/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-table-actions__btn[\s\S]*border-radius/);
  });

  it('hides cloth in Card View desktop only; mobile Card View keeps classic cloth', () => {
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*flex/,
    );
  });

  it('pushes player box stake chips toward the bottom of the frame', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-phone-view__mini-hand--full-arc \.bj-phone-view__mini-stake-slot[\s\S]*margin-top:\s*auto/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-phone-view__mini-hand--full-arc \.bj-phone-view__mini-stake-slot[\s\S]*align-items:\s*flex-end/,
    );
  });
});
