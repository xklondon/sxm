import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

import { createMemoryStore } from '../src/store/memoryStore.js';
import { TableService } from '../src/tables/service.js';
import { PeopleService } from '../src/people/service.js';
import { seedHostUser, seedPerson } from './testHelpers.js';

describe('table join requests', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let tables: TableService;

  beforeEach(async () => {
    store = createMemoryStore();
    const people = new PeopleService(store);
    tables = new TableService(store, people);
    await seedHostUser(store, 'host@example.com');
    await seedPerson(store, { email: 'guest@example.com', role: 'player', status: 'invited' });
  });

  it('lists active tables with request access for unrelated users', async () => {
    const host = await store.getUserByEmail('host@example.com');
    const table = await tables.createTable(host!.id, 'Host', 'Open Room', 'host@example.com');
    const guest = await store.createUser('guest@example.com', 'Guest');
    const list = await tables.listActiveTables(guest.id, 'guest@example.com');
    const row = list.find((entry) => entry.tableId === table.id);
    expect(row?.access).toBe('request');
    expect(row?.host).toBeTruthy();
  });

  it('creates pending join request for non-invited user', async () => {
    const host = await store.getUserByEmail('host@example.com');
    const table = await tables.createTable(host!.id, 'Host', 'Open Room', 'host@example.com');
    const guest = await store.createUser('guest@example.com', 'Guest');
    const created = await tables.requestTableAccess({
      tableId: table.id,
      userId: guest.id,
      displayName: 'Guest',
      sessionEmail: 'guest@example.com',
    });
    expect(created.requestId).toBeTruthy();
    const list = await tables.listActiveTables(guest.id, 'guest@example.com');
    expect(list.find((entry) => entry.tableId === table.id)?.access).toBe('pending');
  });

  it('host approve grants membership; deny leaves guest without membership', async () => {
    const host = await store.getUserByEmail('host@example.com');
    const table = await tables.createTable(host!.id, 'Host', 'Open Room', 'host@example.com');
    const guest = await store.createUser('guest@example.com', 'Guest');
    const { requestId } = await tables.requestTableAccess({
      tableId: table.id,
      userId: guest.id,
      displayName: 'Guest',
      sessionEmail: 'guest@example.com',
    });

    await tables.approveJoinRequest({
      tableId: table.id,
      requestId,
      userId: host!.id,
      sessionEmail: 'host@example.com',
    });
    expect(store.getMember(table.id, guest.id)).toBeTruthy();

    const stranger = await store.createUser('stranger@example.com', 'Stranger');
    const denied = await tables.requestTableAccess({
      tableId: table.id,
      userId: stranger.id,
      displayName: 'Stranger',
      sessionEmail: 'stranger@example.com',
    });
    await tables.denyJoinRequest({
      tableId: table.id,
      requestId: denied.requestId,
      userId: host!.id,
      sessionEmail: 'host@example.com',
    });
    expect(store.getMember(table.id, stranger.id)).toBeNull();
  });
});
