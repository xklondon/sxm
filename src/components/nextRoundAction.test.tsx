import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { DealerBlock } from './DealerBlock';

describe('Next Round — single click', () => {
  it('disables Next Round while pending', () => {
    const html = renderToStaticMarkup(
      <DealerBlock
        awaitingNextRound
        gameEnded={false}
        onNextRound={vi.fn()}
        dealerCards={null}
        protocolPhase="round-complete"
        bankerReady
        shoeStarted
        bettingOpen={false}
        canDeal={false}
        hasStakes
        onShuffleToStart={vi.fn()}
        onDealCards={vi.fn()}
        onDealNextCard={vi.fn()}
        onDrawBank={vi.fn()}
        nextRoundPending
        initialDealManual={false}
        bankDrawManual={false}
      />,
    );
    expect(html).toContain('Starting…');
    expect(html).toContain('disabled');
  });

  it('handleNextRound guards duplicate dispatch', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/components/useBlackjackTableFlow.ts'),
      'utf8',
    );
    expect(src).toMatch(/if \(actionPending \|\| onlineActionInFlight \|\| nextRoundPending\)/);
    expect(src).toContain('setNextRoundPending(true)');
    expect(src).toContain('setNextRoundPending(false)');
  });

  it('dealer primary action slot has no pointer-events overlay', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/DealerBlock.css'), 'utf8');
    expect(css).not.toMatch(/dealer-block__action-slot[\s\S]*pointer-events:\s*none/);
  });
});
