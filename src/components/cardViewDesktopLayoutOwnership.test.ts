import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SHELL_OWNER = 'src/styles/bj-blackjack-table-shell.css';
const CARDS_OWNER = 'src/styles/bj-card-desktop-layout.css';

const SHELL_GRID_RE =
  /\b(grid-template-rows|grid-row|grid-column|grid-template-columns)\s*:/;

const SHELL_MARKERS = [
  'bj-view-full-desktop',
  'bj-view-card-desktop',
  'bj-table-layout-shell',
] as const;

const CARDS_MARKERS = ['bj-view-card-desktop', 'bj-table-zone--cards'] as const;

function listCssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      out.push(...listCssFiles(full));
    } else if (entry.endsWith('.css')) {
      out.push(full.replace(/\\/g, '/'));
    }
  }
  return out;
}

function extractRuleBlocks(
  css: string,
  markers: readonly string[],
): Array<{ selector: string; body: string }> {
  const blocks: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    const selector = match[1]!.trim().replace(/\s+/g, ' ');
    const body = match[2]!;
    if (markers.some((m) => selector.includes(m))) {
      blocks.push({ selector, body });
    }
  }
  return blocks;
}

function isShellGridPlacementSelector(selector: string): boolean {
  if (!selector.includes('bj-table-layout-shell')) return false;
  if (!selector.includes('bj-view-full-desktop') && !selector.includes('bj-view-card-desktop')) {
    return false;
  }
  return (
    selector.includes('.bj-table-layout-shell >') ||
    /\.bj-table-layout-shell\s*,/.test(selector) ||
    /\.bj-table-layout-shell\s*\{/.test(selector)
  );
}

describe('Desktop Card View layout ownership', () => {
  it('defines shared shell and cards-area owner CSS files', () => {
    expect(SHELL_OWNER).toBe('src/styles/bj-blackjack-table-shell.css');
    expect(CARDS_OWNER).toBe('src/styles/bj-card-desktop-layout.css');
  });

  it('only the shell owner may set desktop shell grid placement', () => {
    const root = process.cwd();
    const violations: string[] = [];

    for (const filePath of listCssFiles(join(root, 'src'))) {
      const normalized = filePath.replace(/\\/g, '/').replace(`${root.replace(/\\/g, '/')}/`, '');
      if (normalized === SHELL_OWNER) continue;

      const css = readFileSync(filePath, 'utf8');
      for (const { selector, body } of extractRuleBlocks(css, SHELL_MARKERS)) {
        if (!isShellGridPlacementSelector(selector)) continue;
        if (!SHELL_GRID_RE.test(body)) continue;
        const props = body
          .split(';')
          .map((line) => line.trim())
          .filter((line) => SHELL_GRID_RE.test(`${line}:`));
        violations.push(`${normalized} :: ${selector} :: ${props.join('; ')}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('shell owner defines bank-info through tray grid rows for both desktop views', () => {
    const shell = readFileSync(join(process.cwd(), SHELL_OWNER), 'utf8');
    expect(shell).toMatch(/\[bank-info\][\s\S]*\[tray\]/);
    expect(shell).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-info-bar--felt-row[\s\S]*grid-row:\s*bank-info/,
    );
    expect(shell).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*grid-row:\s*cards/,
    );
    expect(shell).not.toMatch(/bj-table-zone--hero-value/);
  });
});
