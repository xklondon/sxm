import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CARD_VIEW_CSS_TOKENS } from './cardViewBox';

const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');

function shellZoneBlock(zone: string): string {
  const escaped = zone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    SHARED_CSS.match(
      new RegExp(`\\.bj-table-layout-shell ${escaped}\\s*\\{[\\s\\S]*?\\}`, 'm'),
    )?.[0] ?? ''
  );
}

const HERO_CARD =
  /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero/;

describe('Card View vertical-space polish', () => {
  it('hero cards preserve aspect ratio inside the hero row', () => {
    expect(LAYOUT_CSS).toContain(`${CARD_VIEW_CSS_TOKENS.heroCardAspectRatio}: 5 / 7`);
    expect(LAYOUT_CSS).toMatch(
      new RegExp(`${HERO_CARD.source}[\\s\\S]*aspect-ratio:\\s*var\\(--bj-card-hero-card-aspect-ratio\\)`),
    );
    expect(LAYOUT_CSS).toMatch(
      new RegExp(`${HERO_CARD.source}[\\s\\S]*height:\\s*auto`),
    );
    expect(LAYOUT_CSS).toMatch(
      new RegExp(`${HERO_CARD.source}[\\s\\S]*flex:\\s*0 0 auto`),
    );
  });

  it('total badge uses compact min-height and padding tokens', () => {
    expect(LAYOUT_CSS).toContain(`${CARD_VIEW_CSS_TOKENS.totalMinHeight}: 0.7rem`);
    expect(LAYOUT_CSS).toContain('--bj-card-total-padding-block: 0.02rem');
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__total--compact[\s\S]*max-height:\s*var\(--bj-card-total-min-height\)/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__hand-meta[\s\S]*flex:\s*0 0 auto/,
    );
  });

  it('secondary actions use compact height from shared shell', () => {
    expect(SHARED_CSS).toContain('--bj-actions-secondary-btn-min-height: 1.3rem');
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions__btn--sm[\s\S]*font-size:/,
    );
  });

  it('primary actions are centered in the bounded action row', () => {
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--actions[\s\S]*align-items:\s*center/);
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions[\s\S]*justify-content:\s*center|\.bj-table-layout-shell \.bj-table-zone--actions \.bj-player-actions[\s\S]*justify-content:\s*center/,
    );
    expect(LAYOUT_CSS).toContain('--bj-card-row-actions: var(--bj-zone-actions-height');
  });

  it('player box mini-cards use shared full-arc shell sizing', () => {
    expect(SHARED_CSS).toContain('--bj-full-table-box-height');
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand--full-arc[\s\S]*height:\s*var\(--bj-full-table-box-height\)/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand-card-stack[\s\S]*position:\s*relative/);
  });

  it('preserves scroll/overlap and box-column stability guards', () => {
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell[\s\S]*overflow:\s*hidden/);
    expect(LAYOUT_CSS).toMatch(/\.bj-card-layout[\s\S]*display:\s*contents/);
    expect(LAYOUT_CSS).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*overflow:\s*visible/);
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes \.bj-arc--player-boxes[\s\S]*overflow:\s*hidden/,
    );
    expect(LAYOUT_CSS).not.toMatch(/\.bj-card-layout__hero[\s\S]*translateY/i);
    const actionsBlock = shellZoneBlock('.bj-table-zone--actions');
    expect(actionsBlock).not.toMatch(/position:\s*absolute/);
  });
});
