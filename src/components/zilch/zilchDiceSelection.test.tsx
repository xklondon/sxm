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
import type { ZilchGameState } from '../../engine/dice/zilch';
import { ZilchDiceArea } from './ZilchDiceArea';

afterEach(() => cleanup());

function awaitingKeepState(values: number[] = [1, 2, 3, 4, 5, 6]): ZilchGameState {
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
  it('selects a valid scoring die and keeps via Keep selected dice', () => {
    const zilch = awaitingKeepState();
    const singleOne = zilch.availableCombinations.find((c) => c.type === 'single_one')!;
    const onKeepCombination = vi.fn();

    render(
      <ZilchDiceArea
        zilch={zilch}
        rolling={false}
        showValues
        animSeed={1}
        controlsDisabled={false}
        starterSpinActive={false}
        randomiserIndex={0}
        playerOrder={['p1']}
        playerNames={{ p1: 'Player 1' }}
        onKeepCombination={onKeepCombination}
      />,
    );

    const dieButton = screen.getByRole('button', { name: 'Select die 1' });
    fireEvent.click(dieButton);

    const keepBtn = screen.getByRole('button', { name: 'Keep selected dice' }) as HTMLButtonElement;
    expect(keepBtn.disabled).toBe(false);
    fireEvent.click(keepBtn);

    expect(onKeepCombination).toHaveBeenCalledWith(singleOne.id);
    expect(screen.queryByText('Select scoring dice only.')).toBeNull();
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
        starterSpinActive={false}
        randomiserIndex={0}
        playerOrder={['p1']}
        playerNames={{ p1: 'Player 1' }}
        onKeepCombination={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Die 3, not scoring' }));

    expect(screen.getByText('Select scoring dice only.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Keep selected dice' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('combination buttons still select and keep scoring sets', () => {
    const zilch = awaitingKeepState();
    const singleOne = zilch.availableCombinations.find((c) => c.type === 'single_one')!;
    const onKeepCombination = vi.fn();

    render(
      <ZilchDiceArea
        zilch={zilch}
        rolling={false}
        showValues
        animSeed={1}
        controlsDisabled={false}
        starterSpinActive={false}
        randomiserIndex={0}
        playerOrder={['p1']}
        playerNames={{ p1: 'Player 1' }}
        onKeepCombination={onKeepCombination}
      />,
    );

    const comboBtn = screen.getByRole('button', { name: /Single 1 \(100\)/ });
    fireEvent.click(comboBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Keep selected dice' }));

    expect(onKeepCombination).toHaveBeenCalledWith(singleOne.id);
  });
});
