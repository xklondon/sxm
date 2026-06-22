import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CARD_PLACEMENT_BY_MODE,
  CARD_PLACEMENT_CONTRACT_VERSION,
  cardPlacementDataAttribute,
  getCardPlacementSpec,
  isBoxColumnPlacement,
  isHeroCenterPlacement,
} from './blackjackCardPlacementContract';
import { CSS_OWNERSHIP } from './tableLayoutEngine';

const SHELL_CSS = readFileSync(join(process.cwd(), CSS_OWNERSHIP.shellGeometry), 'utf8');
const CARD_AREA_CSS = readFileSync(join(process.cwd(), CSS_OWNERSHIP.fullTableCardStack), 'utf8');
const HERO_CSS = readFileSync(join(process.cwd(), CSS_OWNERSHIP.cardViewHeroDesktop), 'utf8');
const MOBILE_HERO_CSS = readFileSync(join(process.cwd(), CSS_OWNERSHIP.cardViewHeroMobile), 'utf8');
const VIEW_ZONES_SRC = readFileSync(join(process.cwd(), 'src/components/blackjackViewZones.tsx'), 'utf8');
const SHELL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');

describe('blackjackCardPlacementContract — per-mode specs', () => {
  it('defines four distinct placement modes', () => {
    expect(CARD_PLACEMENT_CONTRACT_VERSION).toBe('card-placement-v1');
    expect(Object.keys(CARD_PLACEMENT_BY_MODE)).toEqual([
      'desktopFull',
      'desktopCard',
      'mobileFull',
      'mobileCard',
    ]);
    expect(isBoxColumnPlacement('desktopFull')).toBe(true);
    expect(isBoxColumnPlacement('mobileFull')).toBe(true);
    expect(isHeroCenterPlacement('desktopCard')).toBe(true);
    expect(isHeroCenterPlacement('mobileCard')).toBe(true);
  });

  it('uses box-column anchor for Full Table and hero-center for Card View', () => {
    expect(cardPlacementDataAttribute('desktopFull')).toBe('boxColumn:justAboveBoxValue');
    expect(cardPlacementDataAttribute('mobileFull')).toBe('boxColumn:justAboveBoxValue');
    expect(cardPlacementDataAttribute('desktopCard')).toBe('heroCenter:centerHero');
    expect(cardPlacementDataAttribute('mobileCard')).toBe('heroCenter:centerHero');
  });

  it('wires data-card-placement on cards zone from shell', () => {
    expect(VIEW_ZONES_SRC).toContain('data-card-placement');
    expect(VIEW_ZONES_SRC).toContain('data-placement-overflow');
    expect(SHELL_SRC).toContain('deviceView');
  });
});

describe('blackjackCardPlacementContract — desktop Full Table', () => {
  it('box-column stacks use clip-x (not global overflow:hidden) on cards zone', () => {
    const rule =
      SHELL_CSS.match(
        /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table\s*\{[^}]*\}/,
      )?.[0] ?? '';
    expect(rule).toContain('overflow-x: clip');
    expect(rule).toContain('overflow-y: visible');
    expect(rule).not.toContain('overflow: hidden');
    expect(getCardPlacementSpec('desktopFull').allowedOverflow).toBe('clip-x');
  });

  it('does not use margin-top:auto on desktop full table card area', () => {
    expect(CARD_AREA_CSS).not.toMatch(
      /\.bj-view-full-desktop[\s\S]*\.bj-full-table-card-area\s*\{[\s\S]*margin-top:\s*auto/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop[\s\S]*\.bj-full-table-card-area\s*\{[\s\S]*align-self:\s*flex-end/,
    );
  });

  it('uses column-reverse stack overlap for 2/3/5+ cards', () => {
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards\.bj-full-table-card-area \.bj-arc__cards--stack-vertical \.bj-arc__cards-stack[\s\S]*flex-direction:\s*column-reverse/,
    );
    expect(CARD_AREA_CSS).toMatch(/data-bj-card-count='5'/);
  });
});

describe('blackjackCardPlacementContract — mobile Full Table', () => {
  it('bottom-pins box-column stacks just above box value', () => {
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table\s*\{[\s\S]*justify-content:\s*flex-end/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-mobile[\s\S]*\.bj-arc__play-zone[\s\S]*justify-content:\s*flex-end/,
    );
    expect(getCardPlacementSpec('mobileFull').cardScaleRem.height).toBeLessThan(2.5);
  });

  it('uses clip-x on mobile full table cards zone (not overflow:hidden workaround)', () => {
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*overflow-x:\s*clip[\s\S]*overflow-y:\s*visible/,
    );
  });
});

describe('blackjackCardPlacementContract — desktop Card View hero', () => {
  it('hero cards have deterministic non-zero min-height and visible overflow', () => {
    expect(SHELL_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--hero\s*\{[\s\S]*min-height:\s*var\(--bj-zone-cards-min-height/,
    );
    expect(SHELL_CSS).toMatch(
      /> \.bj-card-desktop-hero\s*\{[\s\S]*min-height:\s*min\(5\.5rem,\s*100%\)/,
    );
    expect(HERO_CSS).toMatch(
      /\.bj-card-desktop-hero__card\.ds-card--hero\s*\{[\s\S]*min-height:\s*min\(5\.5rem/,
    );
    expect(HERO_CSS).toMatch(/\.bj-card-desktop-hero__fan\s*\{[\s\S]*overflow:\s*visible/);
    expect(getCardPlacementSpec('desktopCard').allowedOverflow).toBe('visible');
  });

  it('shell does not use global overflow:hidden on hero cards zone', () => {
    const heroRule =
      SHELL_CSS.match(
        /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--hero\s*\{[^}]*\}/,
      )?.[0] ?? '';
    expect(heroRule).toContain('overflow: visible');
    expect(heroRule).not.toContain('overflow: hidden');
  });
});

describe('blackjackCardPlacementContract — mobile Card View protection', () => {
  it('mobile card view hero zone keeps visible overflow (unchanged contract)', () => {
    expect(SHELL_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell > \.bj-table-zone--cards:not\(\.bj-cards-area--table\)[\s\S]*overflow:\s*visible/,
    );
    expect(getCardPlacementSpec('mobileCard').anchor).toBe('heroCenter');
    expect(MOBILE_HERO_CSS.length).toBeGreaterThan(100);
  });
});

describe('blackjackCardPlacementContract — zone ownership', () => {
  it('shell owns zones; placement CSS does not move boxes/tray', () => {
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-table-zone--(?:boxes|bottom)[\s\S]{0,200}margin-top:\s*auto/,
    );
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-table-zone--(?:boxes|bottom)[\s\S]{0,200}transform:/,
    );
  });
});
