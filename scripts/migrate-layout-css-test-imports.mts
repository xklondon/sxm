/**
 * One-shot: point layout guard tests at readBlackjackLayoutCss helper for shared/shell reads.
 * Run: npx tsx scripts/migrate-layout-css-test-imports.mts
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SHARED_READ =
  /const SHARED_CSS = readFileSync\(join\(process\.cwd\(\), 'src\/styles\/bj-table-shared\.css'\), 'utf8'\);?\n/g;
const SHELL_READ =
  /const SHELL_CSS = readFileSync\(join\(process\.cwd\(\), 'src\/styles\/bj-blackjack-table-shell\.css'\), 'utf8'\);?\n/g;
const HELPER_IMPORT = "import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';\n";
const HELPER_IMPORT_COMPONENTS = "import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';\n";
const DESTRUCT =
  "const { shared: SHARED_CSS, shell: SHELL_CSS } = readBlackjackLayoutCss();\n";

function listTestFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      out.push(...listTestFiles(full));
      continue;
    }
    if (/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function relativeImportPath(filePath: string): string {
  const rel = filePath.replace(/\\/g, '/').replace(`${ROOT.replace(/\\/g, '/')}/`, '');
  const depth = rel.split('/').length - 2;
  return `${ '../'.repeat(Math.max(depth, 0)) }test/readBlackjackLayoutCss`;
}

function migrateFile(filePath: string): boolean {
  let src = readFileSync(filePath, 'utf8');
  if (!src.includes("bj-table-shared.css") && !src.includes('bj-table-shared.css')) {
    return false;
  }
  if (!src.match(SHARED_READ) && !src.match(SHELL_READ)) {
    return false;
  }
  if (src.includes('readBlackjackLayoutCss')) {
    return false;
  }

  const hadShared = SHARED_READ.test(src);
  const hadShell = SHELL_READ.test(src);
  SHARED_READ.lastIndex = 0;
  SHELL_READ.lastIndex = 0;

  if (!hadShared) {
    return false;
  }

  src = src.replace(SHARED_READ, '');
  src = src.replace(SHELL_READ, '');

  const importPath = relativeImportPath(filePath);
  const importLine = `import { readBlackjackLayoutCss } from '${importPath}';\n`;

  const vitestImport = src.match(/^import .+ from 'vitest';?\n/m);
  if (vitestImport) {
    src = src.replace(vitestImport[0], `${vitestImport[0]}${importLine}`);
  } else {
    src = importLine + src;
  }

  const insertAfterImports = src.search(/\n(?:const|function|describe)/);
  const destructLine = hadShell
    ? DESTRUCT
    : "const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();\n";

  if (insertAfterImports >= 0) {
    src = `${src.slice(0, insertAfterImports + 1)}${destructLine}${src.slice(insertAfterImports + 1)}`;
  }

  // Legacy desktop shell slice from shared → use shell file
  src = src.replace(
    /function desktopShellBlock\(\): string \{\s*const start = SHARED_CSS\.indexOf\('\/\* Desktop table shell — fixed CSS grid rows'\);\s*const end = SHARED_CSS\.indexOf\('\/\* Desktop stage:', start\);\s*return start >= 0 && end > start \? SHARED_CSS\.slice\(start, end\) : '';\s*\}/g,
    'function desktopShellBlock(): string {\n  return SHELL_CSS;\n}',
  );
  src = src.replace(
    /function desktopShellBlock\(\): string \{\s*return SHELL_CSS;\s*\}/g,
    'function desktopShellBlock(): string {\n  return SHELL_CSS;\n}',
  );

  src = src.replace(
    /const desktopStart = SHARED_CSS\.indexOf\('\/\* Desktop table shell — fixed CSS grid rows'\);\s*const desktop = SHARED_CSS\.slice\(desktopStart, SHARED_CSS\.indexOf\('\/\* Desktop stage:', desktopStart\)\);/g,
    'const desktop = SHELL_CSS;',
  );

  src = src.replace(
    /const desktopStart = SHARED_CSS\.indexOf\('\/\* Desktop table shell — fixed CSS grid rows'\);\s*const desktop = desktopStart >= 0\s*\? SHARED_CSS\.slice\(desktopStart, SHARED_CSS\.indexOf\('\/\* Desktop stage:', desktopStart\)\)\s*: '';/g,
    'const desktop = SHELL_CSS;',
  );

  writeFileSync(filePath, src);
  return true;
}

const files = listTestFiles(join(ROOT, 'src'));
let count = 0;
for (const file of files) {
  if (migrateFile(file)) {
    count += 1;
    console.log('migrated', file.replace(/\\/g, '/').replace(`${ROOT.replace(/\\/g, '/')}/`, ''));
  }
}
console.log(`Done: ${count} files`);
