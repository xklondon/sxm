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
  holdScoringDice,
  randomiseStarter,
  rollDice,
  startTurn,
} from '../../engine/dice/zilch/zilchEngine';
import {
  canInitialRollAllDice,
  canKeepSelectedDice,
  canRollAvailableDice,
} from '../../engine/dice/zilch/zilchSelectors';
import {
  applyZilchTableStakeSetup,
  beginZilchPlay,
  createNewZilchTable,
  DEFAULT_TABLE_CHIPS,
} from '../../engine/session';
import { ZilchPlayArea } from './ZilchPlayArea';
import { ZilchPanel } from './ZilchPanel';
import { ZilchStarterSpinner } from './ZilchStarterSpinner';
import { getVisibleZilchPlayers } from '../../engine/dice/zilch/zilchVisiblePlayers';

const ZILCH_CSS = readFileSync(join(process.cwd(), 'src/styles/zilch-table.css'), 'utf8');

afterEach(() => cleanup());

function awaitingKeepState(values: number[] = [1, 2, 3, 4, 6, 2]) {
  let state = createZilchGame(['p1'], DEFAULT_ZILCH_SETTINGS);
  state = randomiseStarter(state, () => 0);
  state = rollDice(state, DEFAULT_ZILCH_SETTINGS, () => 0, 400);
  state = {
    ...state,
    diceAnimation: { isRolling: true, pendingValues: values },
  };
  return completeDiceRoll(state);
}

describe('Zilch UX cleanup', () => {
  it('CSS places dice inside oval throw area within felt canvas', () => {
    expect(ZILCH_CSS).toContain('.zilch-table__felt--canvas');
    expect(ZILCH_CSS).toContain('.zilch-table__throw-oval');
    expect(ZILCH_CSS).toContain('.zilch-felt-center');
    expect(ZILCH_CSS).toContain('.zilch-starter-spinner');
  });

  it('does not render scoring combination pill buttons', () => {
    vi.useFakeTimers();
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
    expect(screen.queryByRole('button', { name: /Single 1 \(100\)/ })).toBeNull();
    vi.useRealTimers();
  });

  it('clicking valid scoring die enables Keep selected after ordered phase', () => {
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
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select die 1' }));
    const keepBtn = screen.getByRole('button', { name: 'Keep selected' }) as HTMLButtonElement;
    expect(keepBtn.disabled).toBe(false);
    vi.useRealTimers();
  });

  it('keep and roll locks dice then rolls remaining dice', () => {
    let state = createZilchGame(['p1'], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = rollDice(state, DEFAULT_ZILCH_SETTINGS, () => 0, 400);
    state = completeDiceRoll({
      ...state,
      diceAnimation: { isRolling: true, pendingValues: [1, 2, 3, 4, 6, 2] },
    });
    const combo = state.availableCombinations.find((c) => c.type === 'single_one')!;
    state = holdScoringDice(state, combo.id);
    expect(state.keptThisRoll).toBe(true);
    expect(state.dice.filter((d) => !d.isKept).length).toBe(5);
    state = rollDice(state, DEFAULT_ZILCH_SETTINGS, () => 0.5, 500);
    expect(state.diceAnimation.pendingValues?.length).toBe(5);
  });

  it('roll available dice does not roll kept dice', () => {
    let state = awaitingKeepState([1, 2, 3, 4, 6, 2]);
    const combo = state.availableCombinations.find((c) => c.type === 'single_one')!;
    state = holdScoringDice(state, combo.id);
    expect(canRollAvailableDice(state)).toBe(true);
    expect(canInitialRollAllDice(state)).toBe(false);
    const keptId = state.dice.find((d) => d.isKept)!.id;
    state = rollDice(state, DEFAULT_ZILCH_SETTINGS, () => 0, 600);
    state = completeDiceRoll({
      ...state,
      diceAnimation: { isRolling: true, pendingValues: [2, 3, 4, 5, 6] },
    });
    expect(state.dice.some((d) => d.id === keptId && d.isKept)).toBe(true);
  });

  it('bank advances to next player', () => {
    let state = createZilchGame(['p1', 'p2'], DEFAULT_ZILCH_SETTINGS);
    state = randomiseStarter(state, () => 0);
    state = startTurn(state, 'p1');
    state = { ...state, turnScore: 200, keptThisRoll: true };
    state = bankTurn(state);
    expect(state.currentPlayerId).toBe('p2');
    expect(state.turnScore).toBe(0);
  });

  it('practice reaching target shows end screen without ledger', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), practiceSetup());
    state = beginZilchPlay(state);
    state = {
      ...state,
      zilch: {
        ...state.zilch!,
        phase: 'completed',
        winnerPlayerId: state.session.playerIds[0]!,
        totalScoresByPlayerId: Object.fromEntries(
          state.session.playerIds.map((id) => [id, id === state.session.playerIds[0] ? 1000 : 400]),
        ),
      },
    };
    const html = renderToStaticMarkup(
      <ZilchPanel gameState={state} onGameStateChange={() => {}} onBeginTableReset={() => {}} />,
    );
    expect(html).toContain('zilch-end-screen');
    expect(html).toContain('Start new round');
    expect(html).not.toContain('Table ledger');
    expect(html).not.toContain('IOU');
  });

  it('randomiser renders compact central spinner arrow', () => {
    const html = renderToStaticMarkup(
      <ZilchStarterSpinner
        players={[{ playerId: 'a', name: 'A', boxLabel: null, isVirtual: true }]}
        activeIndex={0}
        spinning={false}
        starterPlayerId={null}
        disabled={false}
        onRandomiseStarter={() => {}}
      />,
    );
    expect(html).toContain('zilch-starter-spinner');
    expect(html).toContain('zilch-starter-spinner__arrow');
    expect(ZILCH_CSS).toContain('width: 5rem');
  });

  it('randomise starter button is enabled in setup and moves to player-turn', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), practiceSetup(2));
    const onChange = vi.fn();
    render(<ZilchPanel gameState={state} onGameStateChange={onChange} />);
    const btn = screen.getByRole('button', { name: 'Randomise starter' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0]![0] as typeof state;
    expect(next.zilch?.phase).toBe('player-turn');
    expect(next.zilch?.starterPlayerId).toBeTruthy();
    expect(next.zilch?.currentPlayerId).toBe(next.zilch?.starterPlayerId);
  });

  it('practice table renders host and virtual player boxes without duplicates', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), practiceSetup(2));
    state = beginZilchPlay(state);
    const visible = getVisibleZilchPlayers(state);
    expect(visible.length).toBe(3);
    const html = renderToStaticMarkup(
      <ZilchPanel gameState={state} onGameStateChange={() => {}} />,
    );
    const seatCount = (html.match(/class="zilch-seat(?![\w-])/g) ?? []).length;
    expect(seatCount).toBe(visible.length);
    expect(html).toContain('Host');
    expect(html).toContain('Virtual Player 2');
    expect(html).toContain('Virtual Player 3');
    expect(html).toContain('Player 1');
  });
});

describe('Zilch selection validation', () => {
  it('invalid manual selection cannot be kept', () => {
    const zilch = awaitingKeepState([1, 2, 3, 4, 6, 2]);
    expect(canKeepSelectedDice(zilch, [zilch.dice.find((d) => d.value === 3)!.id])).toBe(false);
  });
});

function practiceSetup(virtualPlayerCount = 2) {
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
    virtualPlayerCount,
    zilchMode: 'target_points' as const,
    targetPoints: 1000,
    roundLimit: 10,
    diceAnimationMode: 'fixed' as const,
    diceAnimationMs: 400,
    diceAnimationRandomMinMs: 400,
    diceAnimationRandomMaxMs: 400,
  };
}
