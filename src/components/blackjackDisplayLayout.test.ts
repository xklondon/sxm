import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const COMMAND_BOX_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCommandBox.tsx'), 'utf8');
const ACTION_PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackActionPanel.tsx'), 'utf8');
const DEALER_AREA_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackDealerArea.tsx'), 'utf8');
const VIEW_ZONES_SRC = readFileSync(join(process.cwd(), 'src/components/blackjackViewZones.tsx'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const TABLE_UX_SRC = readFileSync(join(process.cwd(), 'src/components/tableUxContract.ts'), 'utf8');

describe('blackjack display layout contract', () => {
  it('Card View places command in summary before actions and hero cards', () => {
    expect(CARD_VIEW_SRC).toContain('dealerCommand');
    expect(COMMAND_BOX_SRC).toContain('TABLE_UX.cardLayoutCommand');
    expect(CARD_VIEW_SRC).toContain('BlackjackCommandZone');
    expect(CARD_VIEW_SRC).toMatch(/BlackjackCommandZone[\s\S]*BlackjackActionsZone/);
    expect(CARD_VIEW_SRC).toMatch(/BlackjackActionsZone[\s\S]*BlackjackCardsAreaZone/);
    expect(CARD_LAYOUT_CSS).toContain('.bj-card-layout__command');
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-card-layout__command \.dealer-block__command[\s\S]*max-height:/);
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-card-layout__actions[\s\S]*grid-row:\s*3/);
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-card-layout__hero[\s\S]*grid-row:\s*4/);
  });

  it('Full Table and Card View share dealer, command, action, and box zone components', () => {
    expect(PANEL_SRC).toContain('BlackjackDealerArea');
    expect(PANEL_SRC).toContain('BlackjackCommandBox');
    expect(PANEL_SRC).toContain('BlackjackActionPanel');
    expect(PANEL_SRC).toContain('BlackjackCommandZone');
    expect(PANEL_SRC).toContain('BlackjackActionsZone');
    expect(PANEL_SRC).toContain('BlackjackPlayerBoxesZone');
    expect(PANEL_SRC).toContain('BlackjackCardsAreaZone');
    expect(CARD_VIEW_SRC).toContain('BlackjackActionPanel');
    expect(CARD_VIEW_SRC).toContain('BlackjackCommandZone');
    expect(CARD_VIEW_SRC).toContain('BlackjackActionsZone');
    expect(CARD_VIEW_SRC).toContain('BlackjackPlayerBoxesZone');
    expect(CARD_VIEW_SRC).toContain('BlackjackCardsAreaZone');
    expect(PANEL_SRC).toMatch(/viewMode === 'card'[\s\S]*BlackjackDealerArea/);
    expect(DEALER_AREA_SRC).toContain("variant?: 'table' | 'card'");
    expect(VIEW_ZONES_SRC).toContain('BlackjackCommandZone');
    expect(VIEW_ZONES_SRC).toContain('BlackjackActionsZone');
    expect(VIEW_ZONES_SRC).toContain('BlackjackPlayerBoxesZone');
    expect(VIEW_ZONES_SRC).toContain('BlackjackCardsAreaZone');
  });

  it('Full Table and Card View dealer blocks omit inline command', () => {
    expect(PANEL_SRC).toContain('omitCommand');
    expect(PANEL_SRC).toContain('BlackjackCommandBox');
    expect(PANEL_SRC).toMatch(/renderSummaryZone[\s\S]*BlackjackCommandBox/);
    expect(PANEL_SRC).toMatch(/viewMode === 'card'[\s\S]*BlackjackCommandBox/);
  });

  it('Full Table and Card View share BlackjackActionPanel', () => {
    expect(PANEL_SRC).toContain('BlackjackActionPanel');
    expect(CARD_VIEW_SRC).toContain('BlackjackActionPanel');
    expect(ACTION_PANEL_SRC).toContain('TABLE_UX.playerActions');
  });

  it('Full Table uses canonical zone order in felt main', () => {
    expect(PANEL_SRC).toMatch(/renderSummaryZone[\s\S]*BlackjackCommandZone/);
    expect(PANEL_SRC).toMatch(/renderBottomTrayZone[\s\S]*TABLE_UX\.tableZoneBottom/);
    const feltBlock =
      PANEL_SRC.match(/bj-casino__felt-main[\s\S]*renderBottomTrayZone\(\)/)?.[0] ?? '';
    const inlineOrder = [
      'BlackjackDealerArea',
      'renderSummaryZone()',
      'renderActionsZone()',
      'BlackjackCardsAreaZone',
      'BlackjackPlayerBoxesZone',
      'renderBottomTrayZone()',
    ] as const;
    let lastIndex = -1;
    for (const token of inlineOrder) {
      const idx = feltBlock.indexOf(token);
      expect(idx).toBeGreaterThan(-1);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it('Full Table renders cards in dedicated cards zone above player boxes zone', () => {
    expect(PANEL_SRC).toContain('BlackjackCardsAreaZone');
    expect(PANEL_SRC).toContain('BlackjackPlayerBoxesZone');
    expect(PANEL_SRC).toContain('renderArcCardColumn');
    expect(PANEL_SRC).toContain('renderArcBoxSlot');
    expect(PANEL_SRC).toContain('TABLE_UX.arcCardsStackVertical');
    expect(PANEL_SRC).toContain('TABLE_UX.arcCardsStack');
    expect(PANEL_SRC).toContain('bj-arc__play-zone');
    expect(PANEL_SRC).not.toMatch(/renderArcBoxSlot[\s\S]*TABLE_UX\.cardsFan/);
    expect(PANEL_SRC).toMatch(
      /BlackjackCardsAreaZone[\s\S]*renderArcCardColumn[\s\S]*BlackjackPlayerBoxesZone[\s\S]*renderArcBoxSlot/,
    );
  });

  it('Full Table arc stack uses medium-large readable overlapping cards', () => {
    expect(SHARED_CSS).toContain('--bj-table-card-overlap-2');
    expect(SHARED_CSS).toContain('--bj-table-card-overlap-3');
    expect(SHARED_CSS).toContain('--bj-table-card-overlap-4plus');
    expect(SHARED_CSS).toContain('--bj-table-card-height');
    expect(SHARED_CSS).toMatch(
      /\[data-bj-card-count='2'\][\s\S]*--bj-table-card-overlap-2/,
    );
    expect(SHARED_CSS).toMatch(
      /\[data-bj-card-count='3'\][\s\S]*--bj-table-card-overlap-3/,
    );
    expect(SHARED_CSS).toMatch(
      /\[data-bj-card-count='4'\][\s\S]*--bj-table-card-overlap-4plus/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc__cards--stack-vertical \.bj-arc__cards-stack \.playing-card[\s\S]*opacity:\s*1/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc__cards--stack-vertical \.bj-arc__cards-stack \.playing-card[\s\S]*height:\s*var\(--bj-table-card-height\)/,
    );
    expect(SHARED_CSS).not.toContain('--bj-table-card-strip-visible');
    expect(SHARED_CSS).not.toMatch(
      /\.bj-arc__cards--stack-vertical[\s\S]*overflow:\s*hidden[\s\S]*--bj-table-card-stack-max-height/,
    );

    const overlap2 = parseFloat(
      /--bj-table-card-overlap-2:\s*([\d.]+rem)/.exec(SHARED_CSS)?.[1] ?? '0',
    );
    const overlap3 = parseFloat(
      /--bj-table-card-overlap-3:\s*([\d.]+rem)/.exec(SHARED_CSS)?.[1] ?? '0',
    );
    const overlap4 = parseFloat(
      /--bj-table-card-overlap-4plus:\s*([\d.]+rem)/.exec(SHARED_CSS)?.[1] ?? '0',
    );
    expect(overlap2).toBeLessThan(overlap3);
    expect(overlap3).toBeLessThan(overlap4);
  });

  it('Full Table boxes use compact sizing variables', () => {
    expect(SHARED_CSS).toContain('--bj-full-table-box-width');
    expect(SHARED_CSS).toContain('--bj-full-table-box-height');
    expect(SHARED_CSS).toContain('--bj-full-table-box-gap');
    expect(SHARED_CSS).toMatch(
      /\.bj-phone-view__mini-hand--full-arc[\s\S]*padding:\s*var\(--bj-full-table-box-padding\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-phone-view__mini-hand--full-arc \.bj-phone-view__mini-stake-slot[\s\S]*margin-top:\s*0/,
    );
  });

  it('Full Table action zone clears player card stacks', () => {
    expect(SHARED_CSS).toContain('--bj-table-actions-play-gap');
    expect(SHARED_CSS).toContain('--bj-table-play-actions-buffer');
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-zone--actions[\s\S]*z-index:\s*6[\s\S]*margin-bottom:\s*var\(--bj-table-actions-play-gap\)/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-view-full-mobile \.bj-table-zone--actions[\s\S]*z-index:\s*6/);
    expect(SHARED_CSS).toMatch(/\.bj-view-full-desktop \.bj-table-zone--cards[\s\S]*padding-top:\s*var\(--bj-table-play-actions-buffer\)/);
    expect(SHARED_CSS).toMatch(/\.bj-view-full-desktop \.bj-table-zone--boxes[\s\S]*justify-content:\s*flex-end/);
  });

  it('exports arc stack and card command layout class names', () => {
    expect(TABLE_UX_SRC).toContain("arcCardsStackVertical: 'bj-arc__cards--stack-vertical'");
    expect(TABLE_UX_SRC).toContain("arcCardsStack: 'bj-arc__cards-stack'");
    expect(TABLE_UX_SRC).toContain("tableZoneCards: 'bj-table-zone--cards'");
    expect(TABLE_UX_SRC).toContain("tableZoneBoxes: 'bj-table-zone--boxes'");
    expect(TABLE_UX_SRC).toContain("cardLayoutCommand: 'bj-card-layout__command'");
    expect(PANEL_SRC).toContain('buildBlackjackCommandText');
    expect(PANEL_SRC).toContain('BlackjackCommandBox');
    expect(PANEL_SRC).toMatch(/tableCommand\.commandMessage[\s\S]*BlackjackCommandBox/);
  });
});
