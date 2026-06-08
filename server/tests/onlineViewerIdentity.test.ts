import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

import { createMemoryStore } from '../src/store/memoryStore.js';
import { PeopleService } from '../src/people/service.js';
import { TableService } from '../src/tables/service.js';
import { seedHostUser } from './testHelpers.js';

describe('online viewer identity — server memberPersonId contract', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let tables: TableService;

  beforeEach(() => {
    store = createMemoryStore();
    tables = new TableService(store, new PeopleService(store));
  });

  it('returns authoritative memberPersonId on table fetch and join', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const hostMemberPersonId = store.getMember(table.id, host.id)!.personId;
    expect(hostMemberPersonId).toBeTruthy();

    const fetchedPersonId = await tables.getMemberPersonIdForSession(
      table.id,
      host.id,
      host.email,
      'GET /api/tables/:id',
    );
    expect(fetchedPersonId).toBe(hostMemberPersonId);

    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const guest = await store.createUser('guest@example.com', 'Guest');
    const joined = await tables.joinTable({
      userId: guest.id,
      displayName: 'Guest',
      tableId: table.id,
      inviteId: (await store.getInviteByToken(token))!.id,
      token,
    });

    expect(joined.memberPersonId).toBe(store.getMember(table.id, guest.id)!.personId);
    expect(joined.memberPersonId).not.toBe(hostMemberPersonId);
  });
});
