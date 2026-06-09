import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const SHELL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');

function gapRem(css: string, token: string): number {
  const match = css.match(new RegExp(`${token}:\\s*([\\d.]+)rem`));
  return match ? Number(match[1]) : NaN;
}

describe('Card View layout guards', () => {
  it('hides the entire cloth layer in Card View only', () => {
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
    expect(FELT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
    expect(FELT_CSS).not.toMatch(
      /\.bj-view-full-desktop \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
    expect(FELT_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
  });

  it('keeps command → actions gap at or below 0.25rem in Card View', () => {
    expect(LAYOUT_CSS).toContain('--bj-cardview-command-actions-gap: 0.25rem');
    expect(gapRem(LAYOUT_CSS, '--bj-cardview-command-actions-gap')).toBeLessThanOrEqual(0.25);
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile[\s\S]*--bj-command-actions-gap:\s*var\(--bj-cardview-command-actions-gap\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-desktop[\s\S]*--bj-command-actions-gap:\s*var\(--bj-cardview-command-actions-gap\)/,
    );
  });

  it('uses a small explicit actions → hero gap in Card View', () => {
    expect(LAYOUT_CSS).toContain('--bj-cardview-actions-cards-gap: 0.35rem');
    expect(gapRem(LAYOUT_CSS, '--bj-cardview-actions-cards-gap')).toBeLessThanOrEqual(0.5);
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*margin-top:\s*var\(--bj-cardview-actions-cards-gap\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*margin-top:\s*var\(--bj-cardview-actions-cards-gap\)/,
    );
  });

  it('forbids negative margin-top and translateY on Card View hero fan/wrap', () => {
    const heroGuard = LAYOUT_CSS.slice(
      LAYOUT_CSS.indexOf('Card View layout guards'),
      LAYOUT_CSS.indexOf('/* Deprecated grid wrapper'),
    );
    expect(heroGuard).toMatch(/margin-top:\s*0/);
    expect(heroGuard).toMatch(/transform:\s*none/);
    expect(LAYOUT_CSS).not.toMatch(
      /\.bj-view-card-(?:desktop|mobile)[\s\S]*margin-top:\s*-/,
    );
    expect(LAYOUT_CSS).not.toMatch(
      /\.bj-view-card-(?:desktop|mobile)[\s\S]*translateY/i,
    );
  });

  it('top-aligns hero cards with top inset reserve in Card View', () => {
    expect(LAYOUT_CSS).toContain('--bj-cardview-hero-top-inset');
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*padding-top:\s*var\(--bj-cardview-hero-top-inset\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*padding-top:\s*var\(--bj-cardview-hero-top-inset\)/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards--fan[\s\S]*justify-content:\s*center/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__cards-slot[\s\S]*justify-content:\s*center/,
    );
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero \.bj-phone-view__card-wrap[\s\S]*align-self:\s*flex-start/,
    );
  });

  it('keeps actions zone directly after command in DOM order', () => {
    const render = SHELL_SRC.match(/return \(\s*[\s\S]*?\n  \);/)?.[0] ?? '';
    const commandIdx = render.indexOf('BlackjackCommandZone');
    const actionsIdx = render.indexOf('BlackjackActionsZone');
    const cardsIdx = render.indexOf('BlackjackCardsAreaZone');
    expect(commandIdx).toBeLessThan(actionsIdx);
    expect(actionsIdx).toBeLessThan(cardsIdx);
  });

  it('does not change Full Table command/actions row height tokens globally', () => {
    expect(SHARED_CSS).toContain('--bj-desktop-zone-command-height: 4rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-actions-height: 2.9rem');
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-desktop\s*\{[\s\S]*--bj-desktop-zone-command-height:\s*2\.55rem/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-card-desktop\s*\{[\s\S]*--bj-desktop-zone-actions-height:\s*2\.45rem/,
    );
  });
});
