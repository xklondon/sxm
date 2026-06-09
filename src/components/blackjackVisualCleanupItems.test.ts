import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEALER_SRC = readFileSync(join(process.cwd(), 'src/components/DealerBlock.tsx'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const SETTINGS_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackFlowSettings.tsx'), 'utf8');
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const CHIP_CSS = readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8');

describe('blackjack visual cleanup items', () => {
  it('removes Table Details button from dealer area', () => {
    expect(DEALER_SRC).not.toContain('dealer-block__details-btn');
    expect(DEALER_SRC).not.toContain('onOpenTableDetails');
    expect(PANEL_SRC).not.toContain('onOpenTableDetails');
  });

  it('exposes table details through Settings menu', () => {
    expect(SETTINGS_SRC).toContain('TableDetailsPanelContent');
    expect(SETTINGS_SRC).toContain('tableDetails?: TableDetailsPanelProps');
    expect(PANEL_SRC).toMatch(/BlackjackFlowSettingsMenu[\s\S]*tableDetails=\{tableDetailsProps\}/);
  });

  it('increases cloth typography tokens within bounded range', () => {
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size: 56px');
    expect(FELT_CSS).toContain('--bj-cloth-insurance-font-size: 35px');
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size-mobile: 48px');
    expect(FELT_CSS).toContain('--bj-cloth-insurance-font-size-mobile: 30px');
  });

  it('keeps chips mounted during play with inactive styling when betting closed', () => {
    expect(PANEL_SRC).toMatch(/ValueAndChipsBar[\s\S]*showChips[\s\S]*disabled=\{!bettingOpen\}/);
    expect(PANEL_SRC).not.toMatch(/showChips=\{inBetting\}/);
    expect(CHIP_CSS).toContain('.bj-value-chips__stash--inactive');
  });

  it('uses transparent borderless action panel chrome in shell actions zone', () => {
    expect(SHARED_CSS).toContain('--bj-actions-panel-bg: transparent');
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions[\s\S]*background:\s*transparent/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions[\s\S]*border:\s*none/,
    );
  });

  it('sizes Card View hero cards from CardsArea height via container queries', () => {
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*container-type:\s*size/,
    );
    expect(LAYOUT_CSS).toMatch(/@container bj-hero-cards[\s\S]*58cqh/);
    expect(LAYOUT_CSS).toContain('--bj-card-hero-card-max-height: min(22vh, 9.5rem)');
    expect(LAYOUT_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table \.bj-arc--cards[\s\S]*overflow:\s*hidden/,
    );
  });
});
