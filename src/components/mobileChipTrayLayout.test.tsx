import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { ValueAndChipsBar } from './ChipStack';
import { MOBILE_LAYOUT_MEDIA } from '../styles/mobileLayoutContract';
import { TABLE_UX } from './tableUxContract';

const CHIP_CSS = readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');

describe('mobile chip tray layout (Table + card views)', () => {
  it('does not render an Available label', () => {
    const html = renderToStaticMarkup(
      <ValueAndChipsBar available={500} showChips onChipClick={() => {}} minimumBet={5} />,
    );
    expect(html).not.toContain('Available');
    expect(html).toContain('>500<');
  });

  it('renders bankroll value left of chips in markup order', () => {
    const html = renderToStaticMarkup(
      <ValueAndChipsBar available={490} showChips onChipClick={() => {}} minimumBet={5} />,
    );
    expect(html.indexOf(TABLE_UX.valueBalance)).toBeLessThan(html.indexOf(TABLE_UX.chipTrayStash));
    expect(html.indexOf('>490<')).toBeLessThan(html.indexOf('chip-tray'));
  });

  it('uses one shared gap variable for chip spacing on mobile', () => {
    expect(CHIP_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-value-chips[\s\S]*--bj-chip-tray-gap:\s*0\.28rem/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-value-chips[\s\S]*--bj-chip-tray-gap:\s*0\.28rem/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-value-chips .chip-tray__chips[\s\S]*gap:\s*var\(--bj-chip-tray-gap\)/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-value-chips .chip-tray__chips[\s\S]*gap:\s*var\(--bj-chip-tray-gap\)/,
    );
  });

  it('keeps chips on a single nowrap row', () => {
    expect(CHIP_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-value-chips \.chip-tray__chips[\s\S]{0,120}flex-wrap:\s*nowrap/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-value-chips__row--main[\s\S]{0,120}flex-wrap:\s*nowrap/,
    );
  });

  it('clips stash overflow so chips cannot overlap the value', () => {
    expect(CHIP_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-value-chips__stash[\s\S]{0,120}overflow:\s*hidden/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-value-chips__stash[\s\S]{0,120}overflow:\s*hidden/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-value-chips__balance[\s\S]{0,120}flex:\s*0 0 auto/,
    );
  });

  it('shrinks chip visuals while preserving hit target on mobile', () => {
    expect(CHIP_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-value-chips[\s\S]*--chip-plaque-visual-width:\s*3\.75rem/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-value-chips \.chip-token--plaque[\s\S]*min-width:\s*var\(--chip-plaque-hit-width\)/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-value-chips \.chip-token--plaque[\s\S]*min-height:\s*var\(--chip-plaque-hit-height\)/,
    );
  });

  it('uses tabular numerals for the value label', () => {
    expect(CHIP_CSS).toMatch(
      /\.bj-value-chips__balance[\s\S]*font-variant-numeric:\s*tabular-nums/,
    );
  });

  it('keeps fixed tray zone height on mobile', () => {
    expect(SHARED_CSS).toContain(MOBILE_LAYOUT_MEDIA);
    expect(SHARED_CSS).toContain('--bj-mobile-zone-tray-height: 3.85rem');
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]{0,120}height:\s*var\(--bj-zone-tray-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]{0,120}max-height:\s*var\(--bj-zone-tray-height\)/,
    );
  });
});
