import { describe, expect, it } from 'vitest';
import * as tableKindModule from './zilchTableKind';
import { createZilchGame } from '../dice/zilch';
import { DEFAULT_ZILCH_SETTINGS } from '../dice/zilch/settings';

const { normalizeLoadedGameState, repairStuckRandomisingStarter } = tableKindModule;

describe('normalizeLoadedGameState starter repair (isolated)', () => {
  it('repairs randomising-starter when zilch is present', () => {
    const zilch = {
      ...createZilchGame(['p1'], DEFAULT_ZILCH_SETTINGS),
      phase: 'randomising-starter' as const,
      starterPlayerId: 'p1',
      currentPlayerId: null,
    };
    const state = {
      tableGame: 'zilch' as const,
      session: { gameType: 'zilch' as const, id: 't1', status: 'active' as const },
      tableMeta: { gameCategory: 'dice' as const, diceGame: 'zilch' as const },
      zilch,
    };
    expect(
      state.zilch?.phase === 'randomising-starter' && state.zilch?.starterPlayerId,
    ).toBeTruthy();
    expect(typeof repairStuckRandomisingStarter).toBe('function');
    expect(repairStuckRandomisingStarter(zilch).phase).toBe('player-turn');
    const loaded = normalizeLoadedGameState(state as never);
    expect(loaded.zilch?.phase).toBe('player-turn');
  });
});
