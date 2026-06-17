import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OWNER = 'src/styles/bj-card-desktop-layout.css';
const FORBIDDEN_LAYOUT =
  /\b(display|grid-template(?:-columns|-rows)?|grid-row|grid-column|flex(?:-direction|-wrap|-grow|-shrink|-basis)?|justify-content|align-items|align-self|position|top|bottom|left|right|margin-top|margin-bottom|translate|transform)\s*:/;

const ZONE_MARKERS = [
  'bj-view-card-desktop',
  'bj-table-zone--cards',
  'bj-table-zone--hero-value',
  'bj-table-zone--actions',
  'bj-table-zone--boxes',
] as const;

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

function extractRuleBlocks(css: string): Array<{ selector: string; body: string }> {
  const blocks: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    const selector = match[1]!.trim().replace(/\s+/g, ' ');
    const body = match[2]!;
    if (ZONE_MARKERS.some((m) => selector.includes(m))) {
      blocks.push({ selector, body });
    }
  }
  return blocks;
}

describe('Desktop Card View layout ownership', () => {
  it('defines a single layout owner CSS file', () => {
    expect(OWNER).toBe('src/styles/bj-card-desktop-layout.css');
  });

  it('only the owner file may set forbidden layout properties on Desktop Card View selectors', () => {
    const root = process.cwd();
    const violations: string[] = [];

    for (const filePath of listCssFiles(join(root, 'src'))) {
      const normalized = filePath.replace(/\\/g, '/').replace(`${root.replace(/\\/g, '/')}/`, '');
      if (normalized === OWNER) continue;

      const css = readFileSync(filePath, 'utf8');
      for (const { selector, body } of extractRuleBlocks(css)) {
        if (!selector.includes('bj-view-card-desktop')) continue;
        if (!FORBIDDEN_LAYOUT.test(body)) continue;
        const props = body
          .split(';')
          .map((line) => line.trim())
          .filter((line) => FORBIDDEN_LAYOUT.test(`${line}:`));
        violations.push(`${normalized} :: ${selector} :: ${props.join('; ')}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('owner defines 7-band grid rows for shell zones', () => {
    const owner = readFileSync(join(process.cwd(), OWNER), 'utf8');
    expect(owner).toMatch(/\[dealer\][\s\S]*\[tray\]/);
    expect(owner).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--hero[\s\S]*grid-row:\s*cards/,
    );
    expect(owner).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--hero-value[\s\S]*grid-row:\s*hero-value/,
    );
    expect(owner).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*grid-row:\s*actions/,
    );
    expect(owner).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*grid-row:\s*boxes/,
    );
  });
});
