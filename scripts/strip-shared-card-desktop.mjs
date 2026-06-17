/**
 * Line-safe edits for Desktop Card View layout ownership in bj-table-shared.css.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SHARED = 'src/styles/bj-table-shared.css';
let css = readFileSync(SHARED, 'utf8');

function removeCardDesktopSelectorLines(input) {
  let css = input;
  // First selector in a comma list.
  css = css.replace(/^([ \t]*)\.bj-view-card-desktop[^\n]*,\r?\n/gm, '');
  // Middle selectors (line ends with comma).
  css = css.replace(/,\r?\n([ \t]*)\.bj-view-card-desktop[^\n]*,\r?\n/g, ',\r\n');
  // Last selector before `{` on same line.
  css = css.replace(/,\r?\n([ \t]*)\.bj-view-card-desktop[^\n]*(?=\s*\{)/g, '');
  // Standalone selector line(s) before `{` on same line.
  css = css.replace(/\r?\n[ \t]*\.bj-view-card-desktop[^\n]*(?=\s*\{)/g, '');
  return css;
}

css = removeCardDesktopSelectorLines(css);

// Drop card-desktop-only rule blocks.
{
  const re =
    /[ \t]*(?:\.bj-view-card-desktop[^{,\n]*)(?:\s*,\s*\.bj-view-card-desktop[^{,\n]*)*\s*\{[^{}]*\}\r?\n?/g;
  let prev;
  do {
    prev = css;
    css = css.replace(re, '');
  } while (css !== prev);
}

// Inside desktop @media, scope bare .bj-table-layout-shell selectors to full-desktop.
const lines = css.split(/\r?\n/);
const out = [];
let inDesktopMedia = false;
let mediaDepth = 0;

for (const line of lines) {
  if (line.match(/@media\s*\(min-width:\s*721px\)/)) {
    inDesktopMedia = true;
    mediaDepth = 0;
  }
  if (inDesktopMedia) {
    for (const ch of line) {
      if (ch === '{') mediaDepth++;
      if (ch === '}') mediaDepth--;
    }
    if (mediaDepth <= 0 && line.includes('}') && !line.match(/@media\s*\(min-width:\s*721px\)/)) {
      inDesktopMedia = false;
    }
    if (
      inDesktopMedia &&
      line.includes('.bj-table-layout-shell') &&
      !line.includes('bj-view-') &&
      !line.trim().startsWith('/*')
    ) {
      out.push(line.replace(/^([ \t]*)\.bj-table-layout-shell/, '$1.bj-view-full-desktop .bj-table-layout-shell'));
      continue;
    }
  }
  out.push(line);
}
css = out.join('\n');

css = css.replace(/,\s*,/g, ',');
css = css.replace(/,\s*\{/g, ' {');

writeFileSync(SHARED, css);
console.log('updated', SHARED);
