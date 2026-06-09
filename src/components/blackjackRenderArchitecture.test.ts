import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const SHELL_SRC = readFileSync(
  join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'),
  'utf8',
);
const CLOTH_SRC = readFileSync(
  join(process.cwd(), 'src/components/BlackjackFeltClothLayer.tsx'),
  'utf8',
);
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('blackjack render architecture — single canonical shell', () => {
  it('renders BlackjackFeltClothLayer exactly once via shell feltClothLayer prop', () => {
    expect(countOccurrences(PANEL_SRC, '<BlackjackFeltClothLayer')).toBe(1);
    expect(PANEL_SRC).toMatch(/feltClothLayer=\{[\s\S]*<BlackjackFeltClothLayer/);
    expect(SHELL_SRC).toMatch(/\{feltClothLayer\}/);
    expect(countOccurrences(CLOTH_SRC, 'export function BlackjackFeltClothLayer')).toBe(1);
  });

  it('uses BlackjackTableLayoutShell as the sole zone owner', () => {
    expect(countOccurrences(PANEL_SRC, '<BlackjackTableLayoutShell')).toBe(1);
    expect(SHELL_SRC).toContain('BlackjackCommandZone');
    expect(SHELL_SRC).toContain('BlackjackActionsZone');
    expect(SHELL_SRC).toContain('BlackjackCardsAreaZone');
    expect(SHELL_SRC).toContain('BlackjackPlayerBoxesZone');
  });

  it('routes command through BlackjackCommandBox with dealer omitCommand', () => {
    expect(PANEL_SRC).toContain('omitCommand');
    expect(PANEL_SRC).toContain('<BlackjackCommandBox');
    expect(countOccurrences(PANEL_SRC, '<BlackjackCommandBox')).toBe(1);
    expect(countOccurrences(PANEL_SRC, 'chipTray={renderTrayInner()}')).toBe(1);
    expect(PANEL_SRC).toContain('actions={renderActionsContent()}');
  });

  it('does not mount legacy bj-card-layout wrapper or centered bj-casino__tray', () => {
    expect(PANEL_SRC).not.toMatch(/className=[^>]*\bbj-card-layout\b/);
    expect(PANEL_SRC).not.toMatch(/['"]bj-casino__tray['"]/);
    expect(PANEL_CSS).not.toMatch(/\.bj-casino__tray\s*\{/);
    expect(PANEL_CSS).not.toMatch(/\.bj-casino__felt--card-view > \.bj-card-layout/);
    expect(SHARED_CSS).not.toMatch(/\.bj-view-card-desktop \.bj-phone-view\.bj-card-layout/);
  });

  it('differs Full Table and Card View only in cardsArea branch', () => {
    const cardsAreaMatch = PANEL_SRC.match(/cardsArea=\{([\s\S]*?)\}\s*\n\s*cardsAreaMode=/);
    expect(cardsAreaMatch?.[1]).toBeTruthy();
    const branch = cardsAreaMatch![1];
    expect(branch).toMatch(/viewMode === 'full'/);
    expect(branch).toMatch(/<BlackjackCardView/);
    expect(branch).toMatch(/bj-arc--cards/);
    expect(PANEL_SRC).toMatch(/cardsAreaMode=\{viewMode === 'full' \? 'table' : 'hero'\}/);
  });
});

describe('blackjack cloth sizing — dominant tokens and desktop fill', () => {
  it('defines readable title and insurance font tokens', () => {
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size: 56px');
    expect(FELT_CSS).toContain('--bj-cloth-insurance-font-size: 28px');
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer__title[\s\S]*var\(--bj-cloth-title-font-size\)/);
    expect(FELT_CSS).toMatch(
      /\.bj-felt-cloth-layer__insurance[\s\S]*var\(--bj-cloth-insurance-font-size\)/,
    );
  });

  it('centers cloth SVG in CardsArea without legacy shell calc band', () => {
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*align-items:\s*center/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer__svg[\s\S]*width:\s*var\(--bj-cloth-svg-width\)/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer__svg[\s\S]*max-height:\s*var\(--bj-cloth-svg-max-height\)/);
    expect(FELT_CSS).not.toMatch(/top:\s*calc\(/);
  });

  it('keeps cloth inside CardsArea behind card stacks', () => {
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*z-index:\s*0/);
    expect(FELT_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards > :not\(\.bj-felt-cloth-layer\)[\s\S]*z-index:\s*1/,
    );
    expect(SHARED_CSS).not.toMatch(/\.bj-table-layout-shell > \.bj-felt-cloth-layer[\s\S]*grid-row:\s*cards/);
    const renderBlock = SHELL_SRC.match(/return \(\s*[\s\S]*?\n  \);/)?.[0] ?? '';
    expect(renderBlock).toMatch(
      /<BlackjackCardsAreaZone[\s\S]*\{feltClothLayer\}[\s\S]*\{cardsArea\}/,
    );
  });
});
