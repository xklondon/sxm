import { describe, expect, it, vi } from 'vitest';
import type { GameState } from '../../../types';
import { createNewHoldemTable } from '../../../engine/session';
import { createDefaultPokerTableConfig } from '../../../types/poker';
import {
  buildPokerIouHandoffRequests,
  computePokerWinnerTakesAllSettlement,
  validatePokerChallengeSettlement,
} from './pokerChallengeSettlement';
import { ensureHoldemChallengeParticipantSnapshot } from '../../../engine/holdem/challengeParticipants';

function personPlayer(id: string, name: string, email?: string) {
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
    bankrollOwnerId: email ? id : undefined,
  };
}

function challengeWithParticipants(
  seatIds: string[],
  players: GameState['players'],
  totalChallengeValue: number,
  extraMeta?: Partial<GameState['tableMeta']>,
): GameState {
  const base = createNewHoldemTable();
  let state: GameState = {
    ...base,
    session: { ...base.session, playerIds: seatIds },
    players,
    tableMeta: {
      ...base.tableMeta,
      ownerPersonId: seatIds[0],
      owner: {
        ownerName: players[seatIds[0]!]?.displayName ?? 'Host',
        ownerEmail: 'winner@example.com',
        createdAt: new Date().toISOString(),
      },
      setupInvitedEmails: ['loser1@example.com', 'loser2@example.com', 'loser3@example.com'],
      pokerConfig: createDefaultPokerTableConfig({
        mode: 'challenge',
        totalChallengeValue,
        currency: '$',
        challengeStatus: 'ended',
        challengeWinnerSeatId: seatIds[0],
      }),
      ...extraMeta,
    },
  };
  state = ensureHoldemChallengeParticipantSnapshot(state);
  return state;
}

describe('pokerChallengeSettlement participants', () => {
  it('6. settlement uses participant count, not session.playerIds', () => {
    const base = createNewHoldemTable();
    const tableId = base.session.id;
    const state = ensureHoldemChallengeParticipantSnapshot({
      ...base,
      session: { ...base.session, playerIds: ['w', 'l1', 'l2', 'bank', 'box1'] },
      players: {
        w: personPlayer('w', 'Winner'),
        l1: personPlayer('l1', 'L1'),
        l2: personPlayer('l2', 'L2'),
        bank: {
          id: 'bank',
          displayName: 'Bank',
          controllerName: 'Bank',
          playerType: 'virtual',
          role: 'bank',
          cardIds: [],
          currentBet: 0,
          status: 'active',
          startingBalance: 500,
        },
        box1: { ...personPlayer('box1', 'Box'), role: 'box' },
      },
      tableMeta: {
        ...base.tableMeta,
        ownerPersonId: 'w',
        owner: {
          ownerName: 'Winner',
          ownerEmail: 'winner@example.com',
          createdAt: new Date().toISOString(),
        },
        setupInvitedEmails: ['loser1@example.com', 'loser2@example.com'],
        invites: [
          invite(tableId, 'loser1@example.com', 'L1'),
          invite(tableId, 'loser2@example.com', 'L2'),
        ],
        pokerConfig: createDefaultPokerTableConfig({
          mode: 'challenge',
          totalChallengeValue: 100,
          challengeStatus: 'ended',
          challengeWinnerSeatId: 'w',
        }),
      },
    });

    const result = validatePokerChallengeSettlement(state, 'w');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.settlement.participantCount).toBe(3);
      expect(result.settlement.stakePerParticipant).toBeCloseTo(100 / 3, 5);
      expect(result.settlement.losers).toHaveLength(2);
    }
  });

  it('7. winner must be in participant snapshot', () => {
    const state = challengeWithParticipants(
      ['w', 'l1'],
      {
        w: personPlayer('w', 'Winner'),
        l1: personPlayer('l1', 'L1'),
      },
      50,
    );

    const bad = validatePokerChallengeSettlement(state, 'outsider');
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/participant/i);
  });

  it('8. practice mode blocks settlement', () => {
    const state = createNewHoldemTable();
    const practice = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        pokerConfig: createDefaultPokerTableConfig({ mode: 'practice' }),
      },
    };
    expect(validatePokerChallengeSettlement(practice, 'p1').ok).toBe(false);
  });

  it('9. missing winner blocks settlement', () => {
    const state = challengeWithParticipants(
      ['w', 'l1'],
      { w: personPlayer('w', 'Winner'), l1: personPlayer('l1', 'L1') },
      50,
    );
    expect(validatePokerChallengeSettlement(state, null).ok).toBe(false);
  });

  it('10. missing loser identity/email blocks settlement', () => {
    const state = challengeWithParticipants(
      ['w', 'l1'],
      { w: personPlayer('w', 'Winner'), l1: personPlayer('l1', 'L1') },
      50,
    );

    const result = validatePokerChallengeSettlement(state, 'w');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Missing email/i);
    expect(result.settlement?.canSendIous).toBe(false);
  });

  it('11. four-player $100 challenge produces three loser IOUs at $25 each', () => {
    const base = createNewHoldemTable();
    const tableId = base.session.id;
    const state = ensureHoldemChallengeParticipantSnapshot({
      ...base,
      session: { ...base.session, playerIds: ['w', 'l1', 'l2', 'l3'] },
      players: {
        w: personPlayer('w', 'Winner'),
        l1: personPlayer('l1', 'L1'),
        l2: personPlayer('l2', 'L2'),
        l3: personPlayer('l3', 'L3'),
      },
      tableMeta: {
        ...base.tableMeta,
        ownerPersonId: 'w',
        owner: {
          ownerName: 'Winner',
          ownerEmail: 'winner@example.com',
          createdAt: new Date().toISOString(),
        },
        setupInvitedEmails: ['loser1@example.com', 'loser2@example.com', 'loser3@example.com'],
        invites: [
          invite(tableId, 'loser1@example.com', 'L1'),
          invite(tableId, 'loser2@example.com', 'L2'),
          invite(tableId, 'loser3@example.com', 'L3'),
        ],
        pokerConfig: createDefaultPokerTableConfig({
          mode: 'challenge',
          totalChallengeValue: 100,
          challengeStatus: 'ended',
          challengeWinnerSeatId: 'w',
        }),
      },
    });

    const settlement = computePokerWinnerTakesAllSettlement(state, 'w');
    expect(settlement?.stakePerParticipant).toBe(25);
    expect(settlement?.losers).toHaveLength(3);
    expect(settlement?.canSendIous).toBe(true);
    expect(buildPokerIouHandoffRequests(state, 'w')).toHaveLength(3);
  });

  it('IOU handoff requests include poker challenge idempotency fields', () => {
    const base = createNewHoldemTable();
    const tableId = base.session.id;
    const state = ensureHoldemChallengeParticipantSnapshot({
      ...base,
      session: { ...base.session, playerIds: ['w', 'l1', 'l2', 'l3'] },
      players: {
        w: personPlayer('w', 'Winner'),
        l1: personPlayer('l1', 'L1'),
        l2: personPlayer('l2', 'L2'),
        l3: personPlayer('l3', 'L3'),
      },
      tableMeta: {
        ...base.tableMeta,
        ownerPersonId: 'w',
        owner: {
          ownerName: 'Winner',
          ownerEmail: 'winner@example.com',
          createdAt: new Date().toISOString(),
        },
        setupInvitedEmails: ['loser1@example.com', 'loser2@example.com', 'loser3@example.com'],
        invites: [
          invite(tableId, 'loser1@example.com', 'L1'),
          invite(tableId, 'loser2@example.com', 'L2'),
          invite(tableId, 'loser3@example.com', 'L3'),
        ],
        pokerConfig: createDefaultPokerTableConfig({
          mode: 'challenge',
          totalChallengeValue: 100,
          challengeStatus: 'ended',
          challengeWinnerSeatId: 'w',
          handNumber: 4,
        }),
      },
    });
    const requests = buildPokerIouHandoffRequests(state, 'w');
    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0]).toMatchObject({
      challengeHandNumber: 4,
      settlementAmount: 25,
      sessionId: `${tableId}-poker-challenge-h4`,
      gameType: 'texas-holdem',
    });
  });

  it('12. two-player $50 challenge produces one loser IOU at $25', () => {
    const base = createNewHoldemTable();
    const tableId = base.session.id;
    const state = ensureHoldemChallengeParticipantSnapshot({
      ...base,
      session: { ...base.session, playerIds: ['w', 'l1'] },
      players: {
        w: personPlayer('w', 'Winner'),
        l1: personPlayer('l1', 'L1'),
      },
      tableMeta: {
        ...base.tableMeta,
        ownerPersonId: 'w',
        owner: {
          ownerName: 'Winner',
          ownerEmail: 'winner@example.com',
          createdAt: new Date().toISOString(),
        },
        setupInvitedEmails: ['loser1@example.com'],
        invites: [invite(tableId, 'loser1@example.com', 'L1')],
        pokerConfig: createDefaultPokerTableConfig({
          mode: 'challenge',
          totalChallengeValue: 50,
          challengeStatus: 'ended',
          challengeWinnerSeatId: 'w',
        }),
      },
    });

    const settlement = computePokerWinnerTakesAllSettlement(state, 'w');
    expect(settlement?.stakePerParticipant).toBe(25);
    expect(settlement?.losers).toHaveLength(1);
    expect(buildPokerIouHandoffRequests(state, 'w')).toHaveLength(1);
  });

  it('13. bank/box ledger rows do not create IOUs', () => {
    const base = createNewHoldemTable();
    const tableId = base.session.id;
    const state = ensureHoldemChallengeParticipantSnapshot({
      ...base,
      session: { ...base.session, playerIds: ['w', 'l1', 'bank', 'box1'] },
      players: {
        w: personPlayer('w', 'Winner'),
        l1: personPlayer('l1', 'L1'),
        bank: {
          id: 'bank',
          displayName: 'Bank',
          controllerName: 'Bank',
          playerType: 'virtual',
          role: 'bank',
          cardIds: [],
          currentBet: 0,
          status: 'active',
          startingBalance: 500,
        },
        box1: { ...personPlayer('box1', 'Box'), role: 'box' },
      },
      tableMeta: {
        ...base.tableMeta,
        ownerPersonId: 'w',
        owner: {
          ownerName: 'Winner',
          ownerEmail: 'winner@example.com',
          createdAt: new Date().toISOString(),
        },
        setupInvitedEmails: ['loser1@example.com'],
        invites: [invite(tableId, 'loser1@example.com', 'L1')],
        pokerConfig: createDefaultPokerTableConfig({
          mode: 'challenge',
          totalChallengeValue: 50,
          challengeStatus: 'ended',
          challengeWinnerSeatId: 'w',
        }),
      },
    });

    expect(buildPokerIouHandoffRequests(state, 'w')).toHaveLength(1);
  });

  it('14. failed validation sends no IOUs', async () => {
    const { sendPokerChallengeIous } = await import('./pokerGameOverFlow');
    const state = challengeWithParticipants(
      ['w', 'l1'],
      { w: personPlayer('w', 'Winner'), l1: personPlayer('l1', 'L1') },
      50,
    );

    const feedback = vi.fn();
    const ok = await sendPokerChallengeIous(state, 'w', feedback);
    expect(ok).toBe(false);
    expect(buildPokerIouHandoffRequests(state, 'w')).toHaveLength(0);
    expect(feedback).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }));
  });
});

function invite(tableId: string, email: string, name: string) {
  return {
    inviteId: `inv-${email}`,
    tableId,
    invitedEmail: email,
    invitedName: name,
    invitedBy: 'Winner',
    inviteStatus: 'pending' as const,
    canInviteOthers: false,
    createdAt: new Date().toISOString(),
    token: email,
  };
}
