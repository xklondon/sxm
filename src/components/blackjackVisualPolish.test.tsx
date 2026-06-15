import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { ValueAndChipsBar } from './ChipStack';
import { TABLE_UX } from './tableUxContract';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_AREA_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const CHIP_CSS = readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');

describe('Value & Chips bottom row', () => {
  it('renders bankroll value left of chip stash in one horizontal row', () => {
    const html = renderToStaticMarkup(
      <ValueAndChipsBar
        available={500}
        showChips
        onChipClick={() => {}}
        minimumBet={5}
      />,
    );
    expect(html).toContain('bj-value-chips');
    expect(html).toContain('>500<');
    expect(html).not.toContain('Available');
    expect(html).toContain('chip-tray');
    expect(html).toContain('aria-label="500 chips"');
    expect(html.indexOf('>500<')).toBeLessThan(html.indexOf('chip-tray'));
    expect(html.indexOf(TABLE_UX.valueBalance)).toBeLessThan(html.indexOf(TABLE_UX.chipTrayStash));
  });

  it('keeps balance visible when chips are hidden', () => {
    const html = renderToStaticMarkup(
      <ValueAndChipsBar available={250} showChips={false} onChipClick={() => {}} />,
    );
    expect(html).toContain('>250<');
    expect(html).not.toContain('Available');
    expect(html).toContain('bj-value-chips__stash--reserved');
  });

  it('uses horizontal plaque chip targets in the combined row', () => {
    expect(CHIP_CSS).toMatch(/\.chip-token--plaque[\s\S]*--chip-plaque-width:\s*5\.5rem/);
    expect(CHIP_CSS).toMatch(/\.chip-token--plaque[\s\S]*--chip-plaque-height:\s*2\.25rem/);
  });

  it('aligns bankroll value left of chips with shared gap token', () => {
    expect(CHIP_CSS).toMatch(/\.bj-value-chips__row--main[\s\S]*justify-content:\s*flex-start/);
    expect(CHIP_CSS).toMatch(/\.bj-value-chips__balance[\s\S]*font-variant-numeric:\s*tabular-nums/);
    expect(CHIP_CSS).toMatch(/\.bj-value-chips__stash[\s\S]*overflow:\s*hidden/);
    expect(CHIP_CSS).toMatch(/\.bj-value-chips[\s\S]*--bj-chip-tray-gap:/);
    expect(CHIP_CSS).toMatch(/\.bj-value-chips \.chip-tray__chips[\s\S]*gap:\s*var\(--bj-chip-tray-gap\)/);
    expect(CHIP_CSS).not.toMatch(/\.bj-value-chips\s*\{[\s\S]*justify-content:\s*space-between/);
  });

  it('routes BlackjackPanel tray through ValueAndChipsBar', () => {
    expect(PANEL_SRC).toContain('ValueAndChipsBar');
    expect(PANEL_SRC).not.toContain('<ChipTray');
    expect(TABLE_UX.valueAndChips).toBe('bj-value-chips');
  });
});

describe('mobile player box dimension stability', () => {
  it('locks stake slot height in player boxes and CardView css', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-stake-slot[\s\S]*height:\s*var\(--bj-full-table-stake-min-height\)/,
    );
    expect(CARD_VIEW_CSS).toMatch(
      /\.bj-phone-view__mini-stake-slot[\s\S]*height:\s*var\(--bj-full-table-stake-min-height/,
    );
    expect(CARD_VIEW_CSS).not.toMatch(/\.bj-phone-view__mini-hand--has-stake[\s\S]*max-width:\s*4\.85rem/);
  });

  it('does not stretch selected or staked player boxes to width 100%', () => {
    const hasStakeBlock =
      SHARED_CSS.match(
        /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--has-stake,\s*\n\s*\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc\.bj-phone-view__mini-hand--has-stake\s*\{[\s\S]*?\}/,
      )?.[0] ?? '';
    expect(hasStakeBlock).toContain('width: var(--bj-full-table-box-width)');
    expect(hasStakeBlock).not.toContain('width: 100%');
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc\.bj-phone-view__bet-chip--pulse[\s\S]*width:\s*var\(--bj-full-table-box-width\)/,
    );
  });

  it('clips mobile player boxes without layout growth', () => {
    expect(SHARED_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.bj-view-full-mobile \.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc[\s\S]*overflow:\s*hidden/,
    );
  });
});

describe('Hit/Stand action panel background', () => {
  it('uses opaque casino panel background in shell actions zone', () => {
    expect(SHARED_CSS).toContain('--bj-actions-panel-bg: transparent');
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions[\s\S]*background:\s*transparent/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions \.bj-phone-view__action-bar--bare[\s\S]*background:\s*transparent/,
    );
  });
});

describe('desktop canonical vertical grid polish', () => {
  it('scopes cloth decor to cards/boxes band and enlarges rule text tokens', () => {
    const feltCss = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
    const clothSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackFeltClothLayer.tsx'), 'utf8');
    expect(feltCss).not.toMatch(/top:\s*calc\(/);
    expect(feltCss).toMatch(/\.bj-felt-cloth-layer__svg[\s\S]*width:\s*var\(--bj-cloth-svg-width\)/);
    expect(feltCss).toContain('--bj-cloth-insurance-font-size: 35px');
    expect(feltCss).toContain('--bj-cloth-dealer-rule-font-size: 33px');
    expect(clothSrc).toMatch(/trimmedWager \? `Playing for \$\{trimmedWager\}` : 'Insurance pays 2:1'/);
  });
});

describe('Full Table card stack bottom alignment', () => {
  it('bottom-aligns table card stacks in CardsArea for all viewports', () => {
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*justify-content:\s*flex-end/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-full-table-card-area[\s\S]*align-items:\s*end/,
    );
  });

  it('stacks cards upward with column-reverse toward dealer', () => {
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-arc__cards--stack-vertical \.bj-arc__cards-stack[\s\S]*flex-direction:\s*column-reverse/,
    );
  });

  it('does not use margin-top auto on mobile full-table arc cards row', () => {
    expect(PANEL_CSS).toMatch(/\.bj-view-full-mobile \.bj-arc--cards[\s\S]*margin-top:\s*0/);
    expect(PANEL_CSS).not.toMatch(/\.bj-view-full-mobile \.bj-arc--cards[\s\S]*margin-top:\s*auto/);
  });

  it('leaves Card View hero cards area centered', () => {
    expect(CARD_LAYOUT_CSS).toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*justify-content:\s*center/,
    );
  });
});
