import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const TABLE_UX_SRC = readFileSync(join(process.cwd(), 'src/components/tableUxContract.ts'), 'utf8');

describe('blackjack display layout contract', () => {
  it('Card View places command between dealer row and hero display', () => {
    expect(CARD_VIEW_SRC).toContain('dealerCommand');
    expect(CARD_VIEW_SRC).toContain('TABLE_UX.cardLayoutCommand');
    expect(CARD_VIEW_SRC).toMatch(/cardLayoutDealer[\s\S]*cardLayoutSummary/);
    expect(CARD_LAYOUT_CSS).toContain('.bj-card-layout__command');
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-card-layout__command \.dealer-block__command[\s\S]*max-height:/);
  });

  it('Card View dealer block omits inline command', () => {
    expect(PANEL_SRC).toContain('omitCommand');
    expect(PANEL_SRC).toContain('DealerCommandArea');
    expect(PANEL_SRC).toMatch(/viewMode === 'card'[\s\S]*omitCommand/);
  });

  it('Full Table stacks player cards vertically above each box', () => {
    expect(PANEL_SRC).toContain('TABLE_UX.arcCardsStackVertical');
    expect(PANEL_SRC).toContain('TABLE_UX.arcCardsStack');
    expect(PANEL_SRC).toContain('bj-arc__play-zone');
    expect(PANEL_SRC).not.toMatch(
      /renderArcSlot[\s\S]*TABLE_UX\.cardsFan/,
    );
    expect(SHARED_CSS).toContain('.bj-arc__cards--stack-vertical');
    expect(SHARED_CSS).toContain('.bj-arc__cards-stack');
    expect(SHARED_CSS).toMatch(/flex-direction:\s*column-reverse/);
    expect(SHARED_CSS).toMatch(/\.bj-arc__cards-stack \.playing-card[\s\S]*margin-left:\s*0/);
  });

  it('exports arc stack and card command layout class names', () => {
    expect(TABLE_UX_SRC).toContain("arcCardsStackVertical: 'bj-arc__cards--stack-vertical'");
    expect(TABLE_UX_SRC).toContain("arcCardsStack: 'bj-arc__cards-stack'");
    expect(TABLE_UX_SRC).toContain("cardLayoutCommand: 'bj-card-layout__command'");
  });
});
