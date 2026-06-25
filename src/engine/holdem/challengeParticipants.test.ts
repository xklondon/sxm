import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import { createEmptyLedger } from '../../types/ledger';
import { createDefaultPokerTableConfig } from '../../types/poker';
import {
  ensureHoldemChallengeParticipantSnapshot,
  getHoldemChallengeParticipants,
} from './challengeParticipants';

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

function challengeState(
  seatIds: string[],
  players: GameState['players'],
  extra?: Partial<GameState['tableMeta']['pokerConfig']>,
): GameState {
  const sessionId = 'sess-participants';
  return {
    session: {
      id: sessionId,
      playerIds: seatIds,
      currentRound: 1,
      status: 'active',
      gameType: 'texas-holdem',
      dealerButtonPlayerId: seatIds[0],
      ledgerEntryIds: [],
      bankPlayerId: 'bank',
    },
    players,
    ledger: createEmptyLedger(sessionId),
    tableMeta: {
      controllerName: 'Host',
      ownerPersonId: seatIds[0],
      pokerConfig: createDefaultPokerTableConfig({
        mode: 'challenge',
        totalChallengeValue: 100,
        ...extra,
      }),
    },
  } as GameState;
}

describe('challengeParticipants', () => {
  it('1. excludes bank and box ids', () => {
    const state = challengeState(
      ['host', 'box1', 'bank', 'p2'],
      {
        host: personPlayer('host', 'Host'),
        p2: personPlayer('p2', 'P2'),
        box1: {
          ...personPlayer('box1', 'Box 1'),
          role: 'box',
          bankrollOwnerId: 'host',
        },
        bank: {
          id: 'bank',
          displayName: 'Bank Bot',
          controllerName: 'Bank Bot',
          playerType: 'virtual',
          role: 'bank',
          cardIds: [],
          currentBet: 0,
          status: 'active',
          startingBalance: 500,
        },
      },
    );

    const participants = getHoldemChallengeParticipants(state);
    expect(participants.map((p) => p.seatId)).toEqual(['host', 'p2']);
  });

  it('2. excludes empty seats (not in session.playerIds)', () => {
    const state = challengeState(['host', 'p2'], {
      host: personPlayer('host', 'Host'),
      p2: personPlayer('p2', 'P2'),
      orphan: personPlayer('orphan', 'Orphan'),
    });

    expect(getHoldemChallengeParticipants(state).map((p) => p.seatId)).toEqual(['host', 'p2']);
  });

  it('3. excludes virtual practice players', () => {
    const state = challengeState(['host', 'bot'], {
      host: personPlayer('host', 'Host'),
      bot: {
        ...personPlayer('bot', 'Virtual 2'),
        playerType: 'virtual',
        virtualStyle: 'normal',
      },
    });

    expect(getHoldemChallengeParticipants(state).map((p) => p.seatId)).toEqual(['host']);
  });

  it('4. snapshot persists eliminated players', () => {
    let state = challengeState(['host', 'p2', 'p3'], {
      host: personPlayer('host', 'Host'),
      p2: personPlayer('p2', 'P2'),
      p3: personPlayer('p3', 'P3'),
    });
    state = ensureHoldemChallengeParticipantSnapshot(state);
    expect(state.tableMeta.pokerConfig?.challengeParticipants).toHaveLength(3);
    expect(state.tableMeta.pokerConfig?.challengeParticipantSeatIds).toEqual(['host', 'p2', 'p3']);
  });

  it('5. snapshot does not change after elimination', () => {
    let state = challengeState(['host', 'p2'], {
      host: personPlayer('host', 'Host'),
      p2: personPlayer('p2', 'P2'),
    });
    state = ensureHoldemChallengeParticipantSnapshot(state);
    const before = state.tableMeta.pokerConfig?.challengeParticipants;

    state = {
      ...state,
      session: { ...state.session, playerIds: ['host'] },
      tableMeta: {
        ...state.tableMeta,
        pokerConfig: {
          ...state.tableMeta.pokerConfig!,
          challengeParticipants: before,
        },
      },
    };

    const afterSnapshot = ensureHoldemChallengeParticipantSnapshot(state);
    expect(afterSnapshot.tableMeta.pokerConfig?.challengeParticipants).toEqual(before);
    expect(getHoldemChallengeParticipants(afterSnapshot)).toHaveLength(2);
  });
});
