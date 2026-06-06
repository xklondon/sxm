import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CARD_VIEW_CSS_TOKENS } from './cardViewBox';

const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');

function layoutZoneBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\}`))?.[0] ?? '';
}

describe('Card View vertical-space polish', () => {
  it('hero cards preserve aspect ratio inside the hero row', () => {
    expect(LAYOUT_CSS).toContain(`${CARD_VIEW_CSS_TOKENS.heroCardAspectRatio}: 5 / 7`);
    expect(LAYOUT_CSS).toMatch(
      /\.bj-card-layout__hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero[\s\S]*aspect-ratio:\s*var\(--bj-card-hero-card-aspect-ratio\)/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-card-layout__hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero[\s\S]*height:\s*auto/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-card-layout__hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero[\s\S]*flex:\s*0 0 auto/,
    );
  });

  it('total badge uses compact min-height and padding tokens', () => {
    expect(LAYOUT_CSS).toContain(`${CARD_VIEW_CSS_TOKENS.totalMinHeight}: 0.7rem`);
    expect(LAYOUT_CSS).toContain('--bj-card-total-padding-block: 0.02rem');
    expect(LAYOUT_CSS).toMatch(
      /\.bj-card-layout__hero \.bj-phone-view__total--compact[\s\S]*max-height:\s*var\(--bj-card-total-min-height\)/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-card-layout__hero \.bj-phone-view__hand-meta[\s\S]*margin-bottom:\s*0/,
    );
  });

  it('secondary actions use compact height and padding', () => {
    expect(LAYOUT_CSS).toContain(`${CARD_VIEW_CSS_TOKENS.actionSecondaryHeight}: 1.05rem`);
    expect(LAYOUT_CSS).toMatch(
      /\.bj-card-layout__actions \.bj-phone-view__action-bar-extra--compact[\s\S]*min-height:\s*var\(--bj-card-action-secondary-height\)/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-card-layout__actions \.bj-phone-view__action-bar-extra--compact[\s\S]*padding:\s*0\.04rem 0\.2rem/,
    );
  });

  it('primary actions sit lower in the action row', () => {
    expect(LAYOUT_CSS).toMatch(/\.bj-card-layout__actions[\s\S]*align-items:\s*flex-end/);
    expect(LAYOUT_CSS).toMatch(
      /\.bj-card-layout__actions \.bj-phone-view__action-bar[\s\S]*justify-content:\s*flex-end/,
    );
    expect(LAYOUT_CSS).toContain('--bj-card-action-primary-height: 1.48rem');
  });

  it('bottom box mini-cards use increased scale inside fixed stack height', () => {
    expect(LAYOUT_CSS).toContain(`${CARD_VIEW_CSS_TOKENS.miniCardScale}: 0.54`);
    expect(LAYOUT_CSS).toContain('--bj-card-mini-card-stack-height: 1.9rem');
    expect(LAYOUT_CSS).toMatch(
      /\.bj-card-layout__boxes \.bj-phone-view__mini-hand-card-stack \.bj-phone-view__mini-card[\s\S]*scale\(var\(--bj-card-mini-card-scale\)\)/,
    );
  });

  it('preserves scroll/overlap and box-column stability guards', () => {
    expect(LAYOUT_CSS).toMatch(/\.bj-card-layout[\s\S]*overflow:\s*hidden/);
    expect(layoutZoneBlock(LAYOUT_CSS, '.bj-card-layout__boxes')).not.toMatch(/margin-top:\s*auto/);
    expect(LAYOUT_CSS).toMatch(/grid-template-rows:[\s\S]*var\(--bj-card-box-chip-stack-height\)/);
    expect(layoutZoneBlock(LAYOUT_CSS, '.bj-card-layout__hero')).not.toMatch(/translateY/i);
    expect(layoutZoneBlock(LAYOUT_CSS, '.bj-card-layout__actions')).not.toMatch(/position:\s*absolute/);
  });
});
