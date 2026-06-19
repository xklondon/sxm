// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableStakePanel } from './TableStakePanel';
import { TableScreen } from '../screens/TableScreen';
import {
  applyZilchTableResetSetup,
  applyZilchTableStakeSetup,
  createNewBlackjackTable,
  createNewZilchTable,
  addVirtualPlayer,
  mergeSessionUpdate,
  DEFAULT_TABLE_CHIPS,
  isBlackjackTable,
  isZilchTable,
} from '../engine/session';
import { tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';
import type { ZilchTableStakeSetupInput } from '../engine/session/zilchTableSetup';

const noop = () => {};

const zilchSetup: ZilchTableStakeSetupInput = {
  stakeDescription: 'Dinner',
  seatChips: DEFAULT_TABLE_CHIPS,
  bankChips: DEFAULT_TABLE_CHIPS,
  bankerMode: 'bot',
  bankerName: '',
  controllerName: 'Host',
  controllerEmail: '',
  protocolId: 'zilch',
  naturalDealing: false,
  dealSpeedPreset: 'normal',
  cardTimerPreset: 0,
  bankDrawAuto: true,
  zilchMode: 'target_points',
  targetPoints: 100,
  roundLimit: 10,
  diceAnimationMode: 'fixed',
  diceAnimationMs: 400,
  diceAnimationRandomMinMs: 400,
  diceAnimationRandomMaxMs: 400,
};

function zilchTableState() {
  let state = createNewZilchTable();
  const spl = addVirtualPlayer(state.session, state.players, state.ledger, {
    displayName: 'Bot Seat',
    virtualStyle: 'normal',
  });
  state = mergeSessionUpdate(state, spl);
  return applyZilchTableStakeSetup(state, zilchSetup);
}

describe('Zilch reset and new-table UI routing', () => {
  it('reset modal on Zilch table shows Zilch settings, not Blackjack bank/protocol', () => {
    const html = renderToStaticMarkup(
      <TableStakePanel gameState={zilchTableState()} mode="reset" onConfirm={noop} />,
    );
    expect(html).toContain('Reset Zilch table');
    expect(html).toContain('Play to point goal');
    expect(html).toContain('Dice animation');
    expect(html).toContain('Start Zilch');
    expect(html).not.toContain('Who is the bank?');
    expect(html).not.toContain('Starting chips bank');
    expect(html).not.toContain('Las Vegas');
    expect(html).not.toContain('Rule protocol');
    expect(html).not.toContain('Game category');
  });

  it('blackjack reset modal still shows blackjack settings', () => {
    const state = tableAfterStartPlaying(500);
    const html = renderToStaticMarkup(
      <TableStakePanel gameState={state} mode="reset" onConfirm={noop} />,
    );
    expect(html).toContain('Reset table');
    expect(html).toContain('Who is the bank?');
    expect(html).toContain('Start new game');
    expect(html).not.toContain('Reset Zilch table');
  });

  it('resetting Zilch preserves Zilch identity', () => {
    const state = zilchTableState();
    const sessionId = state.session.id;
    const reset = applyZilchTableResetSetup(state, zilchSetup, null);
    expect(reset.session.id).toBe(sessionId);
    expect(isZilchTable(reset)).toBe(true);
    expect(isBlackjackTable(reset)).toBe(false);
    expect(reset.tableGame).toBe('zilch');
    expect(reset.zilch?.phase).toBe('setup');
  });

  it('after reset confirm TableScreen renders ZilchPanel', () => {
    let state = zilchTableState();
    state = applyZilchTableResetSetup(state, zilchSetup, null);
    const html = renderToStaticMarkup(
      <TableScreen gameState={state} onGameStateChange={noop} onLeave={noop} />,
    );
    expect(html).toContain('data-game="zilch"');
    expect(html).not.toContain('bj-casino');
  });

  it('new table Dice step shows Zilch directly without duplicate Dice selector', () => {
    render(
      <TableStakePanel gameState={createNewBlackjackTable()} mode="new" onConfirm={noop} />,
    );
    fireEvent.click(screen.getAllByRole('tab', { name: 'Dice' })[0]!);
    expect(screen.getByRole('button', { name: 'Configure Zilch' })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    cleanup();
  });

  it('new table Dice → Zilch configure shows game mode fields', () => {
    render(
      <TableStakePanel gameState={createNewBlackjackTable()} mode="new" onConfirm={noop} />,
    );
    fireEvent.click(screen.getAllByRole('tab', { name: 'Dice' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Configure Zilch' }));
    expect(screen.getByText('Play to point goal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start Zilch' })).toBeTruthy();
    expect(screen.queryByText('Who is the bank?')).toBeNull();
    cleanup();
  });

  it('new table Dice → Zilch confirm uses zilch payload', async () => {
    const onConfirmNewTable = vi.fn().mockResolvedValue(undefined);
    render(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        mode="new"
        onConfirm={noop}
        onConfirmNewTable={onConfirmNewTable}
      />,
    );
    fireEvent.click(screen.getAllByRole('tab', { name: 'Dice' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Configure Zilch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Zilch' }));
    expect(onConfirmNewTable).toHaveBeenCalledTimes(1);
    expect(onConfirmNewTable.mock.calls[0][0]).toMatchObject({ zilchMode: 'target_points' });
    cleanup();
  });
});
