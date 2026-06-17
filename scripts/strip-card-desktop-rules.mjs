import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  'src/styles/bj-player-row-layout.css',
  'src/components/ChipStack.css',
  'src/components/DealerBlock.css',
];

function removeCardDesktopSelectorLines(input) {
  let css = input;
  css = css.replace(/^([ \t]*)\.bj-view-card-desktop[^\n]*,\r?\n/gm, '');
  css = css.replace(/,\r?\n([ \t]*)\.bj-view-card-desktop[^\n]*,\r?\n/g, ',\r\n');
  css = css.replace(/,\r?\n([ \t]*)\.bj-view-card-desktop[^\n]*(?=\s*\{)/g, '');
  css = css.replace(/\r?\n[ \t]*\.bj-view-card-desktop[^\n]*(?=\s*\{)/g, '');
  return css;
}

for (const file of FILES) {
  let css = readFileSync(file, 'utf8');
  css = removeCardDesktopSelectorLines(css);
  const re =
    /[ \t]*(?:\.bj-view-card-desktop[^{,\n]*)(?:\s*,\s*\.bj-view-card-desktop[^{,\n]*)*\s*\{[^{}]*\}\r?\n?/g;
  let prev;
  do {
    prev = css;
    css = css.replace(re, '');
  } while (css !== prev);
  css = css.replace(/,\s*,/g, ',');
  css = css.replace(/,\s*\{/g, ' {');
  writeFileSync(file, css);
  console.log('updated', file);
}
