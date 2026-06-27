// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_ZILCH_SETTINGS } from '../../engine/dice/zilch/settings';
import {
  completeDiceRoll,
  createZilchGame,
  randomiseStarter,
  rollDice,
} from '../../engine/dice/zilch/zilchEngine';
import { getSelectableDiceIds } from '../../engine/dice/zilch/zilchProtocol';
import {
  ZILCH_GATHER_MS,
  ZILCH_LANDED_MS,
  ZILCH_THROW_MS,
} from './zilchDiceAnimation';
import { ZilchPlayArea } from './ZilchPlayArea';

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

describe('Zilch dice animation flow', () => {
  it('progresses throwing → landed → gather → ordered', () => {
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

  it('keeps dice visible during landed phase', () => {
    vi.useFakeTimers();
    const zilch = awaitingKeepState([1, 5, 2, 3, 4, 6]);
    render(
      <ZilchPlayArea
        zilch={zilch}
        rolling={false}
        showValues
        animSeed={3}
        controlsDisabled={false}
        onKeepSelected={vi.fn()}
        onRollDice={vi.fn()}
        onBank={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('img').length + screen.queryAllByRole('button').length).toBeGreaterThan(0);
    expect(screen.getByTestId('zilch-throw-oval').getAttribute('data-dice-ui-phase')).toBe('landed');
    vi.useRealTimers();
  });

  it('disables keep during landed and enables after ordered', () => {
    vi.useFakeTimers();
    const zilch = awaitingKeepState([1, 2, 3, 4, 6, 2]);
    render(
      <ZilchPlayArea
        zilch={zilch}
        rolling={false}
        showValues
        animSeed={4}
        controlsDisabled={false}
        onKeepSelected={vi.fn()}
        onRollDice={vi.fn()}
        onBank={vi.fn()}
      />,
    );
    expect((screen.getByRole('button', { name: 'Keep selected' }) as HTMLButtonElement).disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(ZILCH_LANDED_MS + ZILCH_GATHER_MS);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select die 1' }));
    expect((screen.getByRole('button', { name: 'Keep selected' }) as HTMLButtonElement).disabled).toBe(false);
    vi.useRealTimers();
  });

  it('uses throw duration of 1200ms constant', () => {
    expect(ZILCH_THROW_MS).toBeGreaterThanOrEqual(1000);
    expect(ZILCH_THROW_MS).toBeLessThanOrEqual(1500);
  });
});

describe('Zilch selectable dice protocol', () => {
  it('only selectable dice ids are scoring available dice', () => {
    const zilch = awaitingKeepState([1, 1, 2, 3, 4, 6]);
    const ids = getSelectableDiceIds(zilch);
    expect(ids).toHaveLength(2);
    expect(zilch.dice.filter((d) => d.value === 1).every((d) => ids.includes(d.id))).toBe(true);
    expect(zilch.dice.find((d) => d.value === 2)).toBeTruthy();
    expect(ids.includes(zilch.dice.find((d) => d.value === 2)!.id)).toBe(false);
  });
});

describe('Zilch throw area CSS contract', () => {
  it('desktop felt canvas min-height prevents clipping', () => {
    expect(ZILCH_CSS).toContain('min-height: 28rem');
    expect(ZILCH_CSS).toContain('contain: layout paint');
    expect(ZILCH_CSS).toContain('isolation: isolate');
    expect(ZILCH_CSS).toContain('overflow: hidden');
  });

  it('mobile felt canvas min-height prevents clipping', () => {
    expect(ZILCH_CSS).toMatch(/@media \(max-width: 720px\)[\s\S]*min-height: 20rem/);
  });

  it('gather transition uses translate only', () => {
    expect(ZILCH_CSS).toContain('.zilch-die__path--gathering');
    expect(ZILCH_CSS).toContain('--zilch-gather-ms');
    expect(ZILCH_CSS).toContain('transform: translate');
  });
});
