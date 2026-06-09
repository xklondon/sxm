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
    expect(desktop).toMatch(/\[command\][\s\S]*\[actions\][\s\S]*\[cards\]/);
    expect(desktop).toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*align-items:\s*flex-start/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions[\s\S]*align-items:\s*flex-start/,
    );
    expect(SHARED_CSS).toContain('--bj-actions-panel-max-width: 20rem');
  });

  it('hides the entire cloth layer in Card View', () => {
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
  });

  it('uses balanced cloth typography tokens and centered arc paths inside CardsArea', () => {
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size: 56px');
    expect(FELT_CSS).toContain('--bj-cloth-insurance-font-size: 28px');
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size-mobile: 48px');
    expect(FELT_CSS).toContain('--bj-cloth-insurance-font-size-mobile: 24px');
    expect(CLOTH_SRC).toContain('viewBox="0 0 1000 280"');
    expect(CLOTH_SRC).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(CLOTH_SRC).toContain('M 90 78 Q 500 58 910 78');
    expect(FELT_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--cards > \.bj-felt-cloth-layer/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer__svg[\s\S]*width:\s*var\(--bj-cloth-svg-width\)/);
  });
});
