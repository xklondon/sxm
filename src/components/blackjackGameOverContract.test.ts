import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLACKJACK_CANONICAL_GAME_OVER_COMPONENT,
  BLACKJACK_GAME_OVER_CONTRACT_VERSION,
  BLACKJACK_GAME_OVER_LAYOUT,
} from './blackjackGameOverContract';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const OVERLAY_SRC = readFileSync(join(process.cwd(), 'src/components/GameOverActionOverlay.tsx'), 'utf8');

describe('blackjackGameOverContract — canonical single modal', () => {
  it('declares GameOverActionOverlay as the sole canonical component', () => {
    expect(BLACKJACK_GAME_OVER_CONTRACT_VERSION).toBe('game-over-canonical-v1');
    expect(BLACKJACK_CANONICAL_GAME_OVER_COMPONENT).toBe('GameOverActionOverlay');
    expect(BLACKJACK_GAME_OVER_LAYOUT).toBe('overlay');
  });

  it('renders exactly one GameOverActionOverlay instance in BlackjackPanel', () => {
    expect((PANEL_SRC.match(/<GameOverActionOverlay/g) ?? []).length).toBe(1);
    expect(PANEL_SRC).toContain('renderCanonicalGameOverModal');
    expect(PANEL_SRC).toContain('showGameOverModal');
    expect(PANEL_SRC).toContain('BLACKJACK_GAME_OVER_LAYOUT');
  });

  it('does not render duplicate desktop table overlay or inline side-rail game over', () => {
    expect(PANEL_SRC).not.toContain('bj-game-over-table-overlay');
    expect(PANEL_SRC).not.toContain('showGameOverDesktopPanel');
    expect(PANEL_SRC).not.toContain('showGameOverDesktopTableOverlay');
    expect(PANEL_SRC).not.toContain('layout="inline"');
    expect(PANEL_SRC).not.toMatch(/showGameOverDesktopPanel \? 'thisTable'/);
  });

  it('suppresses side rail while canonical game-over modal is active', () => {
    expect(PANEL_SRC).toMatch(/if \(!activePanel \|\| showGameOverModal\)/);
    expect(PANEL_SRC).toMatch(/sideRailPanel && !showGameOverModal/);
  });

  it('uses the same modal route for desktop and mobile (not deviceView-gated)', () => {
    expect(PANEL_SRC).toMatch(
      /const showGameOverModal =\s*\n\s*showGameOverActions && gameEndRevealReady && gameOverDelayReady/,
    );
    expect(PANEL_SRC).not.toContain('showGameOverOverlay');
    expect(PANEL_SRC).not.toContain('showGameOverDesktopPanel');
  });
});

describe('blackjackGameOverContract — action wiring', () => {
  it('Start New Game and Exit Table call existing complete handlers', () => {
    expect(OVERLAY_SRC).toMatch(/handleStartNewGame[\s\S]*onComplete\(/);
    expect(OVERLAY_SRC).toMatch(/handleExitTable[\s\S]*onComplete\(/);
    expect(OVERLAY_SRC).toContain('Start New Game');
    expect(OVERLAY_SRC).toContain('Exit Table');
    expect(PANEL_SRC).toContain('onComplete={completeGameOverAction}');
    expect(PANEL_SRC).toContain('canStartNewGame={canResetTable}');
  });

  it('includes full panel content fields in canonical overlay', () => {
    expect(OVERLAY_SRC).toContain('Add to Ledger');
    expect(OVERLAY_SRC).toContain('Create IOU');
    expect(OVERLAY_SRC).toContain('magic8Line');
    expect(OVERLAY_SRC).toContain('roundsLine');
  });
});
