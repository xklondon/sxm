import { describe, expect, it } from 'vitest';
import {
  buildIouHandoffCreateRequest,
  canOfferGameEndIou,
  resolveGameEndParties,
} from './gameEndIou';
import { tableWithClaimedBox } from '../blackjack/sanity/fixtures';

function endedChallengeState() {
  const base = tableWithClaimedBox(1);
  const bankId = base.session.bankPlayerId!;
  const ownerPersonId = base.tableMeta.ownerPersonId!;
  return {
    ...base,
    players: {
      ...base.players,
      [bankId]: { ...base.players[bankId]!, playerType: 'real' as const, controllerName: 'Bob' },
    },
    tableMeta: {
      ...base.tableMeta,
      gameStatus: 'ended' as const,
      winnerId: ownerPersonId,
      owner: {
        ownerName: 'Alice',
        ownerEmail: 'alice@example.com',
        createdAt: new Date().toISOString(),
      },
      setupInvitedEmails: ['bob@example.com'],
      invites: [
        {
          inviteId: 'inv-1',
          tableId: base.session.id,
          invitedEmail: 'bob@example.com',
          invitedName: 'Bob',
          invitedBy: 'alice@example.com',
          inviteStatus: 'accepted' as const,
          canInviteOthers: false,
          createdAt: new Date().toISOString(),
          token: 'token-1',
        },
      ],
    },
  };
}

describe('buildIouHandoffCreateRequest', () => {
  it('builds debtor/creditor emails for ended challenge tables', () => {
    const state = endedChallengeState();
    expect(resolveGameEndParties(state)).toMatchObject({
      winnerEmail: 'alice@example.com',
      loserEmail: 'bob@example.com',
    });
    expect(canOfferGameEndIou(state, 'alice@example.com')).toBe(true);
    expect(buildIouHandoffCreateRequest(state)).toMatchObject({
      debtorEmail: 'bob@example.com',
      creditorEmail: 'alice@example.com',
    });
  });
});
