import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

import { createMemoryStore } from '../src/store/memoryStore.js';
import { TableService } from '../src/tables/service.js';
import { PeopleService } from '../src/people/service.js';
import { seedHostUser, seedPerson } from './testHelpers.js';
import { createInviteToken } from '../src/auth/tokens.js';
import { randomUUID } from 'node:crypto';

describe('active tables list', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let tables: TableService;

  beforeEach(async () => {
    store = createMemoryStore();
    const people = new PeopleService(store);
    tables = new TableService(store, people);
    await seedHostUser(store, 'host@example.com');
    await seedPerson(store, { email: 'guest@example.com', role: 'player', status: 'invited' });
  });

  it('host sees owned open tables', async () => {
    const host = await store.getUserByEmail('host@example.com');
    const table = await tables.createTable(host!.id, 'Host', 'Test', 'host@example.com');
    const list = await tables.listAccessibleTables(host!.id, 'host@example.com');
    expect(list.some((t) => t.tableId === table.id && t.access === 'open')).toBe(true);
  });

  it('invited user sees joinable table but unrelated user does not', async () => {
    const host = await store.getUserByEmail('host@example.com');
    const table = await tables.createTable(host!.id, 'Host', 'Challenge', 'host@example.com');
    const inviteId = randomUUID();
    const token = createInviteToken();
    await store.createInvite({
      id: inviteId,
      tableId: table.id,
      token,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
      inviterUserId: host!.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const guest = await store.createUser('guest@example.com', 'Guest');
    const guestList = await tables.listAccessibleTables(guest.id, 'guest@example.com');
    expect(guestList.some((t) => t.tableId === table.id && t.access === 'join')).toBe(true);

    const stranger = await store.createUser('stranger@example.com', 'Stranger');
    const strangerList = await tables.listAccessibleTables(stranger.id, 'stranger@example.com');
    expect(strangerList.some((t) => t.tableId === table.id)).toBe(false);
  });
});
