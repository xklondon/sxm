import { describe, expect, it } from 'vitest';
import { createNewHoldemTable } from '../session/table';
import { ensureHoldemChallengeParticipantSnapshot } from './challengeParticipants';
import {
  HOLDEM_CHALLENGE_JOIN_BLOCKED_MESSAGE,
  isHoldemChallengeJoinLocked,
} from './holdemChallengeJoin';

function personPlayer(id: string, name: string) {
  return {
    id,
    displayName: name,
    controllerName: name,
    playerType: 'real' as const,
    role: 'person' as const,
    cardIds: [],
    currentBet: 0,
    status: 'active' as const,
    startingBalance: 500,
  };
}

describe('holdemChallengeJoin', () => {
  it('practice tables are never join-locked', () => {
    const state = {
      ...createNewHoldemTable(),
      tableMeta: {
        ...createNewHoldemTable().tableMeta,
        pokerConfig: {
          ...createNewHoldemTable().tableMeta.pokerConfig!,
          mode: 'practice' as const,
        },
      },
      holdem: {
        status: 'preflop' as const,
        bettingStreet: 'preflop' as const,
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
      },
    };
    expect(isHoldemChallengeJoinLocked(state)).toBe(false);
  });

  it('joining before first hand is allowed', () => {
    const state = createNewHoldemTable();
    const configured = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        pokerConfig: {
          ...state.tableMeta.pokerConfig!,
          mode: 'challenge' as const,
          totalChallengeValue: 100,
        },
      },
    };
    expect(isHoldemChallengeJoinLocked(configured)).toBe(false);
  });

  it('joining after participant snapshot is blocked', () => {
    const base = createNewHoldemTable();
    const state = ensureHoldemChallengeParticipantSnapshot({
      ...base,
      session: { ...base.session, playerIds: ['host', 'guest'] },
      players: {
        host: personPlayer('host', 'Host'),
        guest: personPlayer('guest', 'Guest'),
      },
      tableMeta: {
        ...base.tableMeta,
        pokerConfig: {
          ...base.tableMeta.pokerConfig!,
          mode: 'challenge',
          totalChallengeValue: 100,
        },
      },
    });
    expect(isHoldemChallengeJoinLocked(state)).toBe(true);
    expect(HOLDEM_CHALLENGE_JOIN_BLOCKED_MESSAGE).toMatch(/already started/i);
  });
});
