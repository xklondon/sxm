// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_ZILCH_SETTINGS } from '../../engine/dice/zilch/settings';
import {
  bankTurn,
  completeDiceRoll,
  createZilchGame,
  holdSelectedDice,
  holdScoringDice,
  randomiseStarter,
  rollDice,
  startTurn,
} from '../../engine/dice/zilch/zilchEngine';
import {
  canKeepSelectedDice,
} from '../../engine/dice/zilch/zilchSelectors';
import {
  isValidKeep,
  resolveKeepForSelectedDice,
  scoreSelectedDice,
} from '../../engine/dice/zilch/zilchProtocol';
import { canRollAvailableDice } from '../../engine/dice/zilch/zilchSelectors';
import {
  applyZilchTableStakeSetup,
  beginZilchPlay,
  createNewZilchTable,
  DEFAULT_TABLE_CHIPS,
} from '../../engine/session';
import { ZilchPlayArea } from './ZilchPlayArea';
import { ZilchPanel } from './ZilchPanel';
import { ZILCH_GATHER_MS, ZILCH_LANDED_MS } from './zilchDiceAnimation';

const ZILCH_CSS = readFileSync(join(process.cwd(), 'src/styles/zilch-table.css'), 'utf8');

afterEach(() => cleanup());

function awaitingKeepState(values: number[] = [1, 1, 2, 3, 4, 6]) {
  let state = createZilchGame(['p1'], DEFAULT_ZILCH_SETTINGS);
  state = randomiseStarter(state, () => 0);
  state = rollDice(state, DEFAULT_ZILCH_SETTINGS, () => 0, 400);
  state = {
    ...state,
    diceAnimation: { isRolling: true, pendingValues: values },
  };
  return completeDiceRoll(state);
}

describe('Zilch reference layout', () => {
  it('uses oval felt throw area with gold rim', () => {
    expect(ZILCH_CSS).toContain('.zilch-table__throw-oval');
    expect(ZILCH_CSS).toContain('border-radius: 50%');
    expect(ZILCH_CSS).toContain('rgb(212 175 55');
  });

  it('renders dice inside throw oval', () => {
    const zilch = awaitingKeepState();
    const html = renderToStaticMarkup(
      <ZilchPlayArea
        zilch={zilch}
        rolling={false}
        showValues
        animSeed={1}
        controlsDisabled={false}
        onKeepSelected={vi.fn()}
        onRollDice={vi.fn()}
        onBank={vi.fn()}
      />,
    );
    expect(html).toContain('data-testid="zilch-throw-oval"');
    expect(html).toContain('zilch-die-face');
  });

  it('does not show red not-your-turn banner during normal play', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), practiceSetup());
    state = beginZilchPlay(state);
    state = {
      ...state,
      zilch: {
        ...state.zilch!,
        phase: 'player-turn',
        currentPlayerId: state.session.playerIds[1] ?? state.session.playerIds[0]!,
      },
    };
    const html = renderToStaticMarkup(
      <ZilchPanel gameState={state} onGameStateChange={() => {}} />,
    );
    expect(html).not.toContain('zilch-panel__banner');
    expect(html).not.toContain('Not your turn');
    expect(html).not.toContain('Waiting for another player');
  });

  it('does not render duplicate select-scoring banner or combo pills', () => {
    const zilch = awaitingKeepState();
    render(
      <ZilchPlayArea
        zilch={zilch}
        rolling={false}
        showValues
        animSeed={1}
        controlsDisabled={false}
        onKeepSelected={vi.fn()}
        onRollDice={vi.fn()}
        onBank={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Select scoring dice/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Single 1/i })).toBeNull();
  });

  it('uses compact Roll Dice / Keep selected / Bank controls', () => {
    const zilch = awaitingKeepState();
    render(
      <ZilchPlayArea
        zilch={zilch}
        rolling={false}
        showValues
        animSeed={1}
        controlsDisabled={false}
        onKeepSelected={vi.fn()}
        onRollDice={vi.fn()}
        onBank={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Roll Dice' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep selected' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bank' })).toBeTruthy();
    expect(ZILCH_CSS).toContain('.zilch-table__control-row');
    expect(ZILCH_CSS).toContain('width: 6.75rem');
  });

  it('progresses dice UI phases landed → gather → ordered', () => {
    vi.useFakeTimers();
    const zilch = awaitingKeepState();
    render(
      <ZilchPlayArea
        zilch={zilch}
        rolling={false}
        showValues
        animSeed={2}
        controlsDisabled={false}
        onKeepSelected={vi.fn()}
        onRollDice={vi.fn()}
        onBank={vi.fn()}
      />,
    );
    const oval = screen.getByTestId('zilch-throw-oval');
    expect(oval.getAttribute('data-dice-ui-phase')).toBe('landed');
    act(() => {
      vi.advanceTimersByTime(ZILCH_LANDED_MS);
    });
    expect(oval.getAttribute('data-dice-ui-phase')).toBe('gather');
    act(() => {
      vi.advanceTimersByTime(ZILCH_GATHER_MS);
    });
    expect(oval.getAttribute('data-dice-ui-phase')).toBe('ordered');
    vi.useRealTimers();
  });
});

describe('Zilch protocol selection', () => {
  it('allows selecting both ones on a roll with two 1s', () => {
    const zilch = awaitingKeepState([1, 1, 2, 3, 4, 6]);
    const ones = zilch.dice.filter((d) => d.value === 1).map((d) => d.id);
    expect(canKeepSelectedDice(zilch, ones)).toBe(true);
    expect(isValidKeep(zilch.dice, ones)).toBe(true);
    expect(scoreSelectedDice(zilch.dice, ones)).toBe(200);
  });

  it('scores two ones correctly when kept', () => {
    let state = awaitingKeepState([1, 1, 2, 3, 4, 6]);
    const ones = state.dice.filter((d) => d.value === 1).map((d) => d.id);
    state = holdSelectedDice(state, ones);
    expect(state.turnScore).toBe(200);
    expect(state.dice.filter((d) => d.isKept)).toHaveLength(2);
  });

  it('allows selecting 1 and 5 together', () => {
    const zilch = awaitingKeepState([1, 5, 2, 3, 4, 6]);
    const ids = [
      zilch.dice.find((d) => d.value === 1)!.id,
      zilch.dice.find((d) => d.value === 5)!.id,
    ];
    expect(canKeepSelectedDice(zilch, ids)).toBe(true);
    expect(scoreSelectedDice(zilch.dice, ids)).toBe(150);
  });

  it('rejects non-scoring dice selection', () => {
    const zilch = awaitingKeepState([1, 2, 3, 4, 6, 2]);
    const bad = zilch.dice.find((d) => d.value === 3)!.id;
    expect(canKeepSelectedDice(zilch, [bad])).toBe(false);
  });

  it('kept dice cannot be selected again', () => {
    let state = awaitingKeepState([1, 2, 3, 4, 6, 2]);
    const oneId = state.dice.find((d) => d.value === 1)!.id;
    state = holdScoringDice(state, state.availableCombinations.find((c) => c.type === 'single_one')!.id);
    expect(state.dice.find((d) => d.id === oneId)?.isKept).toBe(true);
    expect(resolveKeepForSelectedDice(state.dice, [oneId])).toBeNull();
  });

  it('three 1s can be kept as three-of-a-kind', () => {
    const zilch = awaitingKeepState([1, 1, 1, 2, 3, 4]);
    const ones = zilch.dice.filter((d) => d.value === 1).map((d) => d.id);
    const combo = resolveKeepForSelectedDice(zilch.dice, ones);
    expect(combo?.score).toBe(1000);
  });

  it('one or two 1s can be kept as lower scoring singles', () => {
    const zilch = awaitingKeepState([1, 1, 1, 2, 3, 4]);
    const ones = zilch.dice.filter((d) => d.value === 1).map((d) => d.id);
    expect(scoreSelectedDice(zilch.dice, [ones[0]!])).toBe(100);
    expect(scoreSelectedDice(zilch.dice, ones.slice(0, 2))).toBe(200);
  });
});

describe('Zilch play flow', () => {
  it('keep selected then roll remaining dice only', () => {
    let state = awaitingKeepState([1, 2, 3, 4, 6, 2]);
    const oneId = state.dice.find((d) => d.value === 1)!.id;
    state = holdSelectedDice(state, [oneId]);
    expect(state.dice.filter((d) => !d.isKept).length).toBe(5);
    expect(canRollAvailableDice(state)).toBe(true);
    state = rollDice(state, DEFAULT_ZILCH_SETTINGS, () => 0.5, 500);
    expect(state.diceAnimation.pendingValues?.length).toBe(5);
  });

  it('bank advances to next player', () => {
    let state = createZilchGame(['p1', 'p2'], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, 'p1');
    state = { ...state, turnScore: 200, keptThisRoll: true };
    state = bankTurn(state);
    expect(state.currentPlayerId).toBe('p2');
  });

  it('UI selects two ones after ordered phase and keeps them', () => {
    vi.useFakeTimers();
    const zilch = awaitingKeepState([1, 1, 2, 3, 4, 6]);
    const onKeep = vi.fn();
    render(
      <ZilchPlayArea
        zilch={zilch}
        rolling={false}
        showValues
        animSeed={3}
        controlsDisabled={false}
        onKeepSelected={onKeep}
        onRollDice={vi.fn()}
        onBank={vi.fn()}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(ZILCH_LANDED_MS + ZILCH_GATHER_MS);
    });
    const selectButtons = screen.getAllByRole('button', { name: 'Select die 1' });
    fireEvent.click(selectButtons[0]!);
    fireEvent.click(selectButtons[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Keep selected' }));
    const ones = zilch.dice.filter((d) => d.value === 1).map((d) => d.id);
    expect(onKeep).toHaveBeenCalledWith(ones);
    vi.useRealTimers();
  });

  it('no legacy ZilchActions component path', () => {
    expect(ZILCH_CSS).not.toContain('.zilch-table__combo-btn');
    expect(ZILCH_CSS).not.toContain('.zilch-panel__banner');
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/zilch/ZilchPanel.tsx'), 'utf8');
    expect(panelSrc).not.toContain('ZilchActions');
    expect(panelSrc).not.toContain('ZilchCommand');
  });
});

function practiceSetup() {
  return {
    stakeDescription: 'Practice',
    seatChips: DEFAULT_TABLE_CHIPS,
    bankChips: DEFAULT_TABLE_CHIPS,
    bankerMode: 'bot' as const,
    bankerName: '',
    controllerName: 'Host',
    controllerEmail: '',
    protocolId: 'zilch',
    naturalDealing: false,
    dealSpeedPreset: 'normal' as const,
    cardTimerPreset: 0 as const,
    bankDrawAuto: true,
    tableMode: 'practice' as const,
    virtualPlayerCount: 2,
    zilchMode: 'target_points' as const,
    targetPoints: 1000,
    roundLimit: 10,
    diceAnimationMode: 'fixed' as const,
    diceAnimationMs: 400,
    diceAnimationRandomMinMs: 400,
    diceAnimationRandomMaxMs: 400,
  };
}
