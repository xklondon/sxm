import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { DealerBlock } from './DealerBlock';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const FLOW_SRC = readFileSync(join(process.cwd(), 'src/components/useBlackjackTableFlow.ts'), 'utf8');
const DEALER_SRC = readFileSync(join(process.cwd(), 'src/components/DealerBlock.tsx'), 'utf8');

describe('primary Deal Cards start sequence', () => {
  it('shows Deal Cards (not Shuffle to start) before shoe is started', () => {
    const html = renderToStaticMarkup(
      <DealerBlock
        awaitingNextRound={false}
        gameEnded={false}
        dealerCards={null}
        onNextRound={() => {}}
        protocolPhase="betting"
        bankerReady
        shoeStarted={false}
        bettingOpen
        canDeal={false}
        hasStakes
        onShuffleToStart={() => {}}
        onDealCards={() => {}}
        onDealNextCard={() => {}}
        onDrawBank={() => {}}
        initialDealManual={false}
        bankDrawManual={false}
      />,
    );
    expect(html).toContain('Deal Cards');
    expect(html).not.toContain('Shuffle to start');
  });

  it('detects first start via tableMeta.shoeStarted and chains shuffle then deal', () => {
    expect(FLOW_SRC).toContain('const isFirstStart = !state.tableMeta.shoeStarted');
    expect(FLOW_SRC).toMatch(/shuffleToStartOnState[\s\S]*dealCardsButtonOnState/);
    expect(FLOW_SRC).toMatch(/onlineDispatch\('shuffleToStart'[\s\S]*onlineDispatch\('dealCards'/);
  });

  it('runs 3s shuffle animation only on first start from Panel', () => {
    expect(PANEL_SRC).toContain('SHUFFLE_ANIM_DURATION_MS = 3000');
    expect(PANEL_SRC).toMatch(/firstStartShuffleDelayMs:\s*tableMeta\.shoeStarted \? 0 : SHUFFLE_ANIM_DURATION_MS/);
    expect(PANEL_SRC).toMatch(/onDealCards:\s*handlePrimaryDealAction/);
    expect(PANEL_SRC).not.toMatch(/handleShuffleWithAnimation/);
  });

  it('subsequent rounds call deal path directly when shoe already started', () => {
    expect(FLOW_SRC).toMatch(/if \(!isFirstStart\) \{[\s\S]*handleDealCards\(\)/);
    expect(DEALER_SRC).toMatch(/if \(!shoeStarted\)[\s\S]*label:[\s\S]*Deal Cards/);
    expect(DEALER_SRC).toMatch(/shoeStarted[\s\S]*onClick:\s*onDealCards/);
  });

  it('blocks duplicate clicks while pending or animating', () => {
    expect(FLOW_SRC).toMatch(/if \(actionPending\)[\s\S]*return/);
    expect(DEALER_SRC).toMatch(/dealActionPending \|\| shuffleAnimating/);
  });
});
