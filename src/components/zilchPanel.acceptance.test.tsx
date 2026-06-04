import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ZilchPanel } from './ZilchPanel';
import {
  applyZilchTableStakeSetup,
  beginZilchPlay,
  createNewBlackjackTable,
  addVirtualPlayer,
  mergeSessionUpdate,
  DEFAULT_TABLE_CHIPS,
} from '../engine/session';
import {
  bankTurn,
  completeDiceRoll,
  confirmStarter,
  keepCombination,
  randomiseStarter,
  rollDice,
} from '../engine/zilch';

function zilchReadyState() {
  let state = createNewBlackjackTable();
  const spl = addVirtualPlayer(state.session, state.players, state.ledger, {
    displayName: 'Bot Seat',
    virtualStyle: 'normal',
  });
  state = mergeSessionUpdate(state, spl);
  state = applyZilchTableStakeSetup(state, {
    stakeDescription: 'Test',
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
  });
  return beginZilchPlay(state);
}

describe('ZilchPanel acceptance', () => {
  it('shows player score boxes with virtual marker', () => {
    const state = zilchReadyState();
    const html = renderToStaticMarkup(
      <ZilchPanel gameState={state} onGameStateChange={() => {}} />,
    );
    expect(html).toContain('Bot Seat');
    expect(html).toContain('Virtual');
    expect(html).toContain('zilch-seat');
    expect(html).toContain('Total:');
  });

  it('markup includes dice table and roll button', () => {
    let state = zilchReadyState();
    let zilch = confirmStarter(randomiseStarter(state.zilch!, () => 0));
    state = { ...state, zilch };
    const html = renderToStaticMarkup(
      <ZilchPanel gameState={state} onGameStateChange={() => {}} />,
    );
    expect(html).toContain('zilch-table');
    expect(html).toContain('Dice');
  });

  it('banking adds turn score to total', () => {
    let zilch = confirmStarter(randomiseStarter(zilchReadyState().zilch!, () => 0));
    const pid = zilch.currentPlayerId!;
    zilch = {
      ...zilch,
      phase: 'player-turn',
      turnScore: 12,
      keptThisRoll: true,
      totalScoresByPlayerId: { ...zilch.totalScoresByPlayerId, [pid]: 5 },
    };
    zilch = bankTurn(zilch);
    expect(zilch.totalScoresByPlayerId[pid]).toBe(17);
    expect(zilch.turnScore).toBe(0);
  });

  it('zilch roll ends turn with zero turn score', () => {
    let zilch = confirmStarter(randomiseStarter(zilchReadyState().zilch!, () => 0));
    const pid = zilch.currentPlayerId!;
    zilch = rollDice(
      {
        ...zilch,
        turnScore: 8,
      },
      zilchReadyState().zilchSettings,
      () => 0.1,
    );
    zilch = {
      ...zilch,
      dice: [
        { id: 'a', value: 2, isAvailable: true, isKept: false },
        { id: 'b', value: 3, isAvailable: true, isKept: false },
      ],
      diceAnimation: { isRolling: true, durationMs: 100, pendingValues: [2, 3] },
    };
    zilch = completeDiceRoll(zilch);
    expect(zilch.turnScore).toBe(0);
    expect(zilch.totalScoresByPlayerId[pid]).toBe(0);
  });

  it('player may choose lower scoring option', () => {
    let zilch = confirmStarter(randomiseStarter(zilchReadyState().zilch!, () => 0));
    zilch = {
      ...zilch,
      phase: 'awaiting-keep-selection',
      rollNumberInTurn: 1,
      dice: [
        { id: 'a', value: 1, isAvailable: true, isKept: false },
        { id: 'b', value: 1, isAvailable: true, isKept: false },
        { id: 'c', value: 1, isAvailable: true, isKept: false },
      ],
      availableCombinations: [
        {
          id: 'three',
          label: 'Three 1s',
          diceIds: ['a', 'b', 'c'],
          score: 10,
          type: 'three_of_a_kind',
        },
        {
          id: 'single-a',
          label: 'Single 1',
          diceIds: ['a'],
          score: 1,
          type: 'single_one',
        },
      ],
    };
    zilch = keepCombination(zilch, 'single-a');
    expect(zilch.turnScore).toBe(1);
  });

  it('cannot bank during zilch phase', () => {
    let zilch = confirmStarter(randomiseStarter(zilchReadyState().zilch!, () => 0));
    zilch = {
      ...zilch,
      phase: 'zilch',
      turnScore: 10,
      keptThisRoll: true,
    };
    expect(() => bankTurn(zilch)).toThrow();
  });
});
