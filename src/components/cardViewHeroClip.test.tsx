import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(
  join(process.cwd(), 'src/components/BlackjackCardView.css'),
  'utf8',
);

describe('Desktop Card View hero card clipping guards', () => {
  it('derives desktop hero row min-height from card max-height plus meta reserve', () => {
    expect(LAYOUT_CSS).toContain('--bj-card-hero-meta-reserve');
    expect(LAYOUT_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*--bj-card-row-hero-min:\s*calc\(\s*var\(--bj-card-hero-card-max-height\) \+ var\(--bj-card-hero-meta-reserve\)/,
    );
  });

  it('caps hero card size to the hero row budget without breaking aspect ratio', () => {
    expect(LAYOUT_CSS).toMatch(
      /\.bj-card-layout__hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero[\s\S]*aspect-ratio:\s*var\(--bj-card-hero-card-aspect-ratio\)/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-card-layout__hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero[\s\S]*height:\s*auto/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-card-layout__hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero[\s\S]*max-height:\s*min\(/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-card-layout__hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero[\s\S]*max-width:\s*min\(/,
    );
  });

  it('clips hero cards from the bottom only on desktop (overflow hidden + top alignment)', () => {
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-card-layout__hero \.bj-phone-view__cards-slot[\s\S]*overflow:\s*hidden/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-card-layout__hero \.bj-phone-view__cards[\s\S]*overflow:\s*hidden/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-card-layout__hero \.bj-phone-view__cards-slot[\s\S]*align-items:\s*flex-start/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-card-layout__hero \.bj-phone-view__card-wrap[\s\S]*transform-origin:\s*top center/,
    );
  });

  it('does not reintroduce legacy low max-height clips on hero card slot in Card View CSS', () => {
    expect(CARD_VIEW_CSS).not.toMatch(
      /\.bj-card-layout__hero \.bj-phone-view__cards-slot[\s\S]*max-height:\s*6\.75rem/,
    );
    expect(CARD_VIEW_CSS).not.toMatch(
      /\.bj-phone-view__cards-slot[\s\S]*max-height:\s*6\.75rem/,
    );
  });

  it('aligns hero cards to the top so rank/suit stay readable', () => {
    expect(LAYOUT_CSS).toMatch(/\.bj-card-layout__hero \.bj-phone-view__cards[\s\S]*align-items:\s*flex-start/);
    expect(LAYOUT_CSS).toMatch(/\.bj-card-layout__hero \.bj-phone-view__cards-slot[\s\S]*align-items:\s*flex-start/);
    expect(LAYOUT_CSS).toMatch(/\.bj-view-card-desktop \.bj-card-layout__hero[\s\S]*justify-content:\s*flex-start/);
  });
});
