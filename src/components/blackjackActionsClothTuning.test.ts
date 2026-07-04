import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const CLOTH_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackFeltClothLayer.tsx'), 'utf8');

function desktopShellBlock(): string {
  return SHELL_CSS;
}

describe('blackjack actions + cloth tuning', () => {
  it('reduces desktop actions row and primary button heights', () => {
    expect(SHELL_CSS).toContain('--bj-desktop-zone-actions-height: 2.5rem');
    expect(SHARED_CSS).toContain('--bj-actions-primary-btn-min-height: 1.65rem');
    expect(SHARED_CSS).toContain('--bj-actions-primary-btn-max-height: 1.65rem');
    expect(SHARED_CSS).toContain('--bj-actions-panel-compact-max-height: 2.85rem');
    expect(SHARED_CSS).not.toContain('--bj-desktop-zone-actions-height: 5.5rem');
    expect(SHARED_CSS).not.toContain('--bj-actions-primary-btn-min-height: 2.35rem');
  });

  it('keeps action panel between cards and boxes with top-aligned compact chrome', () => {
    const desktop = desktopShellBlock();
    expect(desktop).toMatch(/\[command\][\s\S]*\[cards\][\s\S]*\[actions\]/);
    expect(desktop).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*justify-content:\s*flex-start/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--actions[\s\S]*align-items:\s*flex-start/,
    );
    expect(SHARED_CSS).toContain('--bj-actions-panel-max-width: 20rem');
  });

  it('shows table cloth in Card View desktop (behind hero cards)', () => {
    const CARD_DESKTOP_CSS = readFileSync(
      join(process.cwd(), 'src/styles/bj-card-desktop-layout.css'),
      'utf8',
    );
    expect(FELT_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*flex:\s*0 0 auto/,
    );
  });

  it('uses balanced cloth typography tokens and centered arc paths inside CardsArea', () => {
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size: 56px');
    expect(FELT_CSS).toContain('--bj-cloth-insurance-font-size: 35px');
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size-mobile: 48px');
    expect(FELT_CSS).toContain('--bj-cloth-insurance-font-size-mobile: 30px');
    expect(CLOTH_SRC).toContain('viewBox="0 0 1000 280"');
    expect(CLOTH_SRC).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(CLOTH_SRC).toContain('M 72 88 Q 500 46 928 88');
    expect(FELT_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--cards > \.bj-felt-cloth-layer/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer__svg[\s\S]*width:\s*var\(--bj-cloth-svg-width\)/);
  });
});
