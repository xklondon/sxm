import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const CHIP_CSS = readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8');
const SHELL_SRC = readFileSync(
  join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'),
  'utf8',
);

describe('blackjack proportion tuning — zone tokens and Stitch-aligned surfaces', () => {
  it('uses compact dealer and taller command/actions/tray desktop rows', () => {
    expect(SHELL_CSS).toContain('--bj-desktop-zone-dealer-height: 7.15rem');
    expect(SHELL_CSS).toContain('--bj-desktop-zone-command-height: 4.35rem');
    expect(SHELL_CSS).toContain('--bj-desktop-zone-actions-height: 2.5rem');
    expect(SHELL_CSS).toContain('--bj-desktop-zone-tray-height: 4.15rem');
  });

  it('keeps command text visible with Stitch-style pill and no ellipsis clip', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__command[\s\S]*padding:\s*0\.38rem 1\.5rem/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__command[\s\S]*background:\s*rgb\(10 61 42/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--summary \.dealer-block__status[\s\S]*display:\s*block/,
    );
    expect(SHARED_CSS).not.toMatch(
      /@media \(min-width: 721px\)[\s\S]*\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__status[\s\S]*text-overflow:\s*ellipsis/,
    );
  });

  it('uses transparent action panel with compact primary buttons anchored in actions row', () => {
    expect(SHARED_CSS).toContain('--bj-actions-panel-bg: transparent');
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions[\s\S]*background:\s*transparent/,
    );
    expect(SHARED_CSS).toContain('--bj-actions-primary-btn-min-height: 1.65rem');
    expect(SHARED_CSS).toContain('--bj-actions-primary-btn-max-height: 1.65rem');
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions__btn[\s\S]*max-height:\s*var\(--bj-actions-primary-btn-max-height\)/,
    );
  });

  it('fills CardsArea cloth band without moving cloth out of CardsArea', () => {
    expect(FELT_CSS).toContain('--bj-cloth-svg-width:');
    expect(FELT_CSS).toContain('--bj-cloth-svg-max-height:');
    expect(FELT_CSS).toMatch(
      /\.bj-felt-cloth-layer__svg[\s\S]*max-height:\s*var\(--bj-cloth-svg-max-height\)/,
    );
    expect(FELT_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--cards > \.bj-felt-cloth-layer/);
    expect(SHELL_SRC).toMatch(
      /<BlackjackCardsAreaZone[\s\S]*\{feltClothLayer\}[\s\S]*\{cardsArea\}/,
    );
  });

  it('aligns bankroll value left of chips with tabular numerals', () => {
    expect(CHIP_CSS).toMatch(/\.bj-value-chips__balance[\s\S]*font-variant-numeric:\s*tabular-nums/);
    expect(CHIP_CSS).toMatch(/\.bj-value-chips__row--main[\s\S]*justify-content:\s*flex-start/);
    expect(CHIP_CSS).toMatch(/\.bj-value-chips[\s\S]*min-height:\s*3\.15rem/);
    expect(CHIP_CSS).toMatch(/\.chip-token--plaque[\s\S]*--chip-plaque-width:\s*5\.5rem/);
  });

  it('does not change shell zone order or API', () => {
    expect(SHELL_SRC).toContain('feltClothLayer?: ReactNode');
    const renderBlock = SHELL_SRC.match(/return \(\s*[\s\S]*?\n  \);/)?.[0] ?? '';
    expect(renderBlock.indexOf('{dealer}')).toBeLessThan(renderBlock.indexOf('BlackjackCommandZone'));
    expect(renderBlock.indexOf('BlackjackCommandZone')).toBeLessThan(renderBlock.indexOf('BlackjackCardsAreaZone'));
    expect(renderBlock.indexOf('BlackjackCardsAreaZone')).toBeLessThan(renderBlock.indexOf('BlackjackActionsZone'));
    expect(renderBlock.indexOf('BlackjackActionsZone')).toBeLessThan(renderBlock.indexOf('BlackjackPlayerBoxesZone'));
  });
});
