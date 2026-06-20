import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';
import { TableStakePanel } from './TableStakePanel';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.tsx'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.css'), 'utf8');

describe('TableStakePanel staged new table layout', () => {
  it('shows category step once at open', () => {
    expect(PANEL_SRC.match(/Pick a game/gi)?.length ?? 0).toBe(0);
    const html = renderToStaticMarkup(
      <TableStakePanel
        gameState={tableAfterStartPlaying(500)}
        mode="new"
        onConfirm={() => {}}
      />,
    );
    expect(html.match(/Pick a game/gi)?.length ?? 0).toBe(0);
    expect(html).toContain('<legend>Game category</legend>');
    expect(html).toContain('>Cards<');
    expect(html).toContain('>Dice<');
  });

  it('applies compact panel styling on staged new flow', () => {
    expect(PANEL_CSS).toContain('.table-stake-panel--compact');
    expect(PANEL_CSS).toMatch(/\.table-stake-panel--compact \.table-stake-panel__select-btn[\s\S]*padding:/);
    expect(PANEL_CSS).toMatch(/\.table-stake-panel--compact \.table-stake-panel__tabs button[\s\S]*flex:/);
  });

  it('mode step uses Practice and Challenge tabs without Continue', () => {
    expect(PANEL_SRC).toMatch(
      /renderStagedModeStage[\s\S]*table-stake-panel__tabs[\s\S]*Practice/,
    );
    expect(PANEL_SRC).not.toMatch(
      /renderStagedModeStage[\s\S]*table-stake-panel__mode-card/,
    );
    const html = renderToStaticMarkup(
      <TableStakePanel
        gameState={tableAfterStartPlaying(500)}
        mode="new"
        onConfirm={() => {}}
      />,
    );
    expect(html).toContain('table-stake-panel--compact');
    expect(html).not.toContain('>Continue<');
  });
});
