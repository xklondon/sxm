import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHELL_SRC = readFileSync(
  join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'),
  'utf8',
);
const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');

function desktopShellBlock(): string {
  const start = SHARED_CSS.indexOf('/* Desktop table shell — fixed CSS grid rows');
  const end = SHARED_CSS.indexOf('/* Desktop stage:', start);
  return start >= 0 && end > start ? SHARED_CSS.slice(start, end) : '';
}

describe('desktop zone separation — cloth scoped to CardsArea', () => {
  it('mounts cloth inside CardsArea, not as shell sibling', () => {
    const renderBlock = SHELL_SRC.match(/return \(\s*[\s\S]*?\n  \);/)?.[0] ?? '';
    expect(renderBlock).toMatch(
      /<BlackjackCardsAreaZone[\s\S]*\{feltClothLayer\}[\s\S]*\{cardsArea\}[\s\S]*<\/BlackjackCardsAreaZone>/,
    );
    expect(renderBlock).not.toMatch(/<\/BlackjackCardsAreaZone>\s*\{feltClothLayer\}/);
    expect(SHELL_SRC).not.toMatch(/>\s*\{feltClothLayer\}\s*<BlackjackPlayerBoxesZone/);
  });

  it('does not assign cloth to shell grid row', () => {
    const desktop = desktopShellBlock();
    expect(desktop).not.toMatch(/\.bj-table-layout-shell > \.bj-felt-cloth-layer/);
    expect(SHARED_CSS).not.toMatch(/\.bj-table-layout-shell > \.bj-felt-cloth-layer[\s\S]*grid-row:\s*cards/);
  });

  it('scopes cloth absolute positioning to CardsArea only', () => {
    expect(FELT_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--cards[\s\S]*position:\s*relative/);
    expect(FELT_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--cards > \.bj-felt-cloth-layer/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*inset:\s*0/);
    expect(FELT_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards > :not\(\.bj-felt-cloth-layer\)[\s\S]*z-index:\s*1/,
    );
  });

  it('keeps canonical shell DOM order Dealer → Actions → Command → CardsArea → PlayerBoxes → Tray', () => {
    const renderBlock = SHELL_SRC.match(/return \(\s*[\s\S]*?\n  \);/)?.[0] ?? '';
    const dealerIdx = renderBlock.indexOf('{dealer}');
    const actionsIdx = renderBlock.indexOf('BlackjackActionsZone');
    const commandIdx = renderBlock.indexOf('BlackjackCommandZone');
    const cardsIdx = renderBlock.indexOf('BlackjackCardsAreaZone');
    const boxesIdx = renderBlock.indexOf('BlackjackPlayerBoxesZone');
    const trayIdx = renderBlock.indexOf('{chipTray}');
    expect(dealerIdx).toBeGreaterThan(-1);
    expect(dealerIdx).toBeLessThan(actionsIdx);
    expect(actionsIdx).toBeLessThan(commandIdx);
    expect(commandIdx).toBeLessThan(cardsIdx);
    expect(cardsIdx).toBeLessThan(boxesIdx);
    expect(boxesIdx).toBeLessThan(trayIdx);
  });

  it('stacks zones with isolation: dealer, actions, command, cards', () => {
    const desktop = desktopShellBlock();
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--dealer[\s\S]*z-index:\s*2/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*z-index:\s*3/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*z-index:\s*4/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--cards[\s\S]*z-index:\s*5/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--dealer[\s\S]*isolation:\s*isolate/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--actions[\s\S]*isolation:\s*isolate/);
    expect(desktop).toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*isolation:\s*isolate/);
  });

  it('does not use negative margins or z-index overlap hacks between dealer and command rows', () => {
    const desktop = desktopShellBlock();
    expect(desktop).not.toMatch(/\.bj-table-layout-shell > \.bj-table-zone--dealer[\s\S]*margin-bottom:\s*-/);
    expect(desktop).not.toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*margin-top:\s*-/);
    expect(desktop).not.toMatch(/\.bj-table-layout-shell > \.bj-table-zone--summary[\s\S]*z-index:\s*[89]/);
  });
});
