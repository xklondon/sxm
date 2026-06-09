import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const CLOTH_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackFeltClothLayer.tsx'), 'utf8');

function desktopShellBlock(): string {
  const start = SHARED_CSS.indexOf('/* Desktop table shell — fixed CSS grid rows');
  const end = SHARED_CSS.indexOf('/* Desktop stage:', start);
  return start >= 0 && end > start ? SHARED_CSS.slice(start, end) : '';
}

describe('blackjack actions + cloth tuning', () => {
  it('reduces desktop actions row and primary button heights', () => {
    expect(SHARED_CSS).toContain('--bj-desktop-zone-actions-height: 2.9rem');
    expect(SHARED_CSS).toContain('--bj-actions-primary-btn-min-height: 1.65rem');
    expect(SHARED_CSS).toContain('--bj-actions-primary-btn-max-height: 1.65rem');
    expect(SHARED_CSS).toContain('--bj-actions-panel-compact-max-height: 2.85rem');
    expect(SHARED_CSS).not.toContain('--bj-desktop-zone-actions-height: 5.5rem');
    expect(SHARED_CSS).not.toContain('--bj-actions-primary-btn-min-height: 2.35rem');
  });

  it('keeps action panel between command and cards with top-aligned compact chrome', () => {
    const desktop = desktopShellBlock();
    expect(desktop).toMatch(/\[actions\][\s\S]*\[command\][\s\S]*\[cards\]/);
    expect(desktop).toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*align-items:\s*flex-start/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions[\s\S]*align-items:\s*flex-start/,
    );
    expect(SHARED_CSS).toContain('--bj-actions-panel-max-width: 20rem');
  });

  it('hides Card View protocol subtext inside the cloth band', () => {
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-felt-cloth-layer__insurance[\s\S]*visibility:\s*hidden/,
    );
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-felt-cloth-layer__dealer-rule[\s\S]*visibility:\s*hidden/,
    );
  });

  it('uses balanced cloth typography tokens and lowered arc paths inside CardsArea', () => {
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size: 104px');
    expect(FELT_CSS).toContain('--bj-cloth-insurance-font-size: 52px');
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size-mobile: 88px');
    expect(FELT_CSS).toContain('--bj-cloth-insurance-font-size-mobile: 44px');
    expect(CLOTH_SRC).toContain('viewBox="0 0 1000 260"');
    expect(CLOTH_SRC).toContain('M 80 42 Q 500 8 920 42');
    expect(CLOTH_SRC).toContain('M 110 108 Q 500 78 890 108');
    expect(CLOTH_SRC).toContain('M 90 182 Q 500 152 910 182');
    expect(FELT_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--cards > \.bj-felt-cloth-layer/);
  });
});
