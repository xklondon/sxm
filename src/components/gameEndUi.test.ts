import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const STAKE_SRC = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.tsx'), 'utf8');

describe('game end UI wiring', () => {
  it('shows aligned Add to Ledger and Add IOU actions at game end', () => {
    expect(PANEL_SRC).toContain('bj-game-end-actions');
    expect(PANEL_SRC).toContain('Add to Ledger');
    expect(PANEL_SRC).toContain('Add IOU');
    expect(PANEL_SRC).toContain('buildGameEndIouHandoff');
    expect(PANEL_SRC).not.toContain('Close without ledger');
  });

  it('New Table Step 2 Practice/Challenge use canonical select-btn tabs', () => {
    expect(STAKE_SRC).toMatch(
      /renderStagedModeStage[\s\S]*table-stake-panel__tabs[\s\S]*Practice[\s\S]*Challenge/,
    );
    expect(STAKE_SRC).not.toMatch(
      /renderStagedModeStage[\s\S]*table-stake-panel__mode-card/,
    );
  });
});
