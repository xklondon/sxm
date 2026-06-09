import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOBILE_LAYOUT_MEDIA, MOBILE_LAYOUT_MEDIA_LANDSCAPE } from '../styles/mobileLayoutContract';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
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
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-casino__felt-main[\s\S]*env\(safe-area-inset-bottom/,
    );
  });

  it('includes box value band in mobile boxes zone height', () => {
    expect(SHARED_CSS).toMatch(
      /--bj-mobile-zone-boxes-height:\s*calc\([\s\S]*--bj-box-value-band-height/,
    );
  });

  it('reduces boxes-tray gap to keep tray above browser chrome', () => {
    expect(SHARED_CSS).toMatch(
      new RegExp(
        `@media ${MOBILE_LAYOUT_MEDIA.replace(/[()]/g, '\\$&')}[\\s\\S]*--bj-zone-boxes-tray-gap:\\s*0\\.65rem`,
      ),
    );
  });
});

describe('mobile layout fixes — selected box dimensions', () => {
  it('locks mobile player box width without +0.35rem slack on selected state', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc\.bj-box--selected[\s\S]*max-width:\s*var\(--bj-full-table-box-width\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-arc--player-boxes \.bj-arc__slot[\s\S]*max-width:\s*var\(--bj-full-table-box-width\)/,
    );
  });

  it('uses inset glow for mobile selected boxes without layout-affecting outline', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc\.bj-box--selected[\s\S]*box-shadow:\s*inset 0 0 0 2px/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc\.bj-box--selected[\s\S]*outline:\s*none/,
    );
  });
});

describe('mobile layout fixes — Card View classic cloth', () => {
  it('shows cloth in mobile Card View CardsArea', () => {
    expect(FELT_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*flex/,
    );
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
  });

  it('uses translucent hero panel when classic casino cloth is active', () => {
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-casino__felt\.bj-felt-skin--classic-casino \.bj-table-layout-shell::after[\s\S]*rgb\(8 28 22 \/ 0\.42\)/,
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
      /@media \(min-width: 721px\) and \(orientation: landscape\)[\s\S]*--bj-zone-dealer-height:\s*4\.75rem/,
    );
    expect(MOBILE_LAYOUT_MEDIA_LANDSCAPE).toContain('orientation: landscape');
  });
});
