import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

import { createMemoryStore } from '../src/store/memoryStore.js';
import { PeopleService } from '../src/people/service.js';
import { TableService } from '../src/tables/service.js';
import { seedHostUser, seedPerson } from './testHelpers.js';
import { InviteFlowError } from '../src/people/inviteErrors.js';
import { ensureHoldemChallengeParticipantSnapshot } from '../../src/engine/holdem/challengeParticipants.js';

const HOLDEM_CHALLENGE_CONFIGURE = {
  stakeDescription: '$100 challenge',
  seatChips: 500,
  bankChips: 500,
  bankerMode: 'self' as const,
  bankerName: 'Host',
  controllerName: 'Host',
  controllerEmail: 'host@example.com',
  protocolId: 'texas-holdem',
  gameType: 'texas-holdem',
  cardGame: 'holdem',
  naturalDealing: false,
  dealSpeedPreset: 'normal' as const,
  cardTimerPreset: 0,
  bankDrawAuto: true,
  tableMode: 'challenge' as const,
  smallBlind: 5,
  bigBlind: 10,
  totalChallengeValue: 100,
};

describe('holdem challenge join policy', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let tables: TableService;

  beforeEach(() => {
    store = createMemoryStore();
    tables = new TableService(store, new PeopleService(store));
  });

  it('allows invite join before first hand starts', async () => {
    const guestUser = await store.createUser('guest@example.com', 'Guest');
    await seedPerson(store, { userId: guestUser.id, email: 'guest@example.com', role: 'player' });
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    await tables.applyAction(table.id, host.id, 'configureTable', HOLDEM_CHALLENGE_CONFIGURE, table.version);

    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const invite = (await store.getInviteByToken(token))!;
    const guest = guestUser;

    const joined = await tables.joinTable({
      userId: guest.id,
      displayName: 'Guest',
      tableId: table.id,
      inviteId: invite.id,
      token,
      sessionEmail: 'guest@example.com',
    });
    expect(joined.table.state.session.playerIds.length).toBeGreaterThan(1);
  });

  it('blocks invite join after participant snapshot exists', async () => {
    const lateUser = await store.createUser('late@example.com', 'Late');
    await seedPerson(store, { userId: lateUser.id, email: 'late@example.com', role: 'player' });
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await tables.applyAction(
      table.id,
      host.id,
      'configureTable',
      HOLDEM_CHALLENGE_CONFIGURE,
      table.version,
    );

    const lockedState = ensureHoldemChallengeParticipantSnapshot(configured.state);
    store.updateTable(table.id, lockedState, configured.version);

    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'late@example.com',
      invitedName: 'Late',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const invite = (await store.getInviteByToken(token))!;
    const late = lateUser;

    await expect(
      tables.joinTable({
        userId: late.id,
        displayName: 'Late',
        tableId: table.id,
        inviteId: invite.id,
        token,
        sessionEmail: 'late@example.com',
      }),
    ).rejects.toBeInstanceOf(InviteFlowError);
  });
});
