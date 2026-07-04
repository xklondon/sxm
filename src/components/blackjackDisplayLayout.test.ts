import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { shared: SHARED_CSS, shell: SHELL_CSS } = readBlackjackLayoutCss();
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const SHELL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');
const COMMAND_BOX_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCommandBox.tsx'), 'utf8');
const ACTION_PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackActionPanel.tsx'), 'utf8');
const DEALER_AREA_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackDealerArea.tsx'), 'utf8');
const VIEW_ZONES_SRC = readFileSync(join(process.cwd(), 'src/components/blackjackViewZones.tsx'), 'utf8');
const CARD_AREA_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const TABLE_UX_SRC = readFileSync(join(process.cwd(), 'src/components/tableUxContract.ts'), 'utf8');

describe('blackjack display layout contract', () => {
  it('Card View and Full Table share one layout shell with command before cards and actions', () => {
    expect(PANEL_SRC).toContain('BlackjackTableLayoutShell');
    expect(SHELL_SRC).toContain('BlackjackCommandZone');
    expect(SHELL_SRC).toMatch(/BlackjackCommandZone[\s\S]*BlackjackCardsAreaZone/);
    expect(SHELL_SRC).toMatch(/BlackjackCardsAreaZone[\s\S]*BlackjackActionsZone/);
    expect(COMMAND_BOX_SRC).toContain('TABLE_UX.cardLayoutCommand');
    expect(SHARED_CSS).toContain('.bj-card-layout__command');
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__command[\s\S]*border-radius:\s*999px/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--actions[\s\S]*height:/);
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*flex:/);
  });

  it('Full Table and Card View share dealer, command, action, and box zone components', () => {
    expect(PANEL_SRC).toContain('BlackjackDealerArea');
    expect(PANEL_SRC).toContain('BlackjackCommandBox');
    expect(PANEL_SRC).toContain('BlackjackActionRow');
    expect(SHELL_SRC).toContain('BlackjackCommandZone');
    expect(SHELL_SRC).toContain('BlackjackActionsZone');
    expect(SHELL_SRC).toContain('BlackjackPlayerBoxesZone');
    expect(SHELL_SRC).toContain('BlackjackCardsAreaZone');
    expect(PANEL_SRC).toMatch(/BlackjackTableLayoutShell[\s\S]*BlackjackDealerArea/);
    expect(DEALER_AREA_SRC).toContain('bj-dealer-area');
    expect(VIEW_ZONES_SRC).toContain('BlackjackCommandZone');
    expect(VIEW_ZONES_SRC).toContain('BlackjackActionsZone');
    expect(VIEW_ZONES_SRC).toContain('BlackjackPlayerBoxesZone');
    expect(VIEW_ZONES_SRC).toContain('BlackjackCardsAreaZone');
    expect(CARD_VIEW_SRC).toContain('bj-phone-view__axis');
    expect(CARD_VIEW_SRC).not.toContain('BlackjackCommandZone');
  });

  it('Full Table and Card View dealer blocks omit inline command', () => {
    expect(PANEL_SRC).toContain('omitCommand');
    expect(PANEL_SRC).toContain('BlackjackCommandBox');
    expect(PANEL_SRC).toMatch(/BlackjackTableLayoutShell[\s\S]*BlackjackCommandBox/);
  });

  it('Full Table and Card View share BlackjackActionRow from Panel actions slot', () => {
    expect(PANEL_SRC).toContain('BlackjackActionRow');
    expect(PANEL_SRC).toContain('renderActionsContent');
    expect(ACTION_PANEL_SRC).toContain('TABLE_UX.playerActions');
    expect(CARD_VIEW_SRC).not.toContain('BlackjackActionPanel');
  });

  it('both views use canonical zone order in the layout shell', () => {
    expect(PANEL_SRC).toContain('BlackjackTableLayoutShell');
    expect(SHELL_SRC).toContain('TABLE_UX.tableLayoutShell');
    expect(SHELL_SRC).toMatch(/BlackjackCommandZone[\s\S]*BlackjackCardsAreaZone[\s\S]*BlackjackActionsZone[\s\S]*BlackjackPlayerBoxesZone/);
    expect(SHELL_SRC).toContain('TABLE_UX.tableZoneBottom');
    const shellBody = SHELL_SRC.slice(SHELL_SRC.indexOf('return ('));
    const shellOrder = [
      '{dealer}',
      'BlackjackCommandZone',
      'BlackjackCardsAreaZone',
      'BlackjackActionsZone',
      'BlackjackPlayerBoxesZone',
      'TABLE_UX.tableZoneBottom',
    ] as const;
    let lastIndex = -1;
    for (const token of shellOrder) {
      const idx = shellBody.indexOf(token);
      expect(idx).toBeGreaterThan(-1);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it('Full Table renders cards in dedicated cards zone above player boxes zone', () => {
    expect(SHELL_SRC).toContain('BlackjackCardsAreaZone');
    expect(PANEL_SRC).toContain('renderArcCardColumn');
    expect(PANEL_SRC).toContain('renderArcSlot');
    expect(PANEL_SRC).toContain('TABLE_UX.arcCardsStackVertical');
    expect(PANEL_SRC).toContain('TABLE_UX.arcCardsStack');
    expect(PANEL_SRC).toContain('bj-arc__play-zone');
    expect(PANEL_SRC).not.toMatch(/renderArcSlot[\s\S]*TABLE_UX\.cardsFan/);
    expect(PANEL_SRC).toMatch(
      /cardsAreaMode=\{viewMode === 'full' \? 'table' : 'hero'\}/,
    );
    expect(PANEL_SRC).toContain('renderPlayerBoxesArc');
  });

  it('Full Table arc stack uses medium-large readable overlapping cards', () => {
    expect(SHARED_CSS).toContain('--bj-table-card-overlap-2');
    expect(SHARED_CSS).toContain('--bj-table-card-overlap-3');
    expect(SHARED_CSS).toContain('--bj-table-card-overlap-4plus');
    expect(SHARED_CSS).toContain('--bj-table-card-height');
    expect(CARD_AREA_CSS).toMatch(
      /\[data-bj-card-count='2'\][\s\S]*--bj-table-card-overlap-2/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\[data-bj-card-count='3'\][\s\S]*--bj-table-card-overlap-3/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\[data-bj-card-count='4'\][\s\S]*--bj-table-card-overlap-4plus/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards\.bj-full-table-card-area \.bj-arc__cards--stack-vertical \.bj-arc__cards-stack \.playing-card[\s\S]*opacity:\s*1/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards\.bj-full-table-card-area \.bj-arc__cards--stack-vertical \.bj-arc__cards-stack \.playing-card[\s\S]*height:\s*var\(--bj-table-card-height\)/,
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

  it('Full Table action zone sits below cards and above player boxes', () => {
    expect(SHARED_CSS).toContain('--bj-command-cards-gap');
    expect(SHARED_CSS).toContain('--bj-cards-actions-gap');
    expect(SHELL_CSS).toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*margin:\s*var\(--bj-command-cards-gap\)/,
    );
    expect(SHELL_CSS).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*z-index:\s*5/);
    expect(SHELL_CSS).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*z-index:\s*6/);
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*z-index:\s*6/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*justify-content:\s*flex-end|\.bj-view-full-desktop \.bj-table-zone--boxes[\s\S]*justify-content:\s*flex-end/);
  });

  it('exports arc stack and card command layout class names', () => {
    expect(TABLE_UX_SRC).toContain("arcCardsStackVertical: 'bj-arc__cards--stack-vertical'");
    expect(TABLE_UX_SRC).toContain("arcCardsStack: 'bj-arc__cards-stack'");
    expect(TABLE_UX_SRC).toContain("tableZoneCards: 'bj-table-zone--cards'");
    expect(TABLE_UX_SRC).toContain("tableZoneBoxes: 'bj-table-zone--boxes'");
    expect(TABLE_UX_SRC).toContain("cardLayoutCommand: 'bj-card-layout__command'");
    expect(TABLE_UX_SRC).toContain("tableLayoutShell: 'bj-table-layout-shell'");
    expect(TABLE_UX_SRC).toContain("cardsAreaHero: 'bj-cards-area--hero'");
    expect(PANEL_SRC).toContain('buildBlackjackCommandText');
    expect(PANEL_SRC).toContain('BlackjackCommandBox');
    expect(PANEL_SRC).toContain('tableCommand.commandMessage');
    expect(PANEL_SRC).toContain('BlackjackCommandBox');
  });
});
