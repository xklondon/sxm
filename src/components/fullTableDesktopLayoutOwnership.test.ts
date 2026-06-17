import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CARD_AREA_OWNER = 'src/styles/bj-full-table-card-area.css';
const PLAYER_ROW_OWNER = 'src/styles/bj-player-row-layout.css';
const SHELL_OWNER = 'src/styles/bj-blackjack-table-shell.css';
/** Optional Double/Split overlay anchor — absolute positioning inside cards zone */
const OPTIONAL_PLAY_OVERLAY_CSS = 'src/components/OptionalPlayDecisionOverlay.css';

const FORBIDDEN_LAYOUT =
  /\b(display|grid-template(?:-columns|-rows)?|grid-row|grid-column|flex(?:-direction|-wrap|-grow|-shrink|-basis)?|justify-content|align-items|align-self|position|top|bottom|left|right|margin-top|margin-bottom|translate|transform)\s*:/;

function targetsFullTablePlayZones(selector: string): boolean {
  if (!selector.includes('bj-view-full-desktop')) return false;
  if (selector.includes('bj-cards-area--hero')) return false;
  return (
    selector.includes('bj-table-zone--cards.bj-cards-area--table') ||
    selector.includes('bj-table-zone--actions') ||
    selector.includes('bj-table-zone--boxes')
  );
}

function isAllowedLayoutSource(file: string, selector: string): boolean {
  if (file === SHELL_OWNER && targetsFullTablePlayZones(selector)) return true;
  if (file === CARD_AREA_OWNER && targetsFullTablePlayZones(selector)) return true;
  if (file === PLAYER_ROW_OWNER && targetsFullTablePlayZones(selector)) return true;
  if (
    file === OPTIONAL_PLAY_OVERLAY_CSS &&
    targetsFullTablePlayZones(selector) &&
    selector.includes('bj-optional-play-overlay-anchor')
  ) {
    return true;
  }
  return false;
}

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
    if (targetsFullTablePlayZones(selector)) {
      blocks.push({ selector, body });
    }
  }
  return blocks;
}

describe('Desktop Full Table layout ownership', () => {
  it('defines card-area and player-row owner CSS files', () => {
    expect(CARD_AREA_OWNER).toBe('src/styles/bj-full-table-card-area.css');
    expect(PLAYER_ROW_OWNER).toBe('src/styles/bj-player-row-layout.css');
  });

  it('only owner files may set forbidden layout on Full Table play zones', () => {
    const root = process.cwd();
    const violations: string[] = [];

    for (const filePath of listCssFiles(join(root, 'src'))) {
      const normalized = filePath.replace(/\\/g, '/').replace(`${root.replace(/\\/g, '/')}/`, '');

      const css = readFileSync(filePath, 'utf8');
      for (const { selector, body } of extractRuleBlocks(css)) {
        if (!FORBIDDEN_LAYOUT.test(body)) continue;
        if (isAllowedLayoutSource(normalized, selector)) continue;
        const props = body
          .split(';')
          .map((line) => line.trim())
          .filter((line) => FORBIDDEN_LAYOUT.test(`${line}:`));
        violations.push(`${normalized} :: ${selector} :: ${props.join('; ')}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('shell owner uses auto cards grid row for Full Table desktop', () => {
    const shell = readFileSync(join(process.cwd(), SHELL_OWNER), 'utf8');
    expect(shell).toMatch(/\.bj-view-full-desktop[\s\S]*--bj-desktop-grid-row-cards:\s*auto/);
  });

  it('card-area owner uses 1fr card column grid', () => {
    const owner = readFileSync(join(process.cwd(), CARD_AREA_OWNER), 'utf8');
    expect(owner).toMatch(
      /\.bj-view-full-desktop[\s\S]*\.bj-table-slot-row\.bj-arc--cards[\s\S]*grid-template-columns:\s*repeat\(var\(--slot-count,\s*4\),\s*minmax\(0,\s*1fr\)\)/,
    );
  });

  it('player-row owner spreads Full Table desktop boxes across felt width', () => {
    const owner = readFileSync(join(process.cwd(), PLAYER_ROW_OWNER), 'utf8');
    expect(owner).toMatch(
      /\.bj-view-full-desktop \.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*width:\s*100%/,
    );
  });
});
