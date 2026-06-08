import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TABLE_UX } from './tableUxContract';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
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
    expect(PANEL_SRC).toMatch(/function renderArcBoxSlot[\s\S]*bindBoxTapSelect[\s\S]*selectBox\(boxId\)/);
    expect(PANEL_SRC).toMatch(/function renderEmptyBoxSlot[\s\S]*bindBoxTapSelect[\s\S]*handleClaimOrSelectSlot/);
  });

  it('Card View and Full Table player boxes use shared arc hit areas from Panel', () => {
    expect(CARD_SRC).not.toContain('renderPlayerBoxesArc');
    expect(PANEL_SRC).toContain('renderPlayerBoxesArc');
    expect(PANEL_SRC).toContain('TABLE_UX.boxHitArea');
    expect(PANEL_SRC).toContain('bindBoxTapSelect');
    expect(PANEL_SRC).toMatch(/function renderArcBoxSlot[\s\S]*TABLE_UX\.boxHitArea/);
  });

  it('bet zone no longer blocks selection with stopPropagation on click', () => {
    const start = PANEL_SRC.indexOf('function renderBetZone');
    const end = PANEL_SRC.indexOf('function handleMovePlayer', start);
    const block = PANEL_SRC.slice(start, end);
    expect(block).not.toMatch(/onClick=\{\(e\) => e\.stopPropagation\(\)\}/);
    expect(block).toMatch(/bindBoxTapSelect\(\(\) => selectBox\(boxId\)\)/);
  });

  it('card stacks and labels pass taps through to the hit area', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-box-hit-zone \.bj-arc__play-zone[\s\S]*pointer-events:\s*none/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-box-hit-zone \.bj-phone-view__mini-hand-card-stack[\s\S]*pointer-events:\s*none/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-box-interactive,\s*\n\.bj-box-interactive \*,[\s\S]*pointer-events:\s*auto/);
  });

  it('chip drop controls stay interactive above the hit area', () => {
    expect(SHARED_CSS).toMatch(/\.bj-bet-zone,\s*\n\.bj-bet-zone \*,[\s\S]*pointer-events:\s*auto/);
    expect(SHARED_CSS).toMatch(/\.stake-chips__remove[\s\S]*pointer-events:\s*auto/);
    expect(PANEL_SRC).toContain('TABLE_UX.boxInteractive');
  });
});

describe('mobile landscape Full Table fit', () => {
  it('compresses Full Table zones and hides vertical overflow in landscape', () => {
    expect(SHARED_CSS).toMatch(
      /@media \(orientation: landscape\)[\s\S]*--bj-table-zone-play-min-height:\s*0/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt-main[\s\S]*overflow:\s*hidden/,
    );
    expect(PANEL_CSS).toMatch(/\.bj-view-full-mobile \.bj-casino__felt-main[\s\S]*overflow-y:\s*hidden/);
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-zone--boxes[\s\S]*min-height:\s*0/,
    );
  });

  it('keeps chip tray pinned in mobile landscape', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__tray-wrap[\s\S]*flex-shrink:\s*0/,
    );
  });
});
