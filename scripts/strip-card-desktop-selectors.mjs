import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  'src/styles/bj-table-shared.css',
  'src/styles/bj-player-row-layout.css',
  'src/components/ChipStack.css',
  'src/components/DealerBlock.css',
];

function findMatchingBrace(css, openIdx) {
  let depth = 1;
  for (let i = openIdx + 1; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return css.length - 1;
}

function stripCardDesktopSelectors(selectorText) {
  return selectorText
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !s.includes('bj-view-card-desktop'))
    .join(',\n');
}

function scopeShellSelector(selectorText) {
  return selectorText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((sel) => {
      if (sel.includes('bj-view-')) return sel;
      if (sel.startsWith('.bj-table-layout-shell')) return `.bj-view-full-desktop ${sel}`;
      return sel;
    })
    .join(',\n');
}

function processRules(css, scopeShell) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf('{', i);
    if (brace === -1) {
      out += css.slice(i);
      break;
    }
    const selRaw = css.slice(i, brace);
    const selTrim = selRaw.trim();
    const close = findMatchingBrace(css, brace);
    const body = css.slice(brace + 1, close);

    if (selTrim.startsWith('@media')) {
      const isDesktop = selTrim.includes('min-width: 721px');
      const inner = processRules(body, isDesktop);
      out += `${selRaw}{${inner}}`;
    } else if (selTrim.includes('bj-view-card-desktop')) {
      const kept = stripCardDesktopSelectors(selTrim);
      if (kept) out += `${kept}{${body}}`;
    } else if (scopeShell && selTrim.includes('.bj-table-layout-shell') && !selTrim.includes('bj-view-')) {
      const scoped = scopeShellSelector(selTrim);
      if (scoped) out += `${scoped}{${body}}`;
    } else {
      out += css.slice(i, close + 1);
    }
    i = close + 1;
  }
  return out;
}

for (const file of FILES) {
  const before = readFileSync(file, 'utf8');
  const after = processRules(before, false);
  if (after !== before) {
    writeFileSync(file, after);
    console.log('updated', file);
  }
}
