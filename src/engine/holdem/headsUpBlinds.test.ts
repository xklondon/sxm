import { describe, expect, it } from 'vitest';
import type { GameSession } from '../../types/session';
import type { HoldemPlayerState } from '../../types/holdem';
import {
  getBigBlindSeat,
  getFirstPostflopActor,
  getFirstPreflopActor,
  getSmallBlindSeat,
} from './helpers';

function session(playerIds: string[], dealerId: string): GameSession {
  return {
    id: 'sess-1',
    playerIds,
    dealerButtonPlayerId: dealerId,
    currentRound: 1,
    gameType: 'texas-holdem',
    createdAt: new Date().toISOString(),
  };
}

function activePlayer(id: string): HoldemPlayerState {
  return {
    holeCardIds: [],
    actionStatus: 'active',
    playerBetsThisStreet: 0,
    playerTotalCommitted: 0,
    hasActedThisStreet: false,
  };
}

describe('heads-up blind rules', () => {
  const hu = session(['dealer', 'other'], 'dealer');

  it('2-player dealer is small blind', () => {
    expect(getSmallBlindSeat(hu, 'dealer')).toBe('dealer');
  });

  it('2-player non-dealer is big blind', () => {
    expect(getBigBlindSeat(hu, 'dealer')).toBe('other');
  });

  it('2-player preflop action starts on dealer/SB', () => {
    expect(getFirstPreflopActor(hu, 'other', 'dealer')).toBe('dealer');
  });

  it('2-player postflop action starts on BB', () => {
    const round = {
      dealerButtonPlayerId: 'dealer',
      smallBlindPlayerId: 'dealer',
      bigBlindPlayerId: 'other',
      playerStates: {
        dealer: activePlayer('dealer'),
        other: activePlayer('other'),
      },
    } as Parameters<typeof getFirstPostflopActor>[2];

    expect(getFirstPostflopActor(hu, 'dealer', round)).toBe('other');
  });

  it('3+ player blind behavior unchanged', () => {
    const three = session(['p1', 'p2', 'p3'], 'p1');
    expect(getSmallBlindSeat(three, 'p1')).toBe('p2');
    expect(getBigBlindSeat(three, 'p1')).toBe('p3');
    expect(getFirstPreflopActor(three, 'p3')).toBe('p1');
  });
});
