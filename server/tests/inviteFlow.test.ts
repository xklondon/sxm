import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createSessionToken } from '../src/auth/tokens.js';
import { permissionsForRole } from '../src/people/permissions.js';
import { seedHostUser, seedPerson } from './testHelpers.js';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

async function setupServices() {
  process.env.ROOT_USER_EMAIL = 'root@example.com';
  process.env.INVITE_ONLY_MODE = 'true';
  process.env.NODE_ENV = 'development';
  vi.resetModules();
  const { createMemoryStore } = await import('../src/store/memoryStore.js');
  const { PeopleService } = await import('../src/people/service.js');
  const { AuthService } = await import('../src/auth/service.js');
  const { TableService } = await import('../src/tables/service.js');
  const store = createMemoryStore({ enableTestHooks: true });
  const people = new PeopleService(store);
  const auth = new AuthService(store, people);
  const tables = new TableService(store, people);
  return { store, people, auth, tables };
}

async function setupApp() {
  process.env.ROOT_USER_EMAIL = 'root@example.com';
  process.env.INVITE_ONLY_MODE = 'true';
  process.env.NODE_ENV = 'development';
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  const { PeopleService } = await import('../src/people/service.js');
  const { app, store } = createApp();
  return { app, store, people: new PeopleService(store) };
}

function sessionCookie(userId: string, email: string) {
  return `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${createSessionToken({ userId, email })}`;
}

describe('invite flow resolution', () => {
  it('invite existing Person without User → magic link links User and joins table', async () => {
    const { store, people, auth, tables } = await setupServices();
    await seedPerson(store, { email: 'guest@example.com', role: 'player', status: 'invited' });
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;

    const { devLink } = await auth.requestMagicLink('guest@example.com');
    const magicToken = new URL(devLink!, 'http://localhost:5173').searchParams.get('token')!;
    await auth.verifyMagicLink(magicToken);
    const user = (await store.getUserByEmail('guest@example.com'))!;
    const person = await people.getPersonForUser(user.id);
    expect(person?.userId).toBe(user.id);

    const invite = (await store.getInviteByToken(token))!;
    const joined = await tables.joinTable({
      userId: user.id,
      displayName: 'Guest',
      tableId: table.id,
      inviteId: invite.id,
      token,
      sessionEmail: 'guest@example.com',
    });
    expect(joined.memberPersonId).toBeTruthy();
    expect(store.getMembers(table.id)).toHaveLength(2);
  });

  it('stale Person.userId wrong email → repaired and invite succeeds', async () => {
    const { store, people, tables } = await setupServices();
    const user = await store.createUser('guest@example.com', 'Guest');
    const wrongUser = await store.createUser('wrong@example.com', 'Wrong');
    await seedPerson(store, { email: 'guest@example.com', userId: wrongUser.id, role: 'player' });

    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const invite = (await store.getInviteByToken(token))!;

    const joined = await tables.joinTable({
      userId: user.id,
      displayName: 'Guest',
      tableId: table.id,
      inviteId: invite.id,
      token,
      sessionEmail: 'guest@example.com',
    });
    const repaired = await people.getPersonForUser(user.id);
    expect(repaired?.userId).toBe(user.id);
    expect(joined.table.id).toBe(table.id);
  });

  it('logged in as wrong user opening invite join → explicit mismatch message', async () => {
    const { store, tables } = await setupServices();
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const wrongUser = await store.createUser('wrong@example.com', 'Wrong');
    await seedPerson(store, { email: 'wrong@example.com', userId: wrongUser.id, role: 'player' });
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const invite = (await store.getInviteByToken(token))!;

    await expect(
      tables.joinTable({
        userId: wrongUser.id,
        displayName: 'Wrong',
        tableId: table.id,
        inviteId: invite.id,
        token,
        sessionEmail: 'wrong@example.com',
      }),
    ).rejects.toMatchObject({
      code: 'INVITE_EMAIL_MISMATCH',
      message: expect.stringMatching(/another email/i),
    });
  });

  it('duplicate Person email blocks invite creation with admin repair message', async () => {
    const { store, tables } = await setupServices();
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    await seedPerson(store, { email: 'guest@example.com', role: 'player' });
    store.insertOrphanPersonForTests!({
      id: randomUUID(),
      email: 'guest@example.com',
      displayName: 'Dup',
      status: 'invited',
      role: 'player',
      ...permissionsForRole('player'),
      createdAt: new Date().toISOString(),
      invitedAt: null,
      invitedBy: null,
      lastLoginAt: null,
      userId: null,
    });

    await expect(
      tables.createInvite({
        tableId: table.id,
        userId: host.id,
        invitedEmail: 'guest@example.com',
        invitedName: 'Guest',
      }),
    ).rejects.toMatchObject({
      code: 'INVITE_DUPLICATE_ACCOUNTS',
      message: expect.stringMatching(/Duplicate account records/i),
    });
  });

  it('disabled Person cannot join via invite', async () => {
    const { store, tables } = await setupServices();
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const guestUser = await store.createUser('guest@example.com', 'Guest');
    await seedPerson(store, {
      email: 'guest@example.com',
      userId: guestUser.id,
      role: 'player',
      status: 'disabled',
      canLogin: false,
    });
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const invite = (await store.getInviteByToken(token))!;

    await expect(
      tables.joinTable({
        userId: guestUser.id,
        displayName: 'Guest',
        tableId: table.id,
        inviteId: invite.id,
        token,
        sessionEmail: 'guest@example.com',
      }),
    ).rejects.toMatchObject({
      code: 'INVITE_PERSON_DISABLED',
      message: expect.stringMatching(/disabled/i),
    });
  });

  it('magic-link login and invite accept resolve same canonical person', async () => {
    const { store, people, auth, tables } = await setupServices();
    await seedPerson(store, { email: 'guest@example.com', role: 'player', status: 'invited' });
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;

    const { devLink } = await auth.requestMagicLink('guest@example.com');
    const magicToken = new URL(devLink!, 'http://localhost:5173').searchParams.get('token')!;
    await auth.verifyMagicLink(magicToken);
    const user = (await store.getUserByEmail('guest@example.com'))!;
    const loginPerson = await people.getPersonForUser(user.id);

    const accepted = await tables.acceptInviteByToken(token, user.id, {
      route: 'GET /api/tables/invites/accept',
    });
    expect(accepted.tableId).toBe(table.id);
    const afterPerson = await people.getPersonForUser(user.id);
    expect(afterPerson?.id).toBe(loginPerson?.id);
  });

  it('table member added exactly once on repeat accept path', async () => {
    const { store, tables } = await setupServices();
    const guestUser = await store.createUser('guest@example.com', 'Guest');
    await seedPerson(store, { email: 'guest@example.com', userId: guestUser.id, role: 'player' });
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const invite = (await store.getInviteByToken(token))!;

    await tables.joinTable({
      userId: guestUser.id,
      displayName: 'Guest',
      tableId: table.id,
      inviteId: invite.id,
      token,
      sessionEmail: 'guest@example.com',
    });
    const membersAfterFirst = store.getMembers(table.id).filter((m) => m.userId === guestUser.id);
    expect(membersAfterFirst).toHaveLength(1);
  });
});

describe('invite flow HTTP', () => {
  it('POST /join returns structured mismatch error for wrong session email', async () => {
    const { app, store } = await setupApp();
    const host = await seedHostUser(store);
    const { TableService } = await import('../src/tables/service.js');
    const { PeopleService } = await import('../src/people/service.js');
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const table = await tables.createTable(host.id, 'Host');
    const wrongUser = await store.createUser('wrong@example.com', 'Wrong');
    await seedPerson(store, { email: 'wrong@example.com', userId: wrongUser.id, role: 'player' });
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const invite = (await store.getInviteByToken(token))!;

    const res = await request(app)
      .post('/api/tables/join')
      .set('Cookie', sessionCookie(wrongUser.id, 'wrong@example.com'))
      .send({
        tableId: table.id,
        inviteId: invite.id,
        token,
        displayName: 'Wrong',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INVITE_EMAIL_MISMATCH');
    expect(res.body.error).toMatch(/another email/i);
  });

  it('accept clears mismatched session and provisions invite email user', async () => {
    const { app, store } = await setupApp();
    const host = await seedHostUser(store);
    const { TableService } = await import('../src/tables/service.js');
    const { PeopleService } = await import('../src/people/service.js');
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const table = await tables.createTable(host.id, 'Host');
    const wrongUser = await store.createUser('wrong@example.com', 'Wrong');
    await seedPerson(store, { email: 'wrong@example.com', userId: wrongUser.id, role: 'player' });
    await seedPerson(store, { email: 'guest@example.com', role: 'player', status: 'invited' });
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;

    const res = await request(app)
      .get(`/api/tables/invites/accept?token=${encodeURIComponent(token)}`)
      .set('Cookie', sessionCookie(wrongUser.id, 'wrong@example.com'));

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(`table=${table.id}`);
    const guestUser = await store.getUserByEmail('guest@example.com');
    expect(guestUser).toBeTruthy();
    expect(store.getMember(table.id, guestUser!.id)).toBeTruthy();
  });
});
