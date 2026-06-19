import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const OVERLAY_SRC = readFileSync(join(process.cwd(), 'src/components/GameOverActionOverlay.tsx'), 'utf8');
const STAKE_SRC = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.tsx'), 'utf8');

describe('game end UI wiring', () => {
  it('routes game-end actions through GameOverActionOverlay instead of table buttons', () => {
    expect(PANEL_SRC).toContain('GameOverActionOverlay');
    expect(PANEL_SRC).not.toContain('bj-game-end-actions');
    expect(PANEL_SRC).toContain('runGameOverCompleteAction');
    expect(PANEL_SRC).toContain('gameOverActionFlow');
    expect(PANEL_SRC).toContain("deviceView === 'mobile'");
    expect(PANEL_SRC).toContain('showGameOverDesktopPanel');
    expect(PANEL_SRC).toContain('layout="inline"');
    expect(OVERLAY_SRC).toContain('bj-game-over-overlay');
    expect(OVERLAY_SRC).toContain('Add to Ledger');
    expect(OVERLAY_SRC).toContain('Open Ledger');
    expect(OVERLAY_SRC).toContain('Start New Game');
    expect(OVERLAY_SRC).toContain('Exit Table');
    expect(OVERLAY_SRC).toContain('Create IOU');
    expect(PANEL_SRC).toContain('completeGameOverAction');
    expect(PANEL_SRC).toContain('runGameOverCompleteAction');
    expect(PANEL_SRC).toContain('onExitTable');
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
