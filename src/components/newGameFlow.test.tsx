import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableStakePanel } from './TableStakePanel';
import { DealerBlock } from './DealerBlock';
import { tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';
import { applyTableResetSetup } from '../engine/session/tableReset';
import type { TableStakeSetupInput } from '../engine/session/tableSetup';

const setupInput: TableStakeSetupInput = {
  stakeDescription: 'Rematch',
  seatChips: 300,
  bankChips: 300,
  bankerMode: 'bot',
  bankerName: '',
  controllerName: 'Alice',
  controllerEmail: '',
  protocolId: 'las-vegas-house',
  naturalDealing: false,
  dealSpeedPreset: 'normal',
  cardTimerPreset: 0,
  bankDrawAuto: true,
};

const noop = () => {};

function endedBlackjackTable() {
  const state = tableAfterStartPlaying(500);
  const bankId = state.session.bankPlayerId!;
  return {
    ...state,
    blackjack: null,
    deck: null,
    tableMeta: {
      ...state.tableMeta,
      gameStatus: 'ended' as const,
      winnerId: bankId,
      endedAt: new Date().toISOString(),
      awaitingNextRound: false,
      bettingLocked: true,
    },
  };
}

describe('New Game flow', () => {
  it('TableStakePanel newGame variant uses New Game title and Start new game confirm', () => {
    const html = renderToStaticMarkup(
      <TableStakePanel
        gameState={endedBlackjackTable()}
        mode="reset"
        resetSetupVariant="newGame"
        onConfirm={noop}
      />,
    );
    expect(html).toContain('New Game');
    expect(html).not.toContain('Reset table');
    expect(html).toContain('Start new game');
    expect(html).toContain('table-stake-panel__title');
  });

  it('resetTable variant keeps Reset table title', () => {
    const html = renderToStaticMarkup(
      <TableStakePanel
        gameState={endedBlackjackTable()}
        mode="reset"
        resetSetupVariant="resetTable"
        onConfirm={noop}
      />,
    );
    expect(html).toContain('Reset table');
    expect(html).toContain('Start new game');
  });

  it('reset action keeps table session id and clears round', () => {
    const state = endedBlackjackTable();
    const sessionId = state.session.id;
    const reset = applyTableResetSetup(state, setupInput, state.tableMeta.ownerPersonId);
    expect(reset.session.id).toBe(sessionId);
    expect(reset.tableMeta.gameStatus).toBe('active');
    expect(reset.blackjack).toBeNull();
    expect(reset.tableMeta.awaitingNextRound).toBe(false);
  });

  it('owner New Game click can open reset setup via shared handler contract', () => {
    const onBeginTableReset = vi.fn();
    const onNewGame = () => onBeginTableReset('newGame');
    onNewGame();
    expect(onBeginTableReset).toHaveBeenCalledWith('newGame');
  });

  it('ended table DealerBlock wires New Game for owner', () => {
    const onNewGame = vi.fn();
    const html = renderToStaticMarkup(
      <DealerBlock
        awaitingNextRound={false}
        gameEnded
        onNextRound={noop}
        onNewGame={onNewGame}
        canStartNewGame
        dealerCards={null}
        protocolPhase="betting"
        bankerReady
        shoeStarted={false}
        bettingOpen={false}
        canDeal={false}
        hasStakes
        onShuffleToStart={noop}
        onDealCards={noop}
        onDealNextCard={noop}
        onDrawBank={noop}
        initialDealManual={false}
        bankDrawManual={false}
      />,
    );
    expect(html).toContain('New Game');
  });
});
