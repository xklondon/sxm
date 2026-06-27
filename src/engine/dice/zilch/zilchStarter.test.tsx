import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyZilchActionToState,
  canRollDice,
  createZilchGame,
  normalizeZilchState,
  randomiseStarter,
} from './index';
import { DEFAULT_ZILCH_SETTINGS } from './settings';
import { normalizeLoadedGameState, ensureZilchTableIdentity } from '../../session/zilchTableKind';
import { createNewBlackjackTable } from '../../session/table';
import { ZilchPanel } from '../../../components/ZilchPanel';

const P1 = 'player-1';
const P2 = 'player-2';

describe('Zilch starter randomiser', () => {
  it('randomiseStarter immediately enters player-turn with starter and current player', () => {
    const next = randomiseStarter(createZilchGame([P1, P2], DEFAULT_ZILCH_SETTINGS), () => 0);
    expect(next.phase).toBe('player-turn');
    expect(next.starterPlayerId).toBe(P1);
    expect(next.currentPlayerId).toBe(P1);
    expect(next.turnScore).toBe(0);
    expect(next.rollNumberInTurn).toBe(0);
    expect(next.keptDice).toEqual([]);
    expect(next.availableCombinations).toEqual([]);
    expect(next.diceAnimation.isRolling).toBe(false);
    expect(canRollDice(next)).toBe(true);
  });

  it('applyZilchAction zilchRandomiseStarter enables Dice for current player', () => {
    let state = createNewBlackjackTable();
    state = {
      ...state,
      zilch: createZilchGame([P1, P2], DEFAULT_ZILCH_SETTINGS),
      zilchSettings: DEFAULT_ZILCH_SETTINGS,
    };
    const next = applyZilchActionToState(state, 'zilchRandomiseStarter', {});
    expect(next.zilch?.phase).toBe('player-turn');
    expect(next.zilch?.currentPlayerId).toBeTruthy();
    expect(canRollDice(next.zilch!)).toBe(true);
  });

  it('normalizeZilchState repairs stuck randomising-starter on reload', () => {
    const stuck = {
      ...createZilchGame([P1, P2], DEFAULT_ZILCH_SETTINGS),
      phase: 'randomising-starter' as const,
      starterPlayerId: P2,
      currentPlayerId: null,
      diceAnimation: { isRolling: true },
    };
    const fixed = normalizeZilchState(stuck);
    expect(fixed.phase).toBe('player-turn');
    expect(fixed.currentPlayerId).toBe(P2);
    expect(fixed.diceAnimation.isRolling).toBe(false);
  });

  it('normalizeZilchState resets randomising-starter without starter to setup', () => {
    const stuck = {
      ...createZilchGame([P1, P2], DEFAULT_ZILCH_SETTINGS),
      phase: 'randomising-starter' as const,
      starterPlayerId: null,
      currentPlayerId: null,
    };
    const fixed = normalizeZilchState(stuck);
    expect(fixed.phase).toBe('setup');
    expect(fixed.starterPlayerId).toBeNull();
  });

  it('normalizeLoadedGameState does not leave randomising-starter after reload', () => {
    const zilch = {
      ...createZilchGame([P1, P2], DEFAULT_ZILCH_SETTINGS),
      phase: 'randomising-starter' as const,
      starterPlayerId: P1,
      currentPlayerId: null,
    };
    const base = {
      ...createNewBlackjackTable(),
      tableGame: 'zilch' as const,
      tableMeta: {
        ...createNewBlackjackTable().tableMeta,
        gameCategory: 'dice' as const,
        diceGame: 'zilch' as const,
      },
      zilch,
      zilchSettings: DEFAULT_ZILCH_SETTINGS,
    };
    const expectedZilch = normalizeZilchState(zilch);
    expect(expectedZilch.phase).toBe('player-turn');
    const withIdentity = ensureZilchTableIdentity(base);
    const loaded = normalizeLoadedGameState(base);
    expect(loaded.zilch?.phase).toBe('player-turn');
  });

  it('ZilchPanel markup shows Roll button after randomiseStarter', () => {
    let state = createNewBlackjackTable();
    state = {
      ...state,
      tableGame: 'zilch',
      zilch: randomiseStarter(createZilchGame([P1, P2], DEFAULT_ZILCH_SETTINGS), () => 0),
      zilchSettings: DEFAULT_ZILCH_SETTINGS,
      players: {
        [P1]: {
          id: P1,
          displayName: 'Alice',
          playerType: 'real',
          startingBalance: 0,
          controllerName: 'Alice',
          role: 'person',
        },
        [P2]: {
          id: P2,
          displayName: 'Bob',
          playerType: 'real',
          startingBalance: 0,
          controllerName: 'Bob',
          role: 'person',
        },
      },
      session: { ...state.session, playerIds: [P1, P2], gameType: 'zilch' },
    };
    const html = renderToStaticMarkup(
      <ZilchPanel gameState={state} onGameStateChange={() => {}} />,
    );
    expect(html).toContain('Roll');
    expect(html).toContain('Press Roll Dice to throw');
  });

  it('can re-run randomiseStarter from stuck randomising-starter phase', () => {
    const stuck = {
      ...createZilchGame([P1, P2], DEFAULT_ZILCH_SETTINGS),
      phase: 'randomising-starter' as const,
      starterPlayerId: P1,
      currentPlayerId: null,
    };
    const next = randomiseStarter(stuck, () => 0.99);
    expect(next.phase).toBe('player-turn');
    expect(next.starterPlayerId).toBe(P2);
  });
});
