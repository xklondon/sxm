import { describe, expect, it } from 'vitest';
import { DEFAULT_ZILCH_SETTINGS } from './settings';
import { resolveDiceAnimationDurationMs } from './settings';
import {
  bankTurn,
  completeDiceRoll,
  createZilchGame,
  endTurnWithZilch,
  holdScoringDice,
  randomiseStarter,
  rollDice,
  startTurn,
} from './zilchEngine';
import type { ZilchDie } from './zilchTypes';

const P1 = 'p1';
const P2 = 'p2';

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

function dice(values: number[]): ZilchDie[] {
  return values.map((value, idx) => ({
    id: `d${idx}`,
    value,
    isAvailable: true,
    isKept: false,
  }));
}

describe('zilchEngine', () => {
  it('creates a game', () => {
    const state = createZilchGame([P1, P2], DEFAULT_ZILCH_SETTINGS);
    expect(state.protocolId).toBe('zilch');
    expect(state.phase).toBe('setup');
    expect(state.targetPoints).toBe(10_000);
    expect(state.players).toHaveLength(2);
  });

  it('hot dice clears kept dice for full re-roll', () => {
    let state = createZilchGame([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = {
      ...state,
      phase: 'awaiting-keep-selection',
      dice: dice([1, 1, 1, 5, 5, 5]),
      rollNumberInTurn: 1,
      availableCombinations: [
        {
          id: 'three-1s',
          label: 'Three 1s',
          diceIds: ['d0', 'd1', 'd2'],
          score: 1000,
          type: 'three_of_a_kind',
        },
        {
          id: 'three-5s',
          label: 'Three 5s',
          diceIds: ['d3', 'd4', 'd5'],
          score: 500,
          type: 'three_of_a_kind',
        },
      ],
    };
    state = holdScoringDice(state, 'three-1s');
    const second = state.availableCombinations.find(
      (c) => c.type === 'three_of_a_kind' && c.label.includes('5'),
    );
    expect(second).toBeDefined();
    state = holdScoringDice(state, second!.id);
    expect(state.dice).toHaveLength(0);
    expect(state.keptDice).toHaveLength(0);
    expect(state.turnScore).toBe(1500);
    expect(state.phase).toBe('player-turn');
  });

  it('zilch resets turn score only', () => {
    let state = createZilchGame([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, P1);
    state = {
      ...state,
      totalScoresByPlayerId: { [P1]: 4200 },
      turnScore: 700,
      phase: 'player-turn',
      dice: dice([2, 3, 4, 6, 2, 3]),
      availableCombinations: [],
    };
    state = endTurnWithZilch(state);
    expect(state.turnScore).toBe(0);
    expect(state.totalScoresByPlayerId[P1]).toBe(4200);
  });

  it('banks points and passes turn', () => {
    let state = createZilchGame([P1, P2], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, P1);
    state = {
      ...state,
      turnScore: 500,
      keptThisRoll: true,
    };
    state = bankTurn(state);
    expect(state.totalScoresByPlayerId[P1]).toBe(500);
    expect(state.currentPlayerId).toBe(P2);
    expect(state.turnScore).toBe(0);
  });

  it('target points final round after leader banks at target in challenge mode', () => {
    const settings = {
      ...DEFAULT_ZILCH_SETTINGS,
      mode: 'target_points' as const,
      targetPoints: 10_000,
    };
    let state = createZilchGame([P1, P2], settings, { tableMode: 'challenge' });
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, P1);
    state = {
      ...state,
      totalScoresByPlayerId: { [P1]: 9950, [P2]: 5000 },
      turnScore: 100,
      keptThisRoll: true,
    };
    state = bankTurn(state);
    expect(state.phase).toBe('final-round');
    expect(state.finalRoundStartedByPlayerId).toBe(P1);
    expect(state.playersRemainingFinalTurn).toEqual([P2]);
    expect(state.currentPlayerId).toBe(P2);
  });

  it('practice mode completes immediately when leader reaches target', () => {
    const settings = {
      ...DEFAULT_ZILCH_SETTINGS,
      targetPoints: 1000,
    };
    let state = createZilchGame([P1, P2], settings, { tableMode: 'practice' });
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, P1);
    state = {
      ...state,
      totalScoresByPlayerId: { [P1]: 950, [P2]: 400 },
      turnScore: 50,
      keptThisRoll: true,
    };
    state = bankTurn(state);
    expect(state.phase).toBe('completed');
    expect(state.winnerPlayerId).toBe(P1);
  });

  it('winner at target score when solo player banks', () => {
    const settings = {
      ...DEFAULT_ZILCH_SETTINGS,
      targetPoints: 1000,
    };
    let state = createZilchGame([P1], settings);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, P1);
    state = {
      ...state,
      totalScoresByPlayerId: { [P1]: 900 },
      turnScore: 100,
      keptThisRoll: true,
    };
    state = bankTurn(state);
    expect(state.phase).toBe('completed');
    expect(state.winnerPlayerId).toBe(P1);
  });

  it('rolls dice with seeded rng', () => {
    let state = createZilchGame([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, P1);
    state = rollDice(state, DEFAULT_ZILCH_SETTINGS, seqRng([0, 0.5, 0.99]), 1000);
    expect(state.diceAnimation.isRolling).toBe(true);
    expect(state.diceAnimation.pendingValues).toHaveLength(6);
  });

  it('completeDiceRoll reveals zilch path', () => {
    let state = createZilchGame([P1], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, P1);
    state = rollDice(state, DEFAULT_ZILCH_SETTINGS, seqRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]), 1000);
    state = {
      ...state,
      diceAnimation: {
        isRolling: true,
        pendingValues: [2, 3, 4, 6, 2, 3],
      },
      dice: dice([1, 1, 1, 1, 1, 1]),
    };
    state = completeDiceRoll(state);
    expect(state.phase).toBe('zilch-reveal');
    expect(state.turnScore).toBe(0);
    expect(state.totalScoresByPlayerId[P1]).toBe(0);
    expect(state.dice.length).toBeGreaterThan(0);
  });

  it('dice animation duration fixed and random', () => {
    const fixed = resolveDiceAnimationDurationMs({
      diceAnimationMode: 'fixed',
      diceAnimationMs: 2500,
      diceAnimationRandomMinMs: 2000,
      diceAnimationRandomMaxMs: 8000,
    });
    expect(fixed).toBe(2500);

    const rng = seqRng([0, 0.5, 1]);
    const a = resolveDiceAnimationDurationMs(
      {
        diceAnimationMode: 'random',
        diceAnimationMs: 2500,
        diceAnimationRandomMinMs: 2000,
        diceAnimationRandomMaxMs: 8000,
      },
      rng,
    );
    expect(a).toBeGreaterThanOrEqual(2000);
    expect(a).toBeLessThanOrEqual(8000);
  });
});
