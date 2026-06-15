import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
const CARD_AREA_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

describe('blackjack desktop polish contracts', () => {
  it('aligns desktop toolbar nav to felt horizontal inset', () => {
    expect(PANEL_CSS).toMatch(
      /\.bj-view-full-desktop\.bj-casino \.bj-table-desktop-shell > \.bj-casino__table-header \.bj-casino__toolbar[\s\S]*padding-inline:\s*calc\(0\.5rem \+ 0\.45rem\)/,
    );
  });

  it('places Full Table card values in fixed bottom grid row on desktop and mobile', () => {
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc--cards\.bj-full-table-card-area \.bj-arc__slot--card-column > \.bj-phone-view__box-value--card-column-below[\s\S]*grid-row:\s*3/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-arc--cards\.bj-full-table-card-area \.bj-arc__slot--card-column > \.bj-phone-view__box-value--card-column-below[\s\S]*grid-row:\s*3/,
    );
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-arc__slot--card-column,\s*\n\.bj-view-full-mobile \.bj-arc__slot--card-column[\s\S]*var\(--bj-full-table-card-stack-zone-height\)/,
    );
    expect(PANEL_SRC).toContain('FULL_TABLE_CARD_AREA_CLASS');
  });

  it('adds game-ended card-row spacing and hides dealer new game while game-over UI is active', () => {
    expect(PANEL_CSS).toMatch(/data-game-ended='true'[\s\S]*padding-top:\s*0\.95rem/);
    expect(PANEL_SRC).toContain('!showGameOverActions');
    expect(PANEL_SRC).toContain("data-game-over-ui={showGameOverActions ? 'true' : 'false'}");
  });

  it('passes tray label on desktop and mobile', () => {
    expect(PANEL_SRC).toContain('trayLabel={trayLabel}');
    expect(PANEL_SRC).not.toContain("trayLabel={deviceView === 'mobile' ? trayLabel : undefined}");
  });
});

describe('blackjack mobile typography polish', () => {
  it('scales mobile table text tokens by about 10% without touching card scale vars', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile\.bj-casino[\s\S]*--bj-seat-total-size:\s*0\.792rem/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-mobile\.bj-casino[\s\S]*--bj-mobile-box-card-scale:\s*1\.32/,
    );
  });
});
