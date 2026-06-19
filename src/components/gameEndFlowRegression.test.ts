import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const OVERLAY_SRC = readFileSync(join(process.cwd(), 'src/components/GameOverActionOverlay.tsx'), 'utf8');
const TABLE_SRC = readFileSync(join(process.cwd(), 'src/screens/TableScreen.tsx'), 'utf8');
const APP_SRC = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');

describe('game end flow regression guards', () => {
  it('uses safe reveal gate without requiring winnerPersonId', () => {
    expect(PANEL_SRC).toMatch(/gameEndRevealReady = cardRevealComplete \|\| gameEnded/);
    expect(PANEL_SRC).toMatch(/const showGameOverActions =\s*\n\s*gameEnded && !gameOverOverlayDismissed/);
    expect(PANEL_SRC).not.toMatch(/const showGameOverActions[\s\S]*winnerId/);
    expect(PANEL_SRC).toMatch(
      /const showGameOverDesktopPanel =\s*\n\s*showGameOverActions && deviceView === 'desktop' && gameEndRevealReady/,
    );
  });

  it('re-opens desktop This Table panel while game-over UI is active', () => {
    expect(PANEL_SRC).toMatch(
      /showGameOverDesktopPanel && sideRailPanel !== 'thisTable'[\s\S]*setSideRailPanel\('thisTable'\)/,
    );
    expect(PANEL_SRC).toMatch(/desktopSideRailPanel[\s\S]*showGameOverDesktopPanel \? 'thisTable'/);
  });

  it('routes desktop game-over dismiss through handleGameOverDismiss', () => {
    expect(PANEL_SRC).toContain('onDismiss={handleGameOverDismiss}');
    expect(PANEL_SRC).toMatch(/closeSideRailPanel[\s\S]*handleGameOverDismiss/);
  });

  it('gates Start New Game on owner only, not panel visibility', () => {
    expect(OVERLAY_SRC).toContain('canStartNewGame');
    expect(PANEL_SRC).toContain('canStartNewGame={canResetTable}');
    expect(PANEL_SRC).toMatch(/newGameDisabledReason[\s\S]*Only the table owner can start a new game/);
  });

  it('does not save ledger or IOU from dismiss handlers', () => {
    expect(PANEL_SRC).toMatch(/function handleGameOverDismiss\(\)[\s\S]*setGameOverOverlayDismissed\(true\)/);
    expect(PANEL_SRC).not.toMatch(/handleGameOverDismiss[\s\S]*addGameToPersonalLedger/);
    expect(PANEL_SRC).not.toMatch(/handleGameOverDismiss[\s\S]*submitIouHandoff/);
  });

  it('applies ledger and IOU only from completeGameOverAction', () => {
    expect(PANEL_SRC).toMatch(/completeGameOverAction[\s\S]*runGameOverCompleteAction/);
    expect(PANEL_SRC).toMatch(/nextAction === 'new-game'[\s\S]*setGameOverOverlayConfirmed\(true\)/);
    expect(PANEL_SRC).not.toMatch(/exit-table[\s\S]*setGameOverOverlayConfirmed\(true\)/);
    expect(OVERLAY_SRC).toMatch(/handleStartNewGame[\s\S]*onComplete\(/);
    expect(OVERLAY_SRC).toContain('Exit Table');
  });

  it('routes Exit Table through onLeave save prompt in TableScreen', () => {
    expect(TABLE_SRC).toContain('onExitTable={onLeave}');
    expect(APP_SRC).toContain('onLeave={requestLeaveTable}');
    expect(APP_SRC).toContain('exitTableScreen');
    expect(APP_SRC).toMatch(/setScreen\(onlineMode && user \? 'lobby' : 'start'\)/);
  });
});
