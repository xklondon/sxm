import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { PeopleService } from '../src/people/service.js';
import { TableService } from '../src/tables/service.js';
import { broadcastTableUpdate } from '../src/tables/broadcast.js';
import { seedHostUser, seedPerson } from './testHelpers.js';
import type { GameState } from '../../src/types/index.js';

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

describe('holdem join table:update broadcast', () => {
  it('broadcastTableUpdate emits per-socket redacted state to table room subscribers', async () => {
    const emit = vi.fn();
    const fetchSockets = vi.fn(async () => [
      { data: { userId: 'user-1' }, emit },
    ]);
    const io = { in: vi.fn(() => ({ fetchSockets })) };
    // No deck / hidden cards — redaction is a no-op and the same state object
    // flows through.
    const state = { session: { id: 'table-1' } } as GameState;

    broadcastTableUpdate(io as never, 'table-1', 3, state, () => 'person-1');

    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledWith('table:update', {
        tableId: 'table-1',
        version: 3,
        state,
      });
    });
    expect(io.in).toHaveBeenCalledWith('table:table-1');
  });

  it('guest join adds second playable seat to table state', async () => {
    const store = createMemoryStore();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
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

    const joined = await tables.joinTable({
      userId: guestUser.id,
      displayName: 'Guest',
      tableId: table.id,
      inviteId: invite.id,
      token,
      sessionEmail: 'guest@example.com',
    });

    expect(joined.table.state.session.playerIds.length).toBeGreaterThan(1);
    const { listHoldemPlayableSeatIds } = await import('../../src/engine/holdem/holdemPlayableSeats.js');
    expect(listHoldemPlayableSeatIds(joined.table.state).length).toBe(2);
    expect(joined.table.version).toBeGreaterThan(table.version);
  });
});
