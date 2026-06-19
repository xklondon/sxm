import { describe, expect, it } from 'vitest';
import { createNewBlackjackTable, createNewZilchTable } from './table';
import { createZilchGame } from '../dice/zilch';
import {
  ensureZilchTableIdentity,
  isBlackjackTable,
  isZilchTable,
  normalizeLoadedGameState,
} from './zilchTableKind';
import { applyZilchTableStakeSetup } from './zilchTableSetup';
import { DEFAULT_TABLE_CHIPS } from './table';

describe('tableKind', () => {
  it('detects zilch from tableMeta when tableGame is still blackjack', () => {
    const bj = createNewBlackjackTable();
    const hybrid = {
      ...bj,
      tableMeta: {
        ...bj.tableMeta,
        gameCategory: 'dice' as const,
        diceGame: 'zilch' as const,
      },
    };
    expect(isZilchTable(hybrid)).toBe(true);
    expect(isBlackjackTable(hybrid)).toBe(false);
  });

  it('ensureZilchTableIdentity sets tableGame and session.gameType', () => {
    const z = createNewZilchTable();
    const next = ensureZilchTableIdentity({
      ...z,
      tableGame: 'blackjack',
      session: { ...z.session, gameType: 'blackjack' },
    });
    expect(next.tableGame).toBe('zilch');
    expect(next.session.gameType).toBe('zilch');
    expect(next.tableMeta.diceGame).toBe('zilch');
  });

  it('applyZilchTableStakeSetup leaves table as zilch', () => {
    let state = createNewBlackjackTable();
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
      diceAnimationMs: 2500,
      diceAnimationRandomMinMs: 2000,
      diceAnimationRandomMaxMs: 8000,
    });
    expect(isZilchTable(state)).toBe(true);
    expect(isBlackjackTable(state)).toBe(false);
    expect(state.blackjack).toBeNull();
  });

  it('normalizeLoadedGameState repairs stuck zilch starter phase', () => {
    const z = createNewZilchTable();
    const zilch = {
      ...createZilchGame(['p1', 'p2'], z.zilchSettings),
      phase: 'randomising-starter' as const,
      starterPlayerId: 'p1',
      currentPlayerId: null,
    };
    const loaded = normalizeLoadedGameState({
      ...z,
      zilch,
    });
    expect(loaded.zilch?.phase).toBe('player-turn');
  });
});
