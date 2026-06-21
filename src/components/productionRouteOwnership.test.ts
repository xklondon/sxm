import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  BLACKJACK_TABLE_LAYOUT_SHELL_NAME,
  CANONICAL_BLACKJACK_CSS_IMPORT_ORDER,
} from './blackjackLayoutContract';

const ROOT = process.cwd();
const PANEL_SRC = readFileSync(join(ROOT, 'src/components/BlackjackPanel.tsx'), 'utf8');
const TABLE_SCREEN_SRC = readFileSync(join(ROOT, 'src/screens/TableScreen.tsx'), 'utf8');
const APP_SRC = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');
const SHELL_SRC = readFileSync(join(ROOT, 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');
const INDEX_CSS = readFileSync(join(ROOT, 'src/index.css'), 'utf8');
const SHELL_CSS = readFileSync(join(ROOT, 'src/styles/bj-blackjack-table-shell.css'), 'utf8');
const SHARED_CSS = readFileSync(join(ROOT, 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_AREA_CSS = readFileSync(join(ROOT, 'src/styles/bj-full-table-card-area.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(ROOT, 'src/styles/bj-card-layout.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(ROOT, 'src/components/BlackjackCardView.css'), 'utf8');
const STITCH_CSS = readFileSync(join(ROOT, 'src/styles/sxm-stitch-visual.css'), 'utf8');

const PRODUCTION_FORBIDDEN_IMPORT_PATTERNS = [
  /reference-ui/,
  /stitch-export/,
  /BlackjackTableLayoutShellFrozen/,
  /BlackjackFrozenLayout/,
  /frozenLayout/,
  /\/sanity\/fixtures/,
] as const;

function isTestOrFixtureFile(relativePath: string): boolean {
  return (
    relativePath.includes('.test.') ||
    relativePath.includes('.spec.') ||
    relativePath.startsWith('src/test/') ||
    relativePath.startsWith('src/engine/blackjack/sanity/')
  );
}

function listProductionSourceFiles(): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        walk(full);
        continue;
      }
      if (!/\.(tsx?|jsx?)$/.test(entry)) continue;
      const rel = full.replace(/\\/g, '/').replace(`${ROOT.replace(/\\/g, '/')}/`, '');
      if (isTestOrFixtureFile(rel)) continue;
      out.push(rel);
    }
  }
  walk(join(ROOT, 'src'));
  return out;
}

function parseIndexCssImports(): string[] {
  const imports = INDEX_CSS.match(/@import '\.\/styles\/[^']+'/g) ?? [];
  return imports.map((line) => {
    const match = line.match(/@import '\.\/(styles\/[^']+)'/);
    return match ? `src/${match[1]}` : line;
  });
}

describe('production route ownership — Blackjack shell', () => {
  it('BlackjackPanel imports exactly one canonical BlackjackTableLayoutShell', () => {
    expect(PANEL_SRC).toContain(BLACKJACK_TABLE_LAYOUT_SHELL_NAME);
    expect((PANEL_SRC.match(/<BlackjackTableLayoutShell/g) ?? []).length).toBe(1);
    expect(PANEL_SRC).not.toMatch(/BlackjackTableLayoutShellFrozen/);
    expect(PANEL_SRC).not.toMatch(/FrozenLayout/);
  });

  it('follows App → TableScreen → BlackjackPanel → BlackjackTableLayoutShell', () => {
    expect(APP_SRC).toContain('TableScreen');
    expect(TABLE_SCREEN_SRC).toContain('BlackjackPanel');
    expect(TABLE_SCREEN_SRC).toMatch(/<BlackjackPanel[\s\S]*?\/>/);
    expect(PANEL_SRC).toContain('<BlackjackTableLayoutShell');
    expect(SHELL_SRC).toContain(`export function ${BLACKJACK_TABLE_LAYOUT_SHELL_NAME}`);
  });
});

describe('production route ownership — forbidden imports', () => {
  it('production src does not import reference-ui, frozen layout, or test fixtures', () => {
    const importFrom = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
    const violations: string[] = [];
    for (const file of listProductionSourceFiles()) {
      const src = readFileSync(join(ROOT, file), 'utf8');
      let match: RegExpExecArray | null;
      while ((match = importFrom.exec(src)) !== null) {
        const specifier = match[1]!;
        for (const pattern of PRODUCTION_FORBIDDEN_IMPORT_PATTERNS) {
          if (pattern.test(specifier)) {
            violations.push(`${file} imports '${specifier}' (${pattern})`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('allows design/templates theme registry (not a layout fork)', () => {
    expect(readFileSync(join(ROOT, 'src/App.tsx'), 'utf8')).toContain("from './design/templates'");
    expect(PANEL_SRC).not.toMatch(/from ['"].*design\/templates/);
  });
});

describe('production route ownership — CSS import order', () => {
  it('index.css matches CANONICAL_BLACKJACK_CSS_IMPORT_ORDER', () => {
    const paths = parseIndexCssImports();
    for (const expected of CANONICAL_BLACKJACK_CSS_IMPORT_ORDER) {
      expect(paths).toContain(expected);
    }
    expect(paths.indexOf('src/styles/tokens.css')).toBe(0);
    expect(paths.indexOf('src/styles/sxm-stitch-visual.css')).toBeLessThan(
      paths.indexOf('src/styles/bj-table-shared.css'),
    );
    expect(paths.indexOf('src/styles/bj-table-shared.css')).toBeLessThan(
      paths.indexOf('src/styles/bj-blackjack-table-shell.css'),
    );
    expect(paths.indexOf('src/styles/bj-full-table-card-area.css')).toBeLessThan(
      paths.indexOf('src/styles/bj-blackjack-table-shell.css'),
    );
    expect(paths.indexOf('src/styles/bj-card-layout.css')).toBeLessThan(
      paths.indexOf('src/styles/bj-blackjack-table-shell.css'),
    );
    expect(paths.lastIndexOf('src/styles/bj-card-mobile-hero-final.css')).toBe(paths.length - 1);
  });
});

describe('production route ownership — shell class and CSS geometry', () => {
  it('uses bj-table-layout-shell only via canonical shell component', () => {
    const TABLE_UX_SRC = readFileSync(join(ROOT, 'src/components/tableUxContract.ts'), 'utf8');
    expect(SHELL_SRC).toContain('TABLE_UX.tableLayoutShell');
    expect(TABLE_UX_SRC).toContain("tableLayoutShell: 'bj-table-layout-shell'");
    expect(PANEL_SRC).not.toMatch(/className=[^>]*bj-table-layout-shell/);
    expect(PANEL_SRC).not.toMatch(/bj-table-layout-shell--/);
  });

  it('owns desktop grid rows in bj-blackjack-table-shell.css only', () => {
    expect(SHELL_CSS).toMatch(/\[dealer\][\s\S]*\[command\][\s\S]*\[cards\][\s\S]*\[actions\]/);
    expect(SHARED_CSS).not.toMatch(/\[command\]/);
    expect(SHARED_CSS).not.toMatch(/grid-row:\s*command/);
  });

  it('owns Full Table card area geometry in bj-full-table-card-area.css', () => {
    expect(CARD_AREA_CSS).toContain('.bj-full-table-card-area');
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-arc--cards\.bj-full-table-card-area[\s\S]*\.bj-arc__slot--card-column/,
    );
  });

  it('owns Card View layout hooks in bj-card-layout.css and BlackjackCardView.css', () => {
    expect(CARD_LAYOUT_CSS).toContain('.bj-card-layout');
    expect(CARD_VIEW_CSS).toContain('.bj-phone-view');
    expect(CARD_LAYOUT_CSS).not.toMatch(/grid-template-rows:/);
  });

  it('does not define gameplay zone grid geometry in sxm-stitch-visual.css', () => {
    expect(STITCH_CSS).not.toMatch(/grid-template-rows:/);
    expect(STITCH_CSS).not.toMatch(/grid-row:/);
    expect(STITCH_CSS).not.toMatch(/\.bj-table-zone--/);
    expect(STITCH_CSS).not.toMatch(/\.bj-table-layout-shell/);
  });
});
