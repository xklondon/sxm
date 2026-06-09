import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MOBILE_LAYOUT_MEDIA } from '../styles/mobileLayoutContract';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
const SHELL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');

function shellZoneBlock(zone: string): string {
  const escaped = zone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    SHARED_CSS.match(
      new RegExp(`^\\.bj-table-layout-shell ${escaped}\\s*\\{[\\s\\S]*?\\}`, 'm'),
    )?.[0] ?? ''
  );
}

describe('layout shell reset — Full Table + Card View', () => {
  it('uses canonical DOM order in BlackjackTableLayoutShell', () => {
    const body = SHELL_SRC.slice(SHELL_SRC.indexOf('return ('));
    const order = [
      '{dealer}',
      'BlackjackCommandZone',
      'BlackjackActionsZone',
      'BlackjackCardsAreaZone',
      'BlackjackPlayerBoxesZone',
      'TABLE_UX.tableZoneBottom',
    ] as const;
    let last = -1;
    for (const token of order) {
      const idx = body.indexOf(token);
      expect(idx).toBeGreaterThan(-1);
      expect(idx).toBeGreaterThan(last);
      last = idx;
    }
  });

  it('does not mount legacy mini-row or card-layout composition wrappers', () => {
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-phone-view__mini-row[\s\S]*display:\s*none\s*!important/);
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-phone-view__betting-stage--row[\s\S]*display:\s*none\s*!important/);
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-card-layout[\s\S]*display:\s*contents/);
    expect(CARD_LAYOUT_CSS).not.toMatch(/\.bj-card-layout__boxes\s*\{/);
    expect(CARD_LAYOUT_CSS).not.toMatch(/\.bj-card-layout__actions\s*\{/);
    expect(CARD_LAYOUT_CSS).not.toMatch(/\.bj-card-layout__hero\s*\{/);
    expect(PANEL_CSS).not.toMatch(/\.bj-view-card-mobile \.bj-card-layout__boxes/);
  });

  it('does not add Card View-only owned-slot chrome', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-arc__slot--owned[\s\S]*background:\s*none/,
    );
    expect(PANEL_CSS).not.toMatch(/\.bj-view-card-mobile \.bj-arc__slot--owned[\s\S]*padding:/);
    expect(CARD_LAYOUT_CSS).not.toMatch(/bj-arc__slot--owned/);
  });

  it('styles command in summary zone with wrap-friendly pill treatment', () => {
    expect(shellZoneBlock('.bj-table-zone--summary')).toContain('min-height: var(--bj-zone-command-height)');
    expect(shellZoneBlock('.bj-table-zone--summary')).toContain('max-height: var(--bj-zone-command-max-height)');
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__command[\s\S]*border-radius:\s*999px/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__status\s*\{[\s\S]*?white-space:\s*normal[\s\S]*?\}/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__status\s*\{[\s\S]*?text-overflow:\s*clip[\s\S]*?\}/,
    );
  });

  it('shares shell zone dimensions across views at desktop and mobile breakpoints', () => {
    for (const view of ['bj-view-full-desktop', 'bj-view-card-desktop'] as const) {
      expect(SHARED_CSS).not.toMatch(
        new RegExp(`\\.${view} \\.bj-table-zone--dealer\\s*\\{[\\s\\S]*height:`),
      );
      expect(SHARED_CSS).not.toMatch(
        new RegExp(`\\.${view} \\.bj-table-zone--boxes\\s*\\{[\\s\\S]*height:`),
      );
    }

    expect(SHARED_CSS).toContain(MOBILE_LAYOUT_MEDIA);
    expect(SHARED_CSS).toMatch(/@media \(orientation: landscape\)/);
    expect(SHARED_CSS).toContain('--bj-mobile-zone-dealer-height: 6.25rem');
    expect(SHARED_CSS).toContain('--bj-mobile-zone-command-height: 2.65rem');

    const cardsBlock =
      SHARED_CSS.match(
        /\.bj-table-layout-shell \.bj-table-zone--cards,\s*\n\s*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero,\s*\n\s*\.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--table\s*\{[\s\S]*?\}/,
      )?.[0] ?? '';
    expect(cardsBlock).toContain('flex: 1 1 auto');
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*overflow:\s*visible/);
  });

  it('keeps player boxes inside felt with overflow guard and shared arc styling', () => {
    expect(shellZoneBlock('.bj-table-zone--boxes')).toMatch(/overflow:\s*hidden/);
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes \.bj-arc--player-boxes[\s\S]*overflow:\s*hidden/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-arc--player-boxes,\s*\n\s*\.bj-view-card-mobile \.bj-arc--player-boxes[\s\S]*overflow:\s*hidden/,
    );
    expect(PANEL_CSS).toMatch(/\.bj-view-card-mobile[\s\S]*overflow-x:\s*hidden/);
  });

  it('places action panel above cards area without absolute overlap', () => {
    const actionsBlock = shellZoneBlock('.bj-table-zone--actions');
    expect(actionsBlock).toContain('height: var(--bj-zone-actions-height)');
    expect(actionsBlock).not.toMatch(/position:\s*absolute/);
    expect(SHELL_SRC.indexOf('BlackjackActionsZone')).toBeLessThan(
      SHELL_SRC.indexOf('BlackjackCardsAreaZone'),
    );
  });

  it('only CardsArea content differs between hero and table modes in CSS', () => {
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-table-zone--cards\.bj-cards-area--hero/);
    expect(CARD_LAYOUT_CSS).not.toMatch(/\.bj-table-zone--actions\s*\{/);
    expect(CARD_LAYOUT_CSS).not.toMatch(/\.bj-table-zone--boxes\s*\{/);
    expect(CARD_LAYOUT_CSS).not.toMatch(/\.bj-table-zone--summary\s*\{/);
  });
});
