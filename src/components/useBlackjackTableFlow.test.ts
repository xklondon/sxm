import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FLOW_SRC = readFileSync(join(process.cwd(), 'src/components/useBlackjackTableFlow.ts'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

describe('useBlackjackTableFlow betting UX', () => {
  it('does not treat online stake actions as deal-action pending', () => {
    expect(FLOW_SRC).toMatch(/dealActionPending:\s*actionPending,/);
    expect(FLOW_SRC).not.toMatch(/dealActionPending:\s*actionPending \|\| onlineActionInFlight/);
  });

  it('does not block canDeal while online placeBet is in flight', () => {
    expect(FLOW_SRC).toMatch(/canDeal[\s\S]*!actionPending/);
    expect(FLOW_SRC).not.toMatch(/canDeal[\s\S]*!onlineActionInFlight/);
  });

  it('applies optimistic chip placement before online placeBet dispatch', () => {
    expect(PANEL_SRC).toContain('applyOptimisticChipPlacement');
    expect(PANEL_SRC).toMatch(/onlineDispatch\('placeBet'[\s\S]*onGameStateChange\(snapshot\)/);
  });

  it('does not mutate protocol locally for manual deal/bank controls when online', () => {
    expect(FLOW_SRC).toMatch(/handleDealNextCard[\s\S]*if \(onlineDispatch\)[\s\S]*return/);
    expect(FLOW_SRC).toMatch(/handleDrawBank[\s\S]*if \(onlineDispatch\)[\s\S]*return/);
    expect(FLOW_SRC).toMatch(/handleShuffleFresh[\s\S]*if \(onlineDispatch\)[\s\S]*return/);
  });

  it('hides manual Card/Draw dealer controls when online', () => {
    expect(PANEL_SRC).toContain('initialDealStaged && !onlineDispatch');
    expect(PANEL_SRC).toContain("flowSettings.bankDrawMode === 'manual' && !onlineDispatch");
  });
});
