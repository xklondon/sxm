/**
 * Remove .bj-view-card-desktop from non-owner CSS:
 * - Drop card-desktop-only rules whose body uses forbidden layout properties
 * - Remove .bj-view-card-desktop lines from multi-selector rules (keep other views)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OWNER = 'src/styles/bj-card-desktop-layout.css';
const FORBIDDEN =
  /\b(display|grid-template(?:-columns|-rows)?|grid-row|grid-column|flex(?:-direction|-wrap|-grow|-shrink|-basis)?|justify-content|align-items|align-self|position|top|bottom|left|right|margin-top|margin-bottom|translate|transform)\s*:/;

const TARGET_FILES = [
  'src/styles/bj-table-shared.css',
  'src/styles/bj-player-row-layout.css',
  'src/styles/bj-felt-skins.css',
  'src/styles/bj-card-layout.css',
  'src/components/ChipStack.css',
  'src/components/DealerBlock.css',
  'src/components/BlackjackPanel.css',
];

function stripCardDesktopSelectors(selector) {
  const parts = selector
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.includes('bj-view-card-desktop'));
  return parts.join(',\n');
}

function processCss(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf('{', i);
    if (brace === -1) {
      out += css.slice(i);
      break;
    }
    const selector = css.slice(i, brace).trim();
    let depth = 1;
    let j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(brace + 1, j - 1);
    const block = css.slice(i, j);

    if (!selector.includes('bj-view-card-desktop')) {
      out += block;
      i = j;
      continue;
    }

    const hasForbidden = FORBIDDEN.test(body);
    const onlyCardDesktop =
      selector
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .every((s) => s.includes('bj-view-card-desktop')) &&
      selector.includes('bj-view-card-desktop');

    if (onlyCardDesktop) {
      if (!hasForbidden) {
        out += block;
      }
      i = j;
      continue;
    }

    const kept = stripCardDesktopSelectors(selector);
    if (!kept) {
      i = j;
      continue;
    }
    out += `${kept} {${body}}`;
    i = j;
  }
  return out;
}

for (const file of TARGET_FILES) {
  const before = readFileSync(file, 'utf8');
  const after = processCss(before);
  if (after !== before) {
    writeFileSync(file, after);
    console.log('updated', file);
  }
}
