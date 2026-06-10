import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';
import { TableStakePanel } from './TableStakePanel';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.tsx'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.css'), 'utf8');

describe('TableStakePanel staged new table layout', () => {
  it('shows pick-a-game intro at most once', () => {
    expect(PANEL_SRC.match(/Pick a game/gi)?.length ?? 0).toBe(0);
    const html = renderToStaticMarkup(
      <TableStakePanel
        gameState={tableAfterStartPlaying(500)}
        mode="new"
        onConfirm={() => {}}
      />,
    );
    expect(html.match(/Pick a game/gi)?.length ?? 0).toBe(0);
    expect(html).toContain('Game / protocol');
  });

  it('applies compact panel styling on staged new flow', () => {
    expect(PANEL_CSS).toContain('.table-stake-panel--compact');
    expect(PANEL_CSS).toMatch(/\.table-stake-panel--compact \.table-stake-panel__confirm[\s\S]*padding:/);
    expect(PANEL_CSS).toMatch(/\.table-stake-panel--compact \.table-stake-panel__tabs button[\s\S]*border:/);
  });

  it('keeps required staged fields and continue action', () => {
    const html = renderToStaticMarkup(
      <TableStakePanel
        gameState={tableAfterStartPlaying(500)}
        mode="new"
        onConfirm={() => {}}
      />,
    );
    expect(html).toContain('Rule protocol');
    expect(html).toContain('Continue');
    expect(html).toContain('table-stake-panel--compact');
  });
});
