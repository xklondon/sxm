import { randomUUID } from 'node:crypto';
import { describe, expect, it, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createSessionToken } from '../src/auth/tokens.js';
import { auditPeopleAndUsers } from '../src/people/duplicateAudit.js';
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

async function setupServices(rootEmail = 'root@example.com') {
  process.env.ROOT_USER_EMAIL = rootEmail;
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

function rootCookie(store: Awaited<ReturnType<typeof setupApp>>['store']) {
  return async () => {
    const root = await store.createUser('root@example.com', 'Root');
    const people = new (await import('../src/people/service.js')).PeopleService(store);
    await people.ensurePersonOnLogin('root@example.com', root.id);
    return `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${createSessionToken({ userId: root.id, email: 'root@example.com' })}`;
  };
}

describe('duplicateAudit', () => {
  it('detects duplicate person emails and user/email mismatches', () => {
    const user = {
      id: 'user-1',
      email: 'guest@example.com',
      displayName: 'Guest',
      createdAt: new Date().toISOString(),
    };
    const wrongUser = {
      id: 'user-2',
      email: 'other@example.com',
      displayName: 'Other',
      createdAt: new Date().toISOString(),
    };
    const perms = permissionsForRole('player');
    const report = auditPeopleAndUsers(
      [
        {
          id: 'p1',
          email: 'guest@example.com',
          displayName: 'Guest',
          status: 'active',
          role: 'player',
          ...perms,
          createdAt: new Date().toISOString(),
          invitedAt: null,
          invitedBy: null,
          lastLoginAt: null,
          userId: 'user-1',
        },
        {
          id: 'p2',
          email: 'guest@example.com',
          displayName: 'Guest duplicate',
          status: 'invited',
          role: 'player',
          ...perms,
          createdAt: new Date().toISOString(),
          invitedAt: null,
          invitedBy: null,
          lastLoginAt: null,
          userId: null,
        },
        {
          id: 'p3',
          email: 'broken@example.com',
          displayName: 'Broken',
          status: 'active',
          role: 'player',
          ...perms,
          createdAt: new Date().toISOString(),
          invitedAt: null,
          invitedBy: null,
          lastLoginAt: null,
          userId: 'user-2',
        },
      ],
      [user, wrongUser],
    );

    expect(report.duplicatePersonEmails).toContain('guest@example.com');
    expect(report.warnings.some((w) => w.type === 'duplicate_person_email')).toBe(true);
    expect(report.warnings.some((w) => w.type === 'email_user_mismatch')).toBe(true);
  });
});

describe('people cleanup service', () => {
  it('detects duplicate emails in directory audit', async () => {
    const { store, people } = await setupServices();
    const guestUser = await store.createUser('guest@example.com', 'Guest');
    await seedPerson(store, { email: 'guest@example.com', userId: guestUser.id });
    store.insertOrphanPersonForTests!({
      id: randomUUID(),
      email: 'guest@example.com',
      displayName: 'Duplicate',
      status: 'invited',
      role: 'player',
      ...permissionsForRole('player'),
      createdAt: new Date().toISOString(),
      invitedAt: null,
      invitedBy: null,
      lastLoginAt: null,
      userId: null,
    });

    const audit = await people.auditPeopleDirectory();
    expect(audit.duplicatePersonEmails).toContain('guest@example.com');
  });

  it('admin can hard-delete a non-root person', async () => {
    const { store, people } = await setupServices();
    const person = await seedPerson(store, { email: 'temp@example.com', role: 'player' });
    const result = await people.removePerson(person.id, 'root@example.com', { hard: true });
    expect(result.mode).toBe('deleted');
    expect(await store.getPersonById(person.id)).toBeNull();
  });

  it('cannot delete root person', async () => {
    const { people, store } = await setupServices();
    const rootUser = await store.createUser('root@example.com', 'Root');
    await people.ensurePersonOnLogin('root@example.com', rootUser.id);
    const rootPerson = (await store.getPersonByEmail('root@example.com'))!;
    await expect(people.removePerson(rootPerson.id, 'root@example.com', { hard: true })).rejects.toThrow(
      /Root user cannot be removed/i,
    );
  });

  it('admin cannot hard-delete their own admin account', async () => {
    const { people, store } = await setupServices();
    const adminUser = await store.createUser('admin@example.com', 'Admin');
    const adminPerson = await seedPerson(store, {
      email: 'admin@example.com',
      userId: adminUser.id,
      role: 'admin',
    });
    await expect(
      people.removePerson(adminPerson.id, 'admin@example.com', { hard: true }),
    ).rejects.toThrow(/cannot remove your own admin account/i);
  });

  it('repair links Person.userId to canonical User and merges duplicates', async () => {
    const { store, people } = await setupServices();
    const user = await store.createUser('guest@example.com', 'Guest');
    const canonical = await seedPerson(store, {
      email: 'guest@example.com',
      userId: null,
      role: 'player',
      status: 'invited',
    });
    const duplicateId = randomUUID();
    store.insertOrphanPersonForTests!({
      id: duplicateId,
      email: 'guest@example.com',
      displayName: 'Guest Alt',
      status: 'active',
      role: 'player',
      ...permissionsForRole('player'),
      createdAt: new Date().toISOString(),
      invitedAt: null,
      invitedBy: null,
      lastLoginAt: new Date().toISOString(),
      userId: user.id,
    });

    const result = await people.repairPersonByEmail('guest@example.com', 'root@example.com');
    expect(result.mergedCount).toBe(1);
    expect(result.canonicalPerson.userId).toBe(user.id);
    expect(await store.getPersonById(duplicateId)).toBeNull();
    expect(await store.getPersonByEmail('guest@example.com')).toBeTruthy();
    expect((await store.getPersonByEmail('guest@example.com'))!.id).toBe(canonical.id);
  });

  it('getPersonForUser repairs stale userId link to email-canonical person', async () => {
    const { store, people } = await setupServices();
    const user = await store.createUser('guest@example.com', 'Guest');
    const wrongUser = await store.createUser('wrong@example.com', 'Wrong');
    await seedPerson(store, { email: 'guest@example.com', userId: wrongUser.id, role: 'player' });

    const resolved = await people.getPersonForUser(user.id);
    expect(resolved?.email).toBe('guest@example.com');
    expect(resolved?.userId).toBe(user.id);
  });

  it('magic-link login and invite join resolve the same canonical person', async () => {
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
    const loginUser = (await store.getUserByEmail('guest@example.com'))!;
    const loginPerson = await people.getPersonForUser(loginUser.id);
    expect(loginPerson?.email).toBe('guest@example.com');

    const invite = (await store.getInviteByToken(token))!;
    await tables.joinTable({
      userId: loginUser.id,
      displayName: 'Guest',
      tableId: table.id,
      inviteId: invite.id,
      token,
    });
    const joinedPerson = await people.getPersonForUser(loginUser.id);
    expect(joinedPerson?.id).toBe(loginPerson?.id);
  });
});

describe('people cleanup HTTP API', () => {
  it('GET /api/people includes audit warnings for admins', async () => {
    const { app, store } = await setupApp();
    const cookie = await rootCookie(store)();
    const wrongUser = await store.createUser('wrong@example.com', 'Wrong');
    await seedPerson(store, { email: 'guest@example.com', userId: wrongUser.id, role: 'player' });
    const res = await request(app).get('/api/people').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(
      res.body.audit.warnings.some(
        (warning: { type: string }) => warning.type === 'email_user_mismatch',
      ),
    ).toBe(true);
  });

  it('POST /api/people/repair-email links person to canonical user', async () => {
    const { app, store } = await setupApp();
    const cookie = await rootCookie(store)();
    const user = await store.createUser('guest@example.com', 'Guest');
    const wrongUser = await store.createUser('wrong@example.com', 'Wrong');
    await seedPerson(store, { email: 'guest@example.com', userId: wrongUser.id, role: 'player' });

    const res = await request(app)
      .post('/api/people/repair-email')
      .set('Cookie', cookie)
      .send({ email: 'guest@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.canonicalPerson.userId).toBe(user.id);
  });
});
