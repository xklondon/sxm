// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ZILCH_SETTINGS } from '../../engine/dice/zilch/settings';
import {
  completeDiceRoll,
  createZilchGame,
  randomiseStarter,
  rollDice,
} from '../../engine/dice/zilch/zilchEngine';
import { ZilchDiceArea } from './ZilchDiceArea';

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
  it('selects a valid scoring die and keeps via Keep and roll', () => {
    const zilch = awaitingKeepState([1, 2, 3, 4, 6, 2]);
    const singleOne = zilch.availableCombinations.find((c) => c.type === 'single_one')!;
    const onKeepAndRoll = vi.fn();

    render(
      <ZilchDiceArea
        zilch={zilch}
        rolling={false}
        showValues
        animSeed={1}
        controlsDisabled={false}
        onKeepAndRoll={onKeepAndRoll}
        onRollDice={vi.fn()}
        onBank={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select die 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep and roll' }));

    expect(onKeepAndRoll).toHaveBeenCalledWith(singleOne.id);
  });

  it('blocks keep when selection is invalid and shows helper text', () => {
    const zilch = awaitingKeepState([1, 2, 3, 4, 6, 2]);

    render(
      <ZilchDiceArea
        zilch={zilch}
        rolling={false}
        showValues
        animSeed={1}
        controlsDisabled={false}
        onKeepAndRoll={vi.fn()}
        onRollDice={vi.fn()}
        onBank={vi.fn()}
      />,
    );

    expect(screen.getByText('Select scoring dice to keep.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Keep and roll' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
