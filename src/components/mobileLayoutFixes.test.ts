import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MOBILE_LAYOUT_MEDIA, MOBILE_LAYOUT_MEDIA_LANDSCAPE } from '../styles/mobileLayoutContract';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');

describe('mobile layout fixes — portrait bottom safe area', () => {
  it('pads tray and rail with safe-area-inset-bottom on mobile view roots', () => {
    expect(SHARED_CSS).toMatch(
      new RegExp(
        `@media ${MOBILE_LAYOUT_MEDIA.replace(/[()]/g, '\\$&')}[\\s\\S]*--bj-zone-tray-padding-bottom:\\s*max\\([\\s\\S]*env\\(safe-area-inset-bottom`,
      ),
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-mobile[\s\S]*--bj-zone-tray-padding-bottom:\s*max\([\s\S]*env\(safe-area-inset-bottom/,
    );
    expect(SHARED_CSS).toMatch(
      /--bj-mobile-rail-padding:[\s\S]*env\(safe-area-inset-bottom/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*overflow:\s*visible/,
    );
  });

  it('includes box value band in mobile boxes zone height', () => {
    expect(SHARED_CSS).toMatch(
      /--bj-mobile-zone-boxes-height:\s*calc\([\s\S]*--bj-box-value-band-height/,
    );
  });

  it('keeps boxes-tray gap token for separate tray zone', () => {
    expect(SHARED_CSS).toMatch(
      new RegExp(
        `@media ${MOBILE_LAYOUT_MEDIA.replace(/[()]/g, '\\$&')}[\\s\\S]*--bj-zone-boxes-tray-gap:\\s*0\\.32rem`,
      ),
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*margin-top:\s*var\(--bj-zone-boxes-tray-gap\)/,
    );
  });
});

describe('mobile layout fixes — selected box dimensions', () => {
  it('locks mobile portrait player box width via equal 1fr slot row', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*minmax\(0,\s*1fr\)/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-slot-row\.bj-arc--player-boxes > \.bj-arc__slot[\s\S]*max-width:\s*none/,
    );
  });

  it('uses inset glow for selected boxes in slot row without layout-affecting outline', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*\.bj-box--selected[\s\S]*box-shadow:\s*inset 0 0 0 2px/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*\.bj-box--selected[\s\S]*outline:\s*none/,
    );
  });
});

describe('mobile layout fixes — Card View classic cloth', () => {
  it('shows cloth in Card View CardsArea (desktop + mobile)', () => {
    const CARD_DESKTOP_CSS = readFileSync(
      join(process.cwd(), 'src/styles/bj-card-desktop-layout.css'),
      'utf8',
    );
    expect(FELT_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*flex/,
    );
    expect(CARD_DESKTOP_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*flex/,
    );
  });

  it('uses translucent hero panel when classic casino cloth is active', () => {
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-casino__felt\.bj-felt-skin--classic-casino \.bj-table-layout-shell::after[\s\S]*var\(--bj-table-felt-bg\)/,
    );
  });
});

describe('mobile layout fixes — landscape wide phones', () => {
  it('keeps flex shell when viewport width exceeds 720px on mobile view roots', () => {
    expect(SHARED_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-view-card-mobile \.bj-table-layout-shell[\s\S]*display:\s*flex/,
    );
    expect(SHARED_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-view-card-mobile \.bj-table-layout-shell[\s\S]*grid-template-rows:\s*unset/,
    );
  });

  it('re-applies mobile zone tokens on view roots above desktop breakpoint', () => {
    expect(SHARED_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-view-card-mobile[\s\S]*--bj-zone-tray-height:\s*var\(--bj-mobile-zone-tray-height/,
    );
  });

  it('compresses landscape zone tokens when width exceeds 720px', () => {
    expect(SHARED_CSS).toMatch(
      /@media \(min-width: 721px\) and \(orientation: landscape\)[\s\S]*--bj-zone-dealer-height:\s*4\.25rem/,
    );
    expect(MOBILE_LAYOUT_MEDIA_LANDSCAPE).toContain('orientation: landscape');
  });
});
