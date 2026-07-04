import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');

describe('Card View hero centering', () => {
  it('centers hero column containers on CardsArea centerline', () => {
    const guard = LAYOUT_CSS.slice(
      LAYOUT_CSS.indexOf('Card View layout guards'),
      LAYOUT_CSS.indexOf('/* Deprecated grid wrapper'),
    );
    expect(guard).toMatch(
      /\.bj-phone-view__hero-center[\s\S]*align-items:\s*center/,
    );
    expect(guard).toMatch(
      /\.bj-phone-view__hero-center[\s\S]*justify-content:\s*flex-start/,
    );
    expect(guard).toMatch(
      /\.bj-phone-view__cards-slot[\s\S]*justify-content:\s*center/,
    );
    expect(guard).toMatch(
      /\.bj-phone-view__cards--fan[\s\S]*justify-content:\s*center/,
    );
    const heroDesktopCss = readFileSync(join(process.cwd(), 'src/styles/bj-card-desktop-hero-area.css'), 'utf8');
    const heroCenterBlock =
      guard.match(
        /\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__hero-center[\s\S]*?\}/,
      )?.[0] ?? '';
    expect(heroCenterBlock).toMatch(/align-items:\s*center/);
    expect(heroCenterBlock).not.toMatch(/align-items:\s*flex-start/);
    expect(heroDesktopCss).toMatch(/\.bj-view-card-desktop \.bj-card-desktop-hero[\s\S]*align-items:\s*center/);
  });

  it('does not apply horizontal translateX to Card View hero fan/wrap', () => {
    const guard = LAYOUT_CSS.slice(
      LAYOUT_CSS.indexOf('Card View layout guards'),
      LAYOUT_CSS.indexOf('/* Deprecated grid wrapper'),
    );
    expect(guard).not.toMatch(/translateX/i);
    expect(LAYOUT_CSS).not.toMatch(
      /\.bj-view-card-(?:desktop|mobile)[\s\S]*\.bj-phone-view__card-wrap[\s\S]*margin-left:\s*-/,
    );
  });

  it('keeps side-control play area from left-biasing hero center on mobile', () => {
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__play-area--controls[\s\S]*justify-content:\s*center/,
    );
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__play-area--controls \.bj-phone-view__hero-center[\s\S]*align-items:\s*center/,
    );
    expect(CARD_VIEW_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__play-area--controls \.bj-phone-view__hero-center[\s\S]*align-items:\s*flex-start/,
    );
  });

  it('anchors hero CardsArea for centerline measurement', () => {
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*position:\s*relative/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*position:\s*relative/,
    );
  });

  it('does not change Full Table arc card stack centering selectors', () => {
    expect(LAYOUT_CSS).not.toMatch(
      /\.bj-cards-area--table \.bj-phone-view__hero-center/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-view-full-desktop \.bj-arc__cards--stack-vertical[\s\S]*justify-content:\s*center/);
  });
});
