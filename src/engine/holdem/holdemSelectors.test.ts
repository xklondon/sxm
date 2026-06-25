import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState } from '../../types';
import type { HoldemRound } from '../../types/holdem';
import { createDefaultPokerTableConfig } from '../../types/poker';
import { createNewHoldemTable } from '../session/table';
import {
  canEditHoldemBlinds,
  getHoldemActingSeatId,
  getHoldemBigBlindSeatId,
  getHoldemDealerSeatId,
  getHoldemPhase,
  getHoldemSmallBlindSeatId,
  isHoldemHandInProgress,
} from './holdemSelectors';

function baseHoldemTable(playerIds: string[] = ['p1', 'p2']): GameState {
  const state = createNewHoldemTable();
  return {
    ...state,
    session: {
      ...state.session,
      playerIds,
      dealerButtonPlayerId: playerIds[0] ?? null,
    },
    players: Object.fromEntries(
      playerIds.map((id) => [
        id,
        {
          id,
          displayName: id.toUpperCase(),
          controllerName: id.toUpperCase(),
          playerType: 'real' as const,
          role: 'person' as const,
          cardIds: [],
          currentBet: 0,
          status: 'active' as const,
          startingBalance: 500,
        },
      ]),
    ),
  };
}

function activeRound(overrides: Partial<HoldemRound> = {}): HoldemRound {
  return {
    status: 'preflop',
    bettingStreet: 'preflop',
    smallBlind: 5,
    bigBlind: 10,
    communityCardIds: [],
    pot: 15,
    currentBet: 10,
    dealerButtonPlayerId: 'p1',
    smallBlindPlayerId: 'p1',
    bigBlindPlayerId: 'p2',
    activePlayerId: 'p1',
    playerStates: {},
    actionLog: [],
    winners: [],
    resultSummary: '',
    lastRaiseSize: 10,
    ...overrides,
  };
}

describe('holdemSelectors', () => {
  it('engine setup imports PokerTableConfig from src/types/poker', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/engine/session/holdemTableSetup.ts'),
      'utf8',
    );
    expect(source).toContain("from '../../types/poker'");
    expect(source).not.toContain('games/poker');
  });

  it('canEditHoldemBlinds is true before a hand starts', () => {
    const state = {
      ...baseHoldemTable(),
      tableMeta: {
        ...baseHoldemTable().tableMeta,
        pokerConfig: createDefaultPokerTableConfig(),
      },
      holdem: null,
    };
    expect(canEditHoldemBlinds(state)).toBe(true);
    expect(isHoldemHandInProgress(state)).toBe(false);
  });

  it('canEditHoldemBlinds is false after cards are dealt / active round', () => {
    const state = {
      ...baseHoldemTable(),
      tableMeta: {
        ...baseHoldemTable().tableMeta,
        pokerConfig: createDefaultPokerTableConfig(),
      },
      holdem: activeRound(),
    };
    expect(canEditHoldemBlinds(state)).toBe(false);
    expect(isHoldemHandInProgress(state)).toBe(true);
  });

  it('dealer selector prefers active holdem round dealer over pokerConfig', () => {
    const state = {
      ...baseHoldemTable(),
      tableMeta: {
        ...baseHoldemTable().tableMeta,
        pokerConfig: createDefaultPokerTableConfig({ dealerSeatId: 'p2' }),
      },
      holdem: activeRound({ dealerButtonPlayerId: 'p1' }),
    };
    expect(getHoldemDealerSeatId(state)).toBe('p1');
  });

  it('dealer selector falls back to pokerConfig dealer before hand', () => {
    const state = {
      ...baseHoldemTable(),
      session: {
        ...baseHoldemTable().session,
        dealerButtonPlayerId: null,
      },
      tableMeta: {
        ...baseHoldemTable().tableMeta,
        pokerConfig: createDefaultPokerTableConfig({ dealerSeatId: 'p2' }),
      },
      holdem: null,
    };
    expect(getHoldemDealerSeatId(state)).toBe('p2');
  });

  it('SB/BB selectors expose round blind seats when hand is active', () => {
    const state = {
      ...baseHoldemTable(['p1', 'p2', 'p3']),
      holdem: activeRound({
        dealerButtonPlayerId: 'p3',
        smallBlindPlayerId: 'p1',
        bigBlindPlayerId: 'p2',
      }),
    };
    expect(getHoldemSmallBlindSeatId(state)).toBe('p1');
    expect(getHoldemBigBlindSeatId(state)).toBe('p2');
  });

  it('SB/BB selectors compute from dealer before hand starts (3+)', () => {
    const state = {
      ...baseHoldemTable(['p1', 'p2', 'p3']),
      tableMeta: {
        ...baseHoldemTable().tableMeta,
        pokerConfig: createDefaultPokerTableConfig({ dealerSeatId: 'p1' }),
      },
      holdem: null,
    };
    expect(getHoldemSmallBlindSeatId(state)).toBe('p2');
    expect(getHoldemBigBlindSeatId(state)).toBe('p3');
  });

  it('SB/BB selectors use heads-up rules before hand starts (dealer is SB)', () => {
    const state = {
      ...baseHoldemTable(['p1', 'p2']),
      tableMeta: {
        ...baseHoldemTable().tableMeta,
        pokerConfig: createDefaultPokerTableConfig({ dealerSeatId: 'p1' }),
      },
      holdem: null,
    };
    expect(getHoldemSmallBlindSeatId(state)).toBe('p1');
    expect(getHoldemBigBlindSeatId(state)).toBe('p2');
  });

  it('acting seat id is null between hands', () => {
    const state = baseHoldemTable();
    expect(getHoldemActingSeatId(state)).toBe(null);
  });

  it('acting seat id comes from active round', () => {
    const state = {
      ...baseHoldemTable(),
      holdem: activeRound({ activePlayerId: 'p2' }),
    };
    expect(getHoldemActingSeatId(state)).toBe('p2');
  });

  it('getHoldemPhase maps legacy round status', () => {
    expect(getHoldemPhase(baseHoldemTable())).toBe('waiting-for-players');
    expect(
      getHoldemPhase({
        ...baseHoldemTable(),
        holdem: activeRound({ status: 'resolved' }),
      }),
    ).toBe('hand-complete');
  });
});
