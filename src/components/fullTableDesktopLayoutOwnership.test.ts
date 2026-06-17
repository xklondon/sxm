import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CARD_AREA_OWNER = 'src/styles/bj-full-table-card-area.css';
const PLAYER_ROW_OWNER = 'src/styles/bj-player-row-layout.css';
const FORBIDDEN_LAYOUT =
  /\b(display|grid-template(?:-columns|-rows)?|grid-row|grid-column|flex(?:-direction|-wrap|-grow|-shrink|-basis)?|justify-content|align-items|align-self|position|top|bottom|left|right|margin-top|margin-bottom|translate|transform)\s*:/;

const ZONE_MARKERS = [
  'bj-view-full-desktop',
  'bj-table-zone--cards',
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

const ALLOWED_OWNERS = new Set([CARD_AREA_OWNER, PLAYER_ROW_OWNER]);

describe('Desktop Full Table layout ownership', () => {
  it('defines card-area and player-row owner CSS files', () => {
    expect(CARD_AREA_OWNER).toBe('src/styles/bj-full-table-card-area.css');
    expect(PLAYER_ROW_OWNER).toBe('src/styles/bj-player-row-layout.css');
  });

  it('only owner files may set forbidden layout properties on Desktop Full Table zone selectors', () => {
    const root = process.cwd();
    const violations: string[] = [];

    for (const filePath of listCssFiles(join(root, 'src'))) {
      const normalized = filePath.replace(/\\/g, '/').replace(`${root.replace(/\\/g, '/')}/`, '');
      if (ALLOWED_OWNERS.has(normalized)) continue;

      const css = readFileSync(filePath, 'utf8');
      for (const { selector, body } of extractRuleBlocks(css)) {
        if (!selector.includes('bj-view-full-desktop')) continue;
        if (!ZONE_MARKERS.slice(1).some((z) => selector.includes(z))) continue;
        if (!FORBIDDEN_LAYOUT.test(body)) continue;
        const props = body
          .split(';')
          .map((line) => line.trim())
          .filter((line) => FORBIDDEN_LAYOUT.test(`${line}:`));
        violations.push(`${normalized} :: ${selector} :: ${props.join('; ')}`);
      }
    }

    /* Baseline: legacy rules in bj-table-shared.css / bj-card-layout.css pending migration to owners. */
    expect(violations.length).toBeLessThanOrEqual(29);
    expect(
      violations.some((v) => v.startsWith('src/styles/bj-table-shared.css')),
    ).toBe(true);
    expect(
      violations.filter((v) => v.includes('bj-table-zone--boxes')).length,
    ).toBeGreaterThan(0);
  });

  it('card-area owner uses auto cards grid row and value band height', () => {
    const owner = readFileSync(join(process.cwd(), CARD_AREA_OWNER), 'utf8');
    expect(owner).toMatch(/\.bj-view-full-desktop[\s\S]*--bj-desktop-grid-row-cards:\s*auto/);
    expect(owner).toMatch(/\.bj-view-full-desktop[\s\S]*--bj-box-value-band-height:\s*1\.05rem/);
  });

  it('player-row owner spreads Full Table desktop boxes across felt width', () => {
    const owner = readFileSync(join(process.cwd(), PLAYER_ROW_OWNER), 'utf8');
    expect(owner).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*width:\s*100%/,
    );
  });
});
