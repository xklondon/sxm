import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(
  join(process.cwd(), 'src/components/BlackjackCardView.css'),
  'utf8',
);

const HERO_CARD =
  /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards \.playing-card\.bj-phone-card--hero/;

describe('Desktop Card View hero card clipping guards', () => {
  it('caps hero card size with aspect ratio preserved', () => {
    expect(LAYOUT_CSS).toMatch(
      new RegExp(`${HERO_CARD.source}[\\s\\S]*aspect-ratio:\\s*var\\(--bj-card-hero-card-aspect-ratio\\)`),
    );
    expect(LAYOUT_CSS).toMatch(
      new RegExp(`${HERO_CARD.source}[\\s\\S]*height:\\s*auto`),
    );
    expect(LAYOUT_CSS).toMatch(
      new RegExp(`${HERO_CARD.source}[\\s\\S]*max-height:\\s*var\\(--bj-card-hero-card-max-height\\)`),
    );
    expect(LAYOUT_CSS).toMatch(
      new RegExp(`${HERO_CARD.source}[\\s\\S]*max-width:\\s*var\\(--bj-card-hero-card-width\\)`),
    );
  });

  it('keeps hero cards fully visible on desktop (no overflow clip)', () => {
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards-slot[\s\S]*overflow:\s*visible/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards[\s\S]*overflow:\s*visible/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards-slot[\s\S]*max-height:\s*none/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__card-wrap[\s\S]*transform-origin:\s*center center/,
    );
  });

  it('does not reintroduce legacy low max-height clips on hero card slot in Card View CSS', () => {
    expect(CARD_VIEW_CSS).not.toMatch(
      /\.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards-slot[\s\S]*max-height:\s*6\.75rem/,
    );
    expect(CARD_VIEW_CSS).not.toMatch(
      /\.bj-phone-view__cards-slot[\s\S]*max-height:\s*6\.75rem/,
    );
  });

  it('aligns Card View hero cards from the top so rank/suit stay readable', () => {
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards--fan[\s\S]*align-items:\s*flex-start/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards-slot[\s\S]*align-items:\s*flex-start/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__card-wrap[\s\S]*align-self:\s*center/,
    );
    expect(LAYOUT_CSS).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*overflow:\s*visible/);
  });
});
