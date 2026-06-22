import { describe, expect, it } from 'vitest';
import { createNewZilchTable } from '../../session';
import type { GameState } from '../../../types';
import { DEFAULT_ZILCH_SETTINGS } from './settings';
import {
  advanceAfterZilchReveal,
  beginZilchReveal,
  completeDiceRoll,
  createZilchGame,
  randomiseStarter,
  rollDice,
  startTurn,
  ZILCH_REVEAL_MS,
} from './zilchEngine';
import { applyZilchActionToState } from './applyZilchAction';
import { canBank, canKeepCombination, canRollDice } from './zilchSelectors';
import { normalizeZilchState } from './normalizeZilchState';

function wrapZilch(zilch: ReturnType<typeof createZilchGame>): GameState {
  return {
    ...createNewZilchTable(),
    zilch,
    zilchSettings: DEFAULT_ZILCH_SETTINGS,
  };
}

function zilchRollNoScore() {
  let state = createZilchGame(['p1', 'p2'], DEFAULT_ZILCH_SETTINGS);
  state = randomiseStarter(state, () => 0);
  state = startTurn(state, 'p1');
  state = rollDice(state, DEFAULT_ZILCH_SETTINGS, () => 0, 1000);
  return completeDiceRoll({
    ...state,
    diceAnimation: { isRolling: true, pendingValues: [2, 3, 4, 6, 2, 3] },
  });
}

describe('Zilch reveal beat', () => {
  it('no-scoring roll enters zilch-reveal instead of immediately advancing', () => {
    const state = zilchRollNoScore();
    expect(state.phase).toBe('zilch-reveal');
    expect(state.currentPlayerId).toBe('p1');
    expect(state.turnScore).toBe(0);
    expect(state.dice).toHaveLength(6);
    expect(state.zilchRevealUntil).toBeGreaterThan(Date.now() - 50);
  });

  it('current player remains active during reveal', () => {
    const state = zilchRollNoScore();
    expect(state.currentPlayerId).toBe('p1');
    expect(state.dice.every((d) => !d.isKept)).toBe(true);
  });

  it('advanceAfterZilchReveal is idempotent before reveal timer elapses', () => {
    const revealed = zilchRollNoScore();
    const early = advanceAfterZilchReveal(revealed, 0);
    expect(early.phase).toBe('zilch-reveal');
    expect(early.currentPlayerId).toBe('p1');
  });

  it('advanceAfterZilchReveal moves to next player after reveal window', () => {
    const revealed = zilchRollNoScore();
    const next = advanceAfterZilchReveal(revealed, revealed.zilchRevealUntil ?? Date.now());
    expect(next.currentPlayerId).toBe('p2');
    expect(next.phase).toBe('player-turn');
    expect(next.dice).toHaveLength(0);
    expect(canRollDice(next)).toBe(true);
  });

  it('controls disabled during zilch-reveal', () => {
    const zilch = zilchRollNoScore();
    expect(canRollDice(zilch)).toBe(false);
    expect(canBank(zilch)).toBe(false);
    expect(canKeepCombination(zilch)).toBe(false);
  });

  it('applyZilchAction zilchAdvanceAfterReveal waits then advances once', () => {
    const revealed = zilchRollNoScore();
    const wrapped = wrapZilch(revealed);
    const early = applyZilchActionToState(wrapped, 'zilchAdvanceAfterReveal', {});
    expect(early.zilch?.currentPlayerId).toBe('p1');

    const expired = {
      ...wrapped,
      zilch: { ...revealed, zilchRevealUntil: Date.now() - 1 },
    };
    const after = applyZilchActionToState(expired, 'zilchAdvanceAfterReveal', {});
    expect(after.zilch?.currentPlayerId).toBe('p2');
    const again = applyZilchActionToState(after, 'zilchAdvanceAfterReveal', {});
    expect(again.zilch?.currentPlayerId).toBe('p2');
  });

  it('normalizeZilchState auto-advances expired zilch-reveal on hydrate', () => {
    const revealed = zilchRollNoScore();
    const hydrated = normalizeZilchState({
      ...revealed,
      zilchRevealUntil: Date.now() - 1,
    });
    expect(hydrated.currentPlayerId).toBe('p2');
    expect(hydrated.phase).toBe('player-turn');
  });

  it('beginZilchReveal keeps dice visible with reveal deadline', () => {
    const base = createZilchGame(['p1'], DEFAULT_ZILCH_SETTINGS);
    const withDice = {
      ...base,
      currentPlayerId: 'p1',
      dice: [{ id: 'd0', value: 2, isAvailable: true, isKept: false }],
      turnScore: 200,
    };
    const revealed = beginZilchReveal(withDice, 5000);
    expect(revealed.phase).toBe('zilch-reveal');
    expect(revealed.zilchRevealUntil).toBe(5000 + ZILCH_REVEAL_MS);
    expect(revealed.dice).toHaveLength(1);
    expect(revealed.turnScore).toBe(0);
  });
});
