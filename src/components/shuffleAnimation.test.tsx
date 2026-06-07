import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { DealerBlock } from './DealerBlock';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const DEALER_CSS = readFileSync(join(process.cwd(), 'src/components/DealerBlock.css'), 'utf8');

describe('dealer shuffle animation', () => {
  it('Panel triggers shuffle animation before existing shuffle handler', () => {
    expect(PANEL_SRC).toContain('handleShuffleWithAnimation');
    expect(PANEL_SRC).toMatch(/setShuffleAnimating\(true\)/);
    expect(PANEL_SRC).toMatch(/handleShuffleWithAnimation[\s\S]*handleShuffleToStart\(\)/);
    expect(PANEL_SRC).toContain('shuffleAnimating');
  });

  it('applies shuffling class to dealer card stack when animating', () => {
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
        shuffleAnimating
      />,
    );
    expect(html).toContain('dealer-block__card-stack--shuffling');
  });

  it('clears animation class after timeout in Panel', () => {
    expect(PANEL_SRC).toMatch(/setTimeout[\s\S]*setShuffleAnimating\(false\)/);
  });

  it('defines shuffle jitter keyframes with reduced-motion fallback', () => {
    expect(DEALER_CSS).toContain('dealer-block__card-stack--shuffling');
    expect(DEALER_CSS).toContain('@keyframes dealer-shuffle-jitter');
    expect(DEALER_CSS).toMatch(/prefers-reduced-motion[\s\S]*animation:\s*none/);
  });
});
