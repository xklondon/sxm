import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FULL_TABLE_ACTIONS_RENDER_FN,
  FULL_TABLE_FORBIDDEN_CARD_AREA_ACTION_MARKERS,
  FULL_TABLE_PLAY_ZONE_CSS,
  FULL_TABLE_SHELL_ZONE_ORDER,
  FULL_TABLE_CARD_COLUMN_VIEW_ROOTS,
} from './blackjackLayoutContract';

const PLAY_ZONE_CSS = readFileSync(join(process.cwd(), FULL_TABLE_PLAY_ZONE_CSS), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const SHELL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');
const INDEX_CSS = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');

describe('Full Table play zone canonical contract', () => {
  it('imports play-zone CSS after shared, player-row, and card-layout', () => {
    expect(INDEX_CSS.indexOf('bj-table-shared.css')).toBeLessThan(INDEX_CSS.indexOf('bj-card-layout.css'));
    expect(INDEX_CSS.indexOf('bj-card-layout.css')).toBeLessThan(INDEX_CSS.indexOf('bj-full-table-card-area.css'));
    expect(INDEX_CSS.indexOf('bj-full-table-card-area.css')).toBeLessThan(INDEX_CSS.indexOf('bj-felt-skins.css'));
  });

  it('documents shell zone order dealer → command → cards → actions → boxes → tray', () => {
    expect(FULL_TABLE_SHELL_ZONE_ORDER).toEqual(['dealer', 'command', 'cards', 'actions', 'boxes', 'tray']);
    expect(SHELL_SRC).toMatch(/dealer[\s\S]*BlackjackCommandZone[\s\S]*BlackjackCardsAreaZone[\s\S]*BlackjackActionsZone[\s\S]*BlackjackPlayerBoxesZone/);
  });

  it('uses one Full Table actions render path via shell actions slot', () => {
    expect(PANEL_SRC).toContain(FULL_TABLE_ACTIONS_RENDER_FN);
    expect(PANEL_SRC).toContain('actions={renderActionsContent()}');
    expect(PANEL_SRC).toContain('BlackjackActionPanel');
    expect(CARD_VIEW_SRC).not.toContain('BlackjackActionPanel');
    expect((PANEL_SRC.match(/<BlackjackActionPanel/g) ?? []).length).toBe(1);
  });

  it('hides action controls inside Full Table card area via CSS guard', () => {
    for (const marker of FULL_TABLE_FORBIDDEN_CARD_AREA_ACTION_MARKERS) {
      expect(PLAY_ZONE_CSS).toContain(`.bj-table-zone--cards.bj-cards-area--table .${marker}`);
      expect(PLAY_ZONE_CSS).toMatch(
        new RegExp(
          `\\.bj-view-full-desktop \\.bj-table-zone--cards\\.bj-cards-area--table \\.${marker.replace(/\./g, '\\.')}[\\s\\S]*display:\\s*none`,
        ),
      );
    }
  });

  it('bottom-pins card columns with visible stacks (no clip on 2-card hands)', () => {
    expect(PLAY_ZONE_CSS).toContain('--bj-full-table-card-stack-zone-min-2');
    const cardZoneRule =
      PLAY_ZONE_CSS.match(
        /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table\s*\{[^}]*\}/,
      )?.[0] ?? '';
    expect(cardZoneRule).toMatch(/overflow-y:\s*visible/);
    expect(cardZoneRule).not.toMatch(/[^-]overflow:\s*hidden/);
    for (const viewRoot of FULL_TABLE_CARD_COLUMN_VIEW_ROOTS) {
      expect(PLAY_ZONE_CSS).toMatch(
        new RegExp(
          `\\.${viewRoot} \\.bj-arc--cards\\.bj-full-table-card-area \\.bj-arc__slot--card-column > \\.bj-phone-view__box-value--card-column-below[\\s\\S]*grid-row:\\s*3`,
        ),
      );
    }
  });

  it('does not reintroduce competing card-area layout in shared, card-layout, or panel CSS', () => {
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards\s*\{[^}]*overflow:\s*hidden/,
    );
    expect(CARD_LAYOUT_CSS).not.toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table \.bj-arc--cards[\s\S]*overflow:\s*hidden/,
    );
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table \.bj-table-slot-row\.bj-arc--cards\s*\{[^}]*height:\s*100%/,
    );
    expect(PANEL_CSS).not.toMatch(/\.bj-view-full-mobile \.bj-arc--cards\s*\{[^}]*flex:\s*1\s+1\s+auto/);
    expect(PANEL_CSS).toContain('.bj-arc--cards:not(.bj-full-table-card-area) .bj-arc__slot');
  });

  it('styles Full Table desktop and mobile action zone under card area', () => {
    expect(PLAY_ZONE_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*height:\s*var\(--bj-zone-actions-height\)/,
    );
    expect(PLAY_ZONE_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*height:\s*var\(--bj-zone-actions-height\)/,
    );
    expect(PLAY_ZONE_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--actions \.ds-btn--hit/,
    );
  });

  it('marks card arc row with FULL_TABLE_CARD_AREA_CLASS in panel', () => {
    expect(PANEL_SRC).toContain('FULL_TABLE_CARD_AREA_CLASS');
    expect(PANEL_SRC).toMatch(/['"]bj-arc--cards['"][\s\S]*FULL_TABLE_CARD_AREA_CLASS/);
  });
});
