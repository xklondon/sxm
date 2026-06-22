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
import { listPlayableZilchPlayerIds } from '../dice/zilch/zilchTurnAuthority';

describe('tableKind', () => {
  it('explicit blackjack tableGame wins over stale dice meta', () => {
    const bj = createNewBlackjackTable();
    const hybrid = {
      ...bj,
      tableMeta: {
        ...bj.tableMeta,
        gameCategory: 'dice' as const,
        diceGame: 'zilch' as const,
      },
    };
    expect(isZilchTable(hybrid)).toBe(false);
    expect(isBlackjackTable(hybrid)).toBe(true);
  });

  it('ensureZilchTableIdentity sets tableGame and session.gameType for zilch tables', () => {
    const z = createNewZilchTable();
    const next = ensureZilchTableIdentity({
      ...z,
      tableGame: 'zilch',
      session: { ...z.session, gameType: 'blackjack' },
      tableMeta: { ...z.tableMeta, gameCategory: 'dice', diceGame: 'zilch' },
    });
    expect(next.tableGame).toBe('zilch');
    expect(next.session.gameType).toBe('zilch');
    expect(next.tableMeta.diceGame).toBe('zilch');
  });

  it('ensureZilchTableIdentity does not override explicit blackjack identity', () => {
    const z = createNewZilchTable();
    const next = ensureZilchTableIdentity({
      ...z,
      tableGame: 'blackjack',
      session: { ...z.session, gameType: 'blackjack' },
    });
    expect(next.tableGame).toBe('blackjack');
    expect(next.session.gameType).toBe('blackjack');
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

  it('practice zilch stake setup sets canonical dice identity and host plus virtuals', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), {
      stakeDescription: 'Practice',
      seatChips: DEFAULT_TABLE_CHIPS,
      bankChips: DEFAULT_TABLE_CHIPS,
      bankerMode: 'bot',
      bankerName: '',
      controllerName: 'xk',
      controllerEmail: '',
      protocolId: 'zilch',
      naturalDealing: false,
      dealSpeedPreset: 'normal',
      cardTimerPreset: 0,
      bankDrawAuto: true,
      tableMode: 'practice',
      virtualPlayerCount: 2,
      zilchMode: 'target_points',
      targetPoints: 1000,
      roundLimit: 10,
      diceAnimationMode: 'fixed',
      diceAnimationMs: 400,
      diceAnimationRandomMinMs: 400,
      diceAnimationRandomMaxMs: 400,
    });
    expect(state.tableMeta.gameCategory).toBe('dice');
    expect(state.tableMeta.diceGame).toBe('zilch');
    expect(state.tableMeta.tableMode).toBe('practice');
    expect(state.tableGame).toBe('zilch');
    expect(state.session.gameType).toBe('zilch');
    expect(listPlayableZilchPlayerIds(state)).toHaveLength(3);
    expect(state.zilch?.players).toHaveLength(3);
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
