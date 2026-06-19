import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLACKJACK_ENGINE_FREEZE_DOC,
  BLACKJACK_ENGINE_FROZEN,
  CARD_VIEW_CANONICAL_SHELL_ACTIONS_ONLY,
  CARD_VIEW_CARDS_AREA_CLASS,
  CARD_VIEW_MOBILE_ROOT,
  FULL_TABLE_ACTIONS_RENDER_FN,
  FULL_TABLE_SHELL_ZONE_ORDER,
} from './blackjackLayoutContract';
const PACKAGE_JSON_RAW = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
const PACKAGE_SCRIPTS = JSON.parse(PACKAGE_JSON_RAW).scripts as Record<string, string>;
const SHELL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const DEALER_AREA_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackDealerArea.tsx'), 'utf8');
const VIEW_CONTRACT_SRC = readFileSync(join(process.cwd(), 'src/components/tableViewContract.ts'), 'utf8');
const VIEW_ZONES_SRC = readFileSync(join(process.cwd(), 'src/components/blackjackViewZones.tsx'), 'utf8');
const FREEZE_DOC = readFileSync(join(process.cwd(), BLACKJACK_ENGINE_FREEZE_DOC), 'utf8');

describe('Blackjack engine freeze guards', () => {
  it('documents engine freeze baseline', () => {
    expect(BLACKJACK_ENGINE_FROZEN).toBe(true);
    expect(FREEZE_DOC).toContain('2026-06-13');
    expect(FREEZE_DOC).toContain('applyBlackjackActionToState');
    expect(FREEZE_DOC).toContain('New games');
    expect(FREEZE_DOC).toContain('BlackjackTableLayoutShell');
  });

  it('protects BlackjackTableLayoutShell zone order', () => {
    expect(FULL_TABLE_SHELL_ZONE_ORDER).toEqual([
      'bank-info',
      'dealer',
      'command',
      'cards',
      'actions',
      'boxes',
      'tray',
    ]);
    expect(SHELL_SRC).toContain('BankInfo → Dealer → Command → CardsArea → Actions → PlayerBoxes → ChipTray');
    expect(SHELL_SRC).toMatch(/tableBankInfo[\s\S]*\{dealer\}[\s\S]*BlackjackCommandZone[\s\S]*BlackjackCardsAreaZone[\s\S]*BlackjackActionsZone[\s\S]*BlackjackPlayerBoxesZone/);
    expect(DEALER_AREA_SRC).toContain('bj-dealer-area');
    expect(VIEW_ZONES_SRC).toContain('TABLE_UX.tableZoneSummary');
    expect(VIEW_ZONES_SRC).toContain('TABLE_UX.tableZoneCards');
    expect(VIEW_ZONES_SRC).toContain('TABLE_UX.cardsAreaHero');
    expect(VIEW_ZONES_SRC).toContain('TABLE_UX.tableZoneActions');
    expect(VIEW_ZONES_SRC).toContain('TABLE_UX.tableZoneBoxes');
    expect(SHELL_SRC).toContain('TABLE_UX.tableZoneBottom');
  });

  it('keeps desktop data-bj-view and data-bj-phase contract', () => {
    expect(PANEL_SRC).toContain("data-bj-view={deviceView === 'desktop' ? viewMode : undefined}");
    expect(PANEL_SRC).toContain('data-bj-phase={desktopLayoutPhase}');
    expect(PANEL_SRC).toContain('getBlackjackDesktopLayoutPhase');
  });

  it('routes shared action row through renderActionsContent for Full Table and Card View', () => {
    expect(FULL_TABLE_ACTIONS_RENDER_FN).toBe('renderActionsContent');
    expect(PANEL_SRC).toContain(`actions={${FULL_TABLE_ACTIONS_RENDER_FN}()}`);
    expect(CARD_VIEW_CANONICAL_SHELL_ACTIONS_ONLY).toBe(true);
    expect(PANEL_SRC).toContain('BlackjackActionRow');
  });

  it('desktop Card View uses CardViewDesktopHeroArea, not mobile phone-view hero route', () => {
    expect(PANEL_SRC).toMatch(
      /cardsArea=\{[\s\S]*viewMode === 'full'[\s\S]*isCardViewDesktop \?[\s\S]*CardViewDesktopHeroArea[\s\S]*<BlackjackCardView/,
    );
  });

  it('mobile Card View uses BlackjackCardView hero route', () => {
    expect(PANEL_SRC).toMatch(/<BlackjackCardView[\s\S]*segment="all"/);
    expect(PANEL_SRC).toContain('isCardViewMobile');
    expect(VIEW_CONTRACT_SRC).toContain(CARD_VIEW_MOBILE_ROOT);
    expect(VIEW_ZONES_SRC).toContain('TABLE_UX.cardsAreaHero');
    expect(PANEL_SRC).toContain("cardsAreaMode={viewMode === 'full' ? 'table' : 'hero'}");
  });

  it('excludes heavy blackjackRenderedLayout from routine layout scripts', () => {
    expect(PACKAGE_SCRIPTS['test:layout:fast']).toContain('blackjackEngineFreezeGuards');
    expect(PACKAGE_SCRIPTS['test:layout:fast']).not.toContain('blackjackRenderedLayout');
    expect(PACKAGE_SCRIPTS['test:layout:rendered']).toContain('blackjackRenderedLayout');
    expect(PACKAGE_SCRIPTS['test:layout:audit']).toContain('test:layout:ownership');
    expect(PACKAGE_SCRIPTS['test:layout:audit']).not.toContain('blackjackRenderedLayout');
  });

  it('gates new games in freeze doc — separate protocol routes only', () => {
    expect(FREEZE_DOC).toMatch(/separate protocol modules/i);
    expect(FREEZE_DOC).toContain('unless unfreezing');
    expect(FREEZE_DOC).toContain('Zilch');
  });
});
