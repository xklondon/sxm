import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MOBILE_LAYOUT_MEDIA, MOBILE_LAYOUT_MEDIA_LANDSCAPE } from '../styles/mobileLayoutContract';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
const CHIP_CSS = readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8');
const SHELL_TSX = readFileSync(
  join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'),
  'utf8',
);

describe('mobile layout fixes — Full Table action/box clearance', () => {
  const { fullTableCardArea: PLAY_ZONE_CSS } = readBlackjackLayoutCss();

  it('keeps mobile actions in their shell row without zone transforms', () => {
    expect(PLAY_ZONE_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--actions\s*\{/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*grid-row:\s*actions[\s\S]*transform:\s*none/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*height:\s*auto[\s\S]*max-height:\s*none/,
    );
  });

  it('keeps actions, boxes, and tray in canonical DOM and grid-row order', () => {
    expect(SHELL_TSX.indexOf('<BlackjackActionsZone')).toBeLessThan(
      SHELL_TSX.indexOf('<BlackjackPlayerBoxesZone'),
    );
    expect(SHELL_TSX.indexOf('<BlackjackPlayerBoxesZone')).toBeLessThan(
      SHELL_TSX.indexOf('TABLE_UX.tableZoneBottom'),
    );
    expect(SHELL_CSS.indexOf('grid-row: actions')).toBeLessThan(
      SHELL_CSS.indexOf('grid-row: boxes'),
    );
    expect(SHELL_CSS.indexOf('grid-row: boxes')).toBeLessThan(
      SHELL_CSS.indexOf('grid-row: tray'),
    );
  });

  it('does not use margin-top:auto to park boxes against the tray', () => {
    expect(SHARED_CSS).not.toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]{0,220}margin-top:\s*auto/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*margin:\s*0/,
    );
  });

  it('keeps major mobile zone wrappers free of absolute positioning', () => {
    for (const zone of ['summary', 'cards', 'actions', 'boxes', 'bottom']) {
      const block = SHELL_CSS.match(
        new RegExp(`\\.bj-view-full-mobile \\.bj-table-layout-shell > \\.bj-table-zone--${zone}[\\s\\S]*?\\}`),
      )?.[0] ?? '';
      expect(block).not.toMatch(/position:\s*absolute/);
    }
  });
});

describe('mobile layout fixes — portrait bottom safe area', () => {
  it('gives safe-area ownership to the shell tray row only', () => {
    expect(SHARED_CSS).toMatch(
      new RegExp(
        `@media ${MOBILE_LAYOUT_MEDIA.replace(/[()]/g, '\\$&')}[\\s\\S]*--bj-zone-tray-padding-bottom:\\s*max\\([\\s\\S]*env\\(safe-area-inset-bottom`,
      ),
    );
    expect(SHARED_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*--bj-zone-tray-padding-bottom:\s*max\([\s\S]*env\(safe-area-inset-bottom/,
    );
    expect(SHARED_CSS).not.toMatch(
      /--bj-mobile-rail-padding:[^;]*env\(safe-area-inset-bottom/,
    );
    expect(CHIP_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-value-chips,[\s\S]*padding:[^;]*env\(safe-area-inset-bottom/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--bottom[\s\S]*padding:[^;]*var\(--bj-zone-tray-padding-bottom\)/,
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
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--bottom[\s\S]*margin:\s*0/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*grid-row:\s*boxes[\s\S]*margin:\s*0/,
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
    expect(SHELL_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*flex:\s*0 0 auto/,
    );
  });

  it('uses translucent hero panel when classic casino cloth is active', () => {
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-casino__felt\.bj-felt-skin--classic-casino \.bj-table-layout-shell::after[\s\S]*var\(--bj-table-felt-bg\)/,
    );
  });
});

describe('mobile layout fixes — landscape wide phones', () => {
  it('keeps the canonical shell grid above the desktop breakpoint', () => {
    expect(SHARED_CSS).not.toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-view-card-mobile \.bj-table-layout-shell[\s\S]*display:\s*flex/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell[\s\S]*display:\s*grid/,
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
