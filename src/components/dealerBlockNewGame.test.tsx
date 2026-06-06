import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DealerBlock } from './DealerBlock';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';

const noop = () => {};

function renderDealerBlock(overrides: Partial<Parameters<typeof DealerBlock>[0]> = {}) {
  return renderToStaticMarkup(
    <DealerBlock
      awaitingNextRound={false}
      gameEnded={false}
      onNextRound={noop}
      dealerCards={null}
      protocolPhase="betting"
      bankerReady
      shoeStarted={false}
      bettingOpen
      canDeal={false}
      hasStakes
      onShuffleToStart={noop}
      onDealCards={noop}
      onDealNextCard={noop}
      onDrawBank={noop}
      initialDealManual={false}
      bankDrawManual={false}
      {...overrides}
    />,
  );
}

describe('DealerBlock New Game', () => {
  it('shows New Game when the table game has ended', () => {
    const onNewGame = vi.fn();
    const html = renderDealerBlock({
      gameEnded: true,
      onNewGame,
      canStartNewGame: true,
      protocolPhase: 'betting' as BlackjackProtocolPhase,
      bettingOpen: false,
    });
    expect(html).toContain('New Game');
    expect(html).not.toContain('Next Round');
    expect(html).not.toContain('Deal Cards');
  });

  it('disables New Game for non-owner with waiting hint', () => {
    const html = renderDealerBlock({
      gameEnded: true,
      onNewGame: noop,
      canStartNewGame: false,
      newGameDisabledReason: 'Only the table owner can start a new game.',
      protocolPhase: 'betting' as BlackjackProtocolPhase,
      bettingOpen: false,
    });
    expect(html).toContain('New Game');
    expect(html).toContain('disabled');
    expect(html).toContain('Only the table owner can start a new game.');
  });

  it('shows Next Round between rounds when the game is still active', () => {
    const html = renderDealerBlock({
      gameEnded: false,
      awaitingNextRound: true,
      protocolPhase: 'round-complete',
      bettingOpen: false,
      shoeStarted: true,
    });
    expect(html).toContain('Next Round');
    expect(html).not.toContain('New Game');
  });

  it('does not show New Game while betting or playing', () => {
    const dealing = renderDealerBlock({
      gameEnded: false,
      onNewGame: noop,
      canStartNewGame: true,
      shoeStarted: true,
      canDeal: true,
      protocolPhase: 'betting',
    });
    expect(dealing).toContain('Deal Cards');
    expect(dealing).not.toContain('New Game');

    const playing = renderDealerBlock({
      gameEnded: false,
      onNewGame: noop,
      protocolPhase: 'player',
      bettingOpen: false,
      shoeStarted: true,
    });
    expect(playing).toContain('Deal Cards');
    expect(playing).toContain('disabled');
    expect(playing).not.toContain('New Game');
  });
});
