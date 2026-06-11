import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLE_UX } from './tableUxContract';

const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');

describe('mobile Card View hero gameplay panel', () => {
  it('declares mobile hero gameplay panel contract class', () => {
    expect(TABLE_UX.mobileHeroGameplayPanel).toBe('bj-mobile-hero-gameplay-panel');
    expect(CARD_VIEW_CSS).toContain('.bj-mobile-hero-gameplay-panel');
  });

  it('renders gameplay backdrop only on mobile Card View', () => {
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell::after[\s\S]*background:\s*var\(--bj-table-felt-bg\)/,
    );
    expect(CARD_VIEW_CSS).not.toMatch(/\.bj-view-full-mobile \.bj-table-layout-shell::after/);
    expect(CARD_VIEW_CSS).not.toMatch(/\.bj-view-card-desktop \.bj-table-layout-shell::after/);
    expect(PANEL_CSS).not.toMatch(/\.bj-view-card-desktop \.bj-table-layout-shell::after/);
  });

  it('places backdrop above cloth and below hero controls', () => {
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*z-index:\s*0/);
    expect(CARD_VIEW_CSS).toMatch(/\.bj-view-card-mobile \.bj-table-layout-shell::after[\s\S]*z-index:\s*0/);
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__play-area[\s\S]*\.bj-view-card-mobile \.bj-phone-view__side-action[\s\S]*z-index:\s*1/,
    );
    expect(FELT_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards > :not\(\.bj-felt-cloth-layer\)\s*\{[\s\S]*z-index:\s*1/,
    );
  });

  it('top-aligns hero cards in play area with side indicators beside hero and actions in zone', () => {
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__play-area--controls[\s\S]*justify-content:\s*center/,
    );
    expect(CARD_VIEW_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__side-action[\s\S]*display:\s*none/,
    );
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__play-area--controls \.bj-phone-view__hero-center[\s\S]*align-items:\s*center/,
    );
  });

  it('keeps cloth layer visible outside the hero panel bounds', () => {
    expect(CARD_VIEW_CSS).toMatch(/\.bj-view-card-mobile \.bj-table-layout-shell::after[\s\S]*top:\s*var\(--bj-mobile-hero-panel-top\)/);
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell::after[\s\S]*bottom:\s*var\(--bj-mobile-hero-panel-bottom\)/,
    );
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*pointer-events:\s*none/);
  });

  it('uses translucent classic-casino panel styling so cloth shows through hero zone', () => {
    expect(CARD_VIEW_CSS).toMatch(/\.bj-view-card-mobile \.bj-table-layout-shell::after[\s\S]*border:/);
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-casino__felt\.bj-felt-skin--classic-casino \.bj-table-layout-shell::after[\s\S]*var\(--bj-table-felt-bg\)/,
    );
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*background:\s*transparent/,
    );
  });
});
