// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
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

beforeEach(() => cleanup());

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
  return applyZilchTableStakeSetup(state, { ...zilchSetup, tableMode: 'practice', virtualPlayerCount: 1 });
}

function navigateToZilchPracticeConfigure() {
  fireEvent.click(screen.getByRole('button', { name: 'Dice' }));
  fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
}

describe('Zilch reset and new-table UI routing', () => {
  it('reset modal uses staged flow with category step', () => {
    const html = renderToStaticMarkup(
      <TableStakePanel
        gameState={zilchTableState()}
        mode="reset"
        entryPoint="reset-table"
        setupFlowKey="r1"
        onConfirm={noop}
      />,
    );
    expect(html).toContain('Reset table');
    expect(html).toContain('Game category');
    expect(html).not.toContain('Who is the bank?');
  });

  it('blackjack reset modal uses staged category step', () => {
    const state = tableAfterStartPlaying(500);
    const html = renderToStaticMarkup(
      <TableStakePanel
        gameState={state}
        mode="reset"
        entryPoint="reset-table"
        setupFlowKey="r2"
        onConfirm={noop}
      />,
    );
    expect(html).toContain('Reset table');
    expect(html).toContain('Game category');
  });

  it('resetting Zilch preserves table id with fresh setup state', () => {
    const state = zilchTableState();
    const sessionId = state.session.id;
    const reset = applyZilchTableResetSetup(state, zilchSetup, null);
    expect(reset.session.id).toBe(sessionId);
    expect(isZilchTable(reset)).toBe(true);
    expect(isBlackjackTable(reset)).toBe(false);
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

  it('new table Dice step leads directly to mode after category click', () => {
    render(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        mode="new"
        entryPoint="root"
        setupFlowKey="n1"
        onConfirm={noop}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dice' }));
    expect(screen.getByRole('button', { name: 'Practice' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('new table Dice → Zilch practice configure shows game mode fields', () => {
    render(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        mode="new"
        entryPoint="root"
        setupFlowKey="n2"
        onConfirm={noop}
      />,
    );
    navigateToZilchPracticeConfigure();
    expect(screen.getByText('Play to point goal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start Zilch' })).toBeTruthy();
    expect(screen.queryByText('Who is the bank?')).toBeNull();
  });

  it('new table Dice → Zilch confirm uses zilch payload', async () => {
    const onConfirmNewTable = vi.fn().mockResolvedValue(undefined);
    render(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        mode="new"
        entryPoint="menu-new-table"
        setupFlowKey="n3"
        onConfirm={noop}
        onConfirmNewTable={onConfirmNewTable}
      />,
    );
    navigateToZilchPracticeConfigure();
    fireEvent.click(screen.getByRole('button', { name: 'Start Zilch' }));
    expect(onConfirmNewTable).toHaveBeenCalledTimes(1);
    expect(onConfirmNewTable.mock.calls[0][0]).toMatchObject({
      zilchMode: 'target_points',
      tableMode: 'practice',
      virtualPlayerCount: 1,
    });
  });
});
