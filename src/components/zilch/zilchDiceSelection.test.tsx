// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ZILCH_SETTINGS } from '../../engine/dice/zilch/settings';
import {
  completeDiceRoll,
  createZilchGame,
  randomiseStarter,
  rollDice,
} from '../../engine/dice/zilch/zilchEngine';
import { ZILCH_GATHER_MS, ZILCH_LANDED_MS } from './zilchDiceAnimation';
import { ZilchPlayArea } from './ZilchPlayArea';

afterEach(() => cleanup());

function awaitingKeepState(values: number[] = [1, 2, 3, 4, 5, 6]) {
  let state = createZilchGame(['p1'], DEFAULT_ZILCH_SETTINGS);
  state = randomiseStarter(state, () => 0);
  state = rollDice(state, DEFAULT_ZILCH_SETTINGS, () => 0, 400);
  state = {
    ...state,
    diceAnimation: {
      isRolling: true,
      pendingValues: values,
    },
  };
  return completeDiceRoll(state);
}

describe('Zilch manual die selection', () => {
  it('selects a valid scoring die and keeps via Keep selected', () => {
    vi.useFakeTimers();
    const zilch = awaitingKeepState([1, 2, 3, 4, 6, 2]);
    const oneId = zilch.dice.find((d) => d.value === 1)!.id;
    const onKeepSelected = vi.fn();

    render(
      <ZilchPlayArea
        zilch={zilch}
        rolling={false}
        showValues
        animSeed={1}
        controlsDisabled={false}
        onKeepSelected={onKeepSelected}
        onRollDice={vi.fn()}
        onBank={vi.fn()}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(ZILCH_LANDED_MS + ZILCH_GATHER_MS);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select die 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep selected' }));

    expect(onKeepSelected).toHaveBeenCalledWith([oneId]);
    vi.useRealTimers();
  });

  it('blocks keep when selection is invalid', () => {
    vi.useFakeTimers();
    const zilch = awaitingKeepState([1, 2, 3, 4, 6, 2]);

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

    act(() => {
      vi.advanceTimersByTime(ZILCH_LANDED_MS + ZILCH_GATHER_MS);
    });
    expect((screen.getByRole('button', { name: 'Keep selected' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    vi.useRealTimers();
  });
});
