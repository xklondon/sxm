import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TABLE_UX } from './tableUxContract';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');

describe('box hit area — single reliable tap target', () => {
  it('exports canonical hit-area classes in TABLE_UX', () => {
    expect(TABLE_UX.boxHitZone).toBe('bj-box-hit-zone');
    expect(TABLE_UX.boxHitArea).toBe('bj-box-hit-area');
    expect(TABLE_UX.boxInteractive).toBe('bj-box-interactive');
  });

  it('Full Table arc slots use TABLE_UX.boxHitArea for selection', () => {
    expect(PANEL_SRC).toContain('TABLE_UX.boxHitArea');
    expect(PANEL_SRC).toContain('TABLE_UX.boxHitZone');
    expect(PANEL_SRC).toContain('bindBoxTapSelect');
    expect(PANEL_SRC).toMatch(/function renderArcSlot[\s\S]*bindBoxTapSelect[\s\S]*onSelect/);
    expect(PANEL_SRC).toMatch(/function renderArcSlot[\s\S]*handleBoxTap/);
    expect(PANEL_SRC).toContain('handleClaimOrSelectSlot');
  });

  it('Card View and Full Table player boxes use shared arc hit areas from Panel', () => {
    expect(CARD_SRC).not.toContain('renderPlayerBoxesArc');
    expect(PANEL_SRC).toContain('renderPlayerBoxesArc');
    expect(PANEL_SRC).toContain('TABLE_UX.boxHitArea');
    expect(PANEL_SRC).toContain('bindBoxTapSelect');
    expect(PANEL_SRC).toMatch(/function renderArcSlot[\s\S]*TABLE_UX\.boxHitArea/);
  });

  it('arc stake slot uses bindBoxTapSelect without renderBetZone click stopPropagation', () => {
    expect(PANEL_SRC).not.toContain('function renderBetZone');
    expect(PANEL_SRC).toMatch(/function renderArcSlot[\s\S]*bindBoxTapSelect\(onSelect\)/);
  });

  it('card stacks and labels pass taps through to the hit area', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-box-hit-zone \.bj-arc__play-zone[\s\S]*pointer-events:\s*none/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-box-hit-zone \.bj-phone-view__mini-hand-card-stack[\s\S]*pointer-events:\s*none/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-box-interactive \{\s*[\s\S]*pointer-events:\s*none/);
    expect(SHARED_CSS).toMatch(/\.bj-box-hit-area[\s\S]*min-height:\s*44px/);
    expect(SHARED_CSS).toMatch(/\.bj-box-hit-area[\s\S]*touch-action:\s*manipulation/);
  });

  it('only retract controls stay interactive above the hit area', () => {
    expect(SHARED_CSS).toMatch(/\.bj-box-interactive \.stake-chips__remove[\s\S]*pointer-events:\s*auto/);
    expect(SHARED_CSS).toMatch(/\.stake-chips__remove[\s\S]*pointer-events:\s*auto/);
    expect(PANEL_SRC).toContain('TABLE_UX.boxInteractive');
    expect(PANEL_SRC).toContain('handleBoxTap');
  });
});

describe('mobile landscape Full Table fit', () => {
  it('compresses Full Table zones and hides vertical overflow in landscape', () => {
    expect(SHARED_CSS).toMatch(
      /@media \(orientation: landscape\)[\s\S]*--bj-mobile-zone-boxes-height:\s*calc\([\s\S]*--bj-box-value-band-height/,
    );
    expect(SHARED_CSS).toMatch(
      /@media \(min-width: 721px\) and \(orientation: landscape\)[\s\S]*--bj-zone-dealer-height:\s*4\.25rem/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt-main,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt-main[\s\S]*overflow:\s*hidden/,
    );
    expect(PANEL_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt-main[\s\S]*overflow-y:\s*hidden[\s\S]*padding:/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*overflow:\s*hidden/,
    );
  });

  it('keeps chip tray pinned in mobile landscape', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__tray-wrap,\s*\n\s*\.bj-view-card-mobile \.bj-casino__tray-wrap[\s\S]*flex-shrink:\s*0/,
    );
  });
});
