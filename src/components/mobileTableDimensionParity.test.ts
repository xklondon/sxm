import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MOBILE_LAYOUT_MEDIA } from '../styles/mobileLayoutContract';

const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
const MAGIC8_CSS = readFileSync(join(process.cwd(), 'src/components/magic8/Magic8Ball.css'), 'utf8');

const MOBILE_DIM_TOKENS = [
  '--bj-mobile-table-width: 100%',
  '--bj-mobile-rail-width: 100%',
  '--bj-mobile-felt-width: 100%',
  '--bj-mobile-layout-shell-width: 100%',
  '--bj-mobile-table-height: var(--bj-mobile-table-canvas-height)',
  '--bj-mobile-felt-height: 100%',
  '--bj-mobile-layout-shell-height: 100%',
] as const;

const PAIRED_WIDTH_SELECTORS = [
  /\.bj-view-full-mobile \.bj-mobile-table-shell,\s*\n\s*\.bj-view-card-mobile \.bj-mobile-table-shell[\s\S]*width:\s*var\(--bj-mobile-table-width\)/,
  /\.bj-view-full-mobile \.bj-casino__rail,\s*\n\s*\.bj-view-card-mobile \.bj-casino__rail[\s\S]*width:\s*var\(--bj-mobile-rail-width\)/,
  /\.bj-view-full-mobile \.bj-casino__felt,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt[\s\S]*width:\s*var\(--bj-mobile-felt-width\)/,
  /\.bj-view-full-mobile \.bj-casino__felt-main,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt-main[\s\S]*width:\s*var\(--bj-mobile-layout-shell-width\)/,
  /\.bj-view-full-mobile \.bj-table-layout-shell,\s*\n\s*\.bj-view-card-mobile \.bj-table-layout-shell[\s\S]*width:\s*var\(--bj-mobile-layout-shell-width\)/,
] as const;

const PAIRED_HEIGHT_SELECTORS = [
  /\.bj-view-full-mobile \.bj-mobile-table-shell,\s*\n\s*\.bj-view-card-mobile \.bj-mobile-table-shell[\s\S]*height:\s*var\(--bj-mobile-table-height\)/,
  /\.bj-view-full-mobile \.bj-casino__felt,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt[\s\S]*height:\s*var\(--bj-mobile-felt-height\)/,
  /\.bj-view-full-mobile \.bj-casino__felt-main,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt-main[\s\S]*height:\s*var\(--bj-mobile-layout-shell-height\)/,
] as const;

function assertNoViewOnlyDimensionRules(css: string, shellPattern: RegExp): void {
  for (const view of ['bj-view-card-mobile', 'bj-view-full-mobile'] as const) {
    const other = view === 'bj-view-card-mobile' ? 'bj-view-full-mobile' : 'bj-view-card-mobile';
    const ruleRe = /([^{]+)\{([^}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = ruleRe.exec(css)) !== null) {
      const selector = match[1]!.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();
      const body = match[2]!;
      if (!shellPattern.test(selector)) continue;
      if (!/\b(?:width|max-width|min-width|height|min-height|max-height)\s*:/.test(body)) continue;
      if (selector.includes(`.${view}`) && !selector.includes(`.${other}`)) {
        throw new Error(`View-only shell dimension rule: ${selector}`);
      }
    }
  }
}

describe('mobile table dimension parity — Full Table vs Card View', () => {
  it('defines one mobile table dimension token contract', () => {
    expect(SHARED_CSS).toContain(MOBILE_LAYOUT_MEDIA);
    for (const token of MOBILE_DIM_TOKENS) {
      expect(SHARED_CSS).toContain(token);
    }
  });

  it('applies the same width tokens to both mobile views', () => {
    for (const pattern of PAIRED_WIDTH_SELECTORS) {
      expect(SHARED_CSS).toMatch(pattern);
    }
  });

  it('applies the same height tokens to both mobile views', () => {
    for (const pattern of PAIRED_HEIGHT_SELECTORS) {
      expect(SHARED_CSS).toMatch(pattern);
    }
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt[\s\S]*height:\s*auto[\s\S]*\.bj-view-card-mobile \.bj-casino__felt/,
    );
  });

  it('does not keep view-only shell dimension overrides', () => {
    const shellPattern =
      /bj-mobile-table-shell|bj-casino__rail-wrap|bj-casino__rail\b|bj-casino__felt-main|bj-casino__felt\b|bj-table-layout-shell/;
    expect(() => assertNoViewOnlyDimensionRules(`${SHARED_CSS}\n${PANEL_CSS}`, shellPattern)).not.toThrow();
  });

  it('keeps CardsArea internals from changing outer shell dimensions', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--cards,\s*\n\s*\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--cards[\s\S]*min-height:\s*0[\s\S]*overflow:\s*hidden/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-view-full-mobile \.bj-arc-separator[\s\S]*min-height:\s*0/);
    expect(PANEL_CSS).not.toMatch(/\.bj-view-full-mobile \.bj-arc-separator[\s\S]*min-height:\s*min\(/);
  });

  it('centers dealer cards and command on the table axis', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.dealer-block__grid[\s\S]*display:\s*flex[\s\S]*align-items:\s*center/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.dealer-block__commentary-col[\s\S]*position:\s*absolute/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.dealer-block__center-col[\s\S]*margin-inline:\s*auto/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.dealer-block__cards-slot[\s\S]*justify-content:\s*center/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--summary \.bj-card-layout__command,\s*\n\s*\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--summary \.bj-card-layout__command[\s\S]*margin-inline:\s*auto/,
    );
  });

  it('keeps Magic 8 oracle out of dealer/command layout flow', () => {
    expect(MAGIC8_CSS).toMatch(/\.magic8-table-zone[\s\S]*position:\s*absolute/);
    expect(MAGIC8_CSS).toMatch(/\.magic8-table-zone[\s\S]*pointer-events:\s*none/);
    expect(PANEL_CSS).toMatch(/\.bj-casino__felt > \.magic8-table-zone[\s\S]*position:\s*absolute/);
    expect(PANEL_CSS).toMatch(/\.bj-casino__felt > \.magic8-table-zone[\s\S]*pointer-events:\s*none/);
  });
});
