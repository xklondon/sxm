// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableStakePanel } from './TableStakePanel';
import { TableScreen } from '../screens/TableScreen';
import {
  applyTableResetSetup,
  applyZilchTableResetSetup,
  applyZilchTableStakeSetup,
  createNewBlackjackTable,
  createNewZilchTable,
  addVirtualPlayer,
  mergeSessionUpdate,
  DEFAULT_TABLE_CHIPS,
  isBlackjackTable,
  isZilchTable,
  normalizeLoadedGameState,
} from '../engine/session';
import {
  createFreshSetupDraft,
  goBackFromCardGame,
  prepareTableStateForSetupConfirm,
  selectCardGame,
  selectCategoryCards,
  selectCategoryDice,
  selectMode,
  goBackFromMode,
} from './tableSetupFlow';
import { validatePokerBlinds } from '../types/poker';
import type { ZilchTableStakeSetupInput } from '../engine/session/zilchTableSetup';

const noop = () => {};

const zilchSetup: ZilchTableStakeSetupInput = {
  stakeDescription: 'Practice',
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
  tableMode: 'practice',
  virtualPlayerCount: 2,
  zilchMode: 'target_points',
  targetPoints: 100,
  roundLimit: 10,
  diceAnimationMode: 'fixed',
  diceAnimationMs: 400,
  diceAnimationRandomMinMs: 400,
  diceAnimationRandomMaxMs: 400,
};

beforeEach(() => cleanup());

function clickCategory(label: 'Cards' | 'Dice') {
  fireEvent.click(screen.getByRole('button', { name: label }));
}

function clickCardGame(label: 'Blackjack' | 'Poker') {
  fireEvent.click(
    screen.getByRole('button', {
      name: label === 'Blackjack' ? 'Blackjack' : /Poker.*Texas Hold/i,
    }),
  );
}

function clickMode(label: 'Practice' | 'Challenge') {
  fireEvent.click(screen.getByRole('button', { name: label }));
}

function navigateToBlackjackPractice() {
  clickCategory('Cards');
  clickCardGame('Blackjack');
  clickMode('Practice');
}

function navigateToZilchPractice() {
  clickCategory('Dice');
  clickMode('Practice');
}

describe('canonical table setup routing', () => {
  it('root flow: Cards → Practice shows blackjack settings', () => {
    render(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        mode="new"
        entryPoint="root"
        setupFlowKey="t1"
        onConfirm={noop}
      />,
    );
    navigateToBlackjackPractice();
    expect(screen.getByText('Rule protocol')).toBeTruthy();
    expect(screen.queryByText('Play to point goal')).toBeNull();
  });

  it('root flow: Cards → Poker → Practice shows holdem settings', () => {
    render(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        mode="new"
        entryPoint="root"
        setupFlowKey="poker-practice"
        onConfirm={noop}
      />,
    );
    clickCategory('Cards');
    clickCardGame('Poker');
    clickMode('Practice');
    expect(screen.getByText('Small blind')).toBeTruthy();
    expect(screen.getByText('Big blind')).toBeTruthy();
    expect(screen.getByText('Virtual players')).toBeTruthy();
  });

  it('root flow: Cards → Poker → Challenge shows play-for-what, invites, and blinds', () => {
    render(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        mode="new"
        entryPoint="root"
        setupFlowKey="poker-challenge"
        onConfirm={noop}
      />,
    );
    clickCategory('Cards');
    clickCardGame('Poker');
    clickMode('Challenge');
    expect(screen.queryByText('Total challenge value')).toBeNull();
    expect(screen.getByText('Play for what')).toBeTruthy();
    expect(screen.getByText('Small blind')).toBeTruthy();
    expect(screen.getByText('Big blind')).toBeTruthy();
  });

  it('root flow: Dice → Practice shows zilch settings', () => {
    render(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        mode="new"
        entryPoint="root"
        setupFlowKey="t2"
        onConfirm={noop}
      />,
    );
    navigateToZilchPractice();
    expect(screen.getByText('Play to point goal')).toBeTruthy();
    expect(screen.queryByText('Rule protocol')).toBeNull();
  });

  it('menu flow: Dice → Challenge shows zilch invite settings', () => {
    render(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        mode="new"
        entryPoint="menu-new-table"
        setupFlowKey="t3"
        onConfirm={noop}
      />,
    );
    clickCategory('Dice');
    clickMode('Challenge');
    expect(screen.getByText('Invite players by email')).toBeTruthy();
  });

  it('does not show duplicate category selector after choosing Dice', () => {
    render(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        mode="new"
        entryPoint="root"
        setupFlowKey="t4"
        onConfirm={noop}
      />,
    );
    clickCategory('Dice');
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Practice' })).toBeTruthy();
  });

  it('reset from zilch to blackjack confirm renders blackjack', () => {
    let state = createNewZilchTable();
    const spl = addVirtualPlayer(state.session, state.players, state.ledger, {
      displayName: 'Bot',
      virtualStyle: 'normal',
    });
    state = mergeSessionUpdate(state, spl);
    state = applyZilchTableStakeSetup(state, zilchSetup);
    const draft = selectMode(
      selectCardGame(selectCategoryCards(createFreshSetupDraft('reset-table')), 'blackjack'),
      'practice',
    );
    const base = prepareTableStateForSetupConfirm(state, draft);
    const reset = applyTableResetSetup(
      base,
      {
        stakeDescription: 'Practice',
        seatChips: DEFAULT_TABLE_CHIPS,
        bankChips: DEFAULT_TABLE_CHIPS,
        bankerMode: 'bot',
        bankerName: '',
        controllerName: 'Host',
        controllerEmail: '',
        protocolId: 'las-vegas-house',
        naturalDealing: false,
        dealSpeedPreset: 'normal',
        cardTimerPreset: 0,
        bankDrawAuto: true,
        tableMode: 'practice',
      },
      null,
    );
    expect(isBlackjackTable(reset)).toBe(true);
    expect(isZilchTable(reset)).toBe(false);
    const html = renderToStaticMarkup(
      <TableScreen gameState={normalizeLoadedGameState(reset)} onGameStateChange={noop} onLeave={noop} />,
    );
    expect(html).toContain('bj-casino');
    expect(html).not.toContain('data-game="zilch"');
  });

  it('reset from blackjack to zilch confirm renders zilch', () => {
    let state = createNewBlackjackTable();
    const draft = selectMode(selectCategoryDice(createFreshSetupDraft('reset-table')), 'practice');
    const base = prepareTableStateForSetupConfirm(state, draft);
    const reset = applyZilchTableResetSetup(base, zilchSetup, null);
    expect(isZilchTable(reset)).toBe(true);
    expect(isBlackjackTable(reset)).toBe(false);
    const html = renderToStaticMarkup(
      <TableScreen gameState={normalizeLoadedGameState(reset)} onGameStateChange={noop} onLeave={noop} />,
    );
    expect(html).toContain('data-game="zilch"');
    expect(html).not.toContain('Deal Cards');
  });

  it('reset panel uses staged flow title', () => {
    const html = renderToStaticMarkup(
      <TableStakePanel
        gameState={createNewZilchTable()}
        mode="reset"
        entryPoint="reset-table"
        setupFlowKey="reset-1"
        onConfirm={noop}
      />,
    );
    expect(html).toContain('Reset table');
    expect(html).toContain('Game category');
    expect(html).not.toContain('Who is the bank?');
  });

  it('switching Dice then Cards clears dice game from draft', () => {
    let draft = selectCategoryDice(createFreshSetupDraft('root'));
    draft = goBackFromMode(draft);
    draft = selectCategoryCards(draft);
    draft = selectCardGame(draft, 'blackjack');
    expect(draft.diceGame).toBeNull();
    expect(draft.cardGame).toBe('blackjack');
  });

  it('switching Cards then Dice clears card game from draft', () => {
    let draft = selectCategoryCards(createFreshSetupDraft('root'));
    draft = goBackFromCardGame(draft);
    draft = selectCategoryDice(draft);
    expect(draft.cardGame).toBeNull();
    expect(draft.diceGame).toBe('zilch');
  });

  it('mode selection advances to settings on click without Continue', () => {
    render(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        mode="new"
        entryPoint="root"
        setupFlowKey="mode-1"
        onConfirm={noop}
      />,
    );
    clickCategory('Cards');
    clickCardGame('Blackjack');
    clickMode('Practice');
    expect(screen.getByText('Rule protocol')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('holdem blind validation rejects big blind <= small blind', () => {
    expect(validatePokerBlinds(10, 10)).toMatch(/greater/i);
    expect(validatePokerBlinds(20, 10)).toMatch(/greater/i);
  });
});
