import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHELL_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-blackjack-table-shell.css'), 'utf8');
const HERO_AREA_CSS = readFileSync(
  join(process.cwd(), 'src/styles/bj-card-desktop-hero-area.css'),
  'utf8',
);
const CARD_DESKTOP_CSS = readFileSync(
  join(process.cwd(), 'src/styles/bj-card-desktop-layout.css'),
  'utf8',
);
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const FULL_TABLE_CARD_CSS = readFileSync(
  join(process.cwd(), 'src/styles/bj-full-table-card-area.css'),
  'utf8',
);
const LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const SHELL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');

function gapRem(css: string, token: string): number {
  const match = css.match(new RegExp(`${token}:\\s*([\\d.]+)rem`));
  return match ? Number(match[1]) : NaN;
}

function ruleBody(css: string, selectorNeedle: string): string {
  const re = new RegExp(
    `(${selectorNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^,{]*)\\{([^}]*)\\}`,
  );
  return re.exec(css)?.[2] ?? '';
}

describe('Card View layout guards', () => {
  it('shows table cloth in Card View desktop (behind hero cards)', () => {
    const clothRule = ruleBody(
      FULL_TABLE_CARD_CSS,
      '.bj-view-card-desktop .bj-table-layout-shell .bj-table-zone--cards .bj-felt-cloth-layer__svg',
    );
    expect(clothRule).toMatch(/width:\s*var\(--bj-cloth-svg-width\)/);
    expect(FULL_TABLE_CARD_CSS).toMatch(/data-bj-phase='betting'/);
    expect(FELT_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
  });

  it('keeps command → cards gap at or below 0.25rem in Card View (mobile token)', () => {
    expect(LAYOUT_CSS).toContain('--bj-cardview-command-cards-gap: 0.25rem');
    expect(gapRem(LAYOUT_CSS, '--bj-cardview-command-cards-gap')).toBeLessThanOrEqual(0.25);
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile[\s\S]*--bj-command-cards-gap:\s*var\(--bj-cardview-command-cards-gap\)/,
    );
    /* Desktop Card View uses fixed grid bands — no inter-band margin gap token. */
    expect(SHELL_CSS).toMatch(/--bj-command-cards-gap:\s*0/);
  });

  it('uses explicit zone heights in desktop shared shell (unified phases, no cards→actions margin gap)', () => {
    expect(LAYOUT_CSS).toContain('--bj-cardview-cards-actions-gap: 0.35rem');
    expect(gapRem(LAYOUT_CSS, '--bj-cardview-cards-actions-gap')).toBeLessThanOrEqual(0.5);
    expect(SHELL_CSS).toMatch(/--bj-desktop-zone-actions-height:\s*2\.5rem/);
    expect(SHELL_CSS).not.toMatch(
      /\[data-bj-phase='betting'\][\s\S]*--bj-desktop-zone-actions-height/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*grid-row:\s*actions/,
    );
    expect(SHELL_CSS).not.toMatch(/bj-table-zone--hero-value/);
    expect(SHELL_CSS.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/:has\(/);
    expect(HERO_AREA_CSS.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/:has\(/);
    expect(HERO_AREA_CSS).not.toMatch(/\[data-bj-phase=/);
  });

  it('forbids negative margin-top and translateY on Card View hero fan/wrap', () => {
    const heroGuard = LAYOUT_CSS.slice(
      LAYOUT_CSS.indexOf('Card View layout guards'),
      LAYOUT_CSS.indexOf('/* Deprecated grid wrapper'),
    );
    expect(heroGuard).toMatch(/margin-top:\s*0/);
    expect(heroGuard).not.toMatch(/translateY/i);
    expect(LAYOUT_CSS).not.toMatch(
      /\.bj-view-card-(?:desktop|mobile)[\s\S]*margin-top:\s*-/,
    );
    expect(LAYOUT_CSS).not.toMatch(
      /\.bj-view-card-(?:desktop|mobile)[\s\S]*translateY/i,
    );
  });

  it('centers hero cards in desktop Card View owner grid band', () => {
    expect(LAYOUT_CSS).toContain('--bj-cardview-hero-top-inset');
    expect(LAYOUT_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*padding-top:\s*var\(--bj-cardview-hero-top-inset\)/,
    );
    expect(HERO_AREA_CSS).toMatch(
      /\.bj-card-desktop-hero__fan[\s\S]{0,200}justify-content:\s*center/,
    );
    expect(HERO_AREA_CSS).toMatch(
      /\.bj-card-desktop-hero__card-wrap[\s\S]{0,120}align-items:\s*center/,
    );
  });

  it('keeps cards zone directly after command in DOM order', () => {
    const render = SHELL_SRC.match(/return \(\s*[\s\S]*?\n  \);/)?.[0] ?? '';
    const commandIdx = render.indexOf('BlackjackCommandZone');
    const cardsIdx = render.indexOf('BlackjackCardsAreaZone');
    const actionsIdx = render.indexOf('BlackjackActionsZone');
    expect(commandIdx).toBeLessThan(cardsIdx);
    expect(cardsIdx).toBeLessThan(actionsIdx);
  });

  it('uses Card View desktop zone height overrides in shared shell only', () => {
    expect(SHARED_CSS).toContain('--bj-desktop-zone-command-height: 4rem');
    expect(SHARED_CSS).toContain('--bj-desktop-zone-actions-height: 2.9rem');
    expect(SHELL_CSS).toMatch(/--bj-desktop-zone-actions-height:\s*2\.5rem/);
    expect(SHELL_CSS).toMatch(/--bj-desktop-dealer-command-gap:\s*0\.4125rem/);
    expect(SHELL_CSS).not.toMatch(
      /\[data-bj-phase='betting'\][\s\S]*--bj-desktop-zone-actions-height:\s*1\.55rem/,
    );
    expect(SHELL_CSS).not.toMatch(
      /\[data-bj-phase='betting'\][\s\S]*--bj-desktop-dealer-command-gap:\s*3\.875rem/,
    );
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-card-desktop\s*\{[\s\S]*--bj-desktop-zone-actions-height:\s*2\.45rem/,
    );
  });
});
