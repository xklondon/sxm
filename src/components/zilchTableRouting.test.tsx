import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableScreen } from '../screens/TableScreen';
import {
  applyZilchTableStakeSetup,
  createNewBlackjackTable,
  DEFAULT_TABLE_CHIPS,
  isBlackjackTable,
  isZilchTable,
  normalizeLoadedGameState,
} from '../engine/session';

const noop = () => {};

describe('Zilch table routing', () => {
  it('stake setup produces zilch table identity', () => {
    let state = createNewBlackjackTable();
    state = applyZilchTableStakeSetup(state, {
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
      diceAnimationMs: 2500,
      diceAnimationRandomMinMs: 2000,
      diceAnimationRandomMaxMs: 8000,
    });
    expect(isZilchTable(state)).toBe(true);
    expect(isBlackjackTable(state)).toBe(false);
    expect(state.tableGame).toBe('zilch');
  });

  it('renders Zilch markup after Dice → Zilch stake setup, not Blackjack', () => {
    let state = createNewBlackjackTable();
    state = applyZilchTableStakeSetup(state, {
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
      diceAnimationMs: 2500,
      diceAnimationRandomMinMs: 2000,
      diceAnimationRandomMaxMs: 8000,
    });

    const html = renderToStaticMarkup(
      <TableScreen gameState={state} onGameStateChange={noop} onLeave={noop} />,
    );

    expect(html).toContain('data-game="zilch"');
    expect(html).not.toContain('Deal Cards');
    expect(html).not.toContain('Deal Cards');
  });

  it('explicit blackjack tableGame wins over stale dice meta on reload', () => {
    let state = normalizeLoadedGameState({
      ...createNewBlackjackTable(),
      tableGame: 'blackjack',
      tableMeta: {
        ...createNewBlackjackTable().tableMeta,
        gameCategory: 'dice',
        diceGame: 'zilch',
        showStakeSetup: false,
      },
    });

    const html = renderToStaticMarkup(
      <TableScreen gameState={state} onGameStateChange={noop} onLeave={noop} />,
    );

    expect(html).toContain('bj-casino');
    expect(html).not.toContain('data-game="zilch"');
    expect(isZilchTable(state)).toBe(false);
    expect(isBlackjackTable(state)).toBe(true);
  });
});
