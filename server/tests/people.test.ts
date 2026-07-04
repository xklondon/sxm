import { describe, expect, it, afterEach, beforeAll, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

import request from 'supertest';
import { createSessionToken } from '../src/auth/tokens.js';
import { seedHostUser, seedPerson } from './testHelpers.js';

const envBackup = { ...process.env };

type ServiceModules = {
  createMemoryStore: typeof import('../src/store/memoryStore.js').createMemoryStore;
  PeopleService: typeof import('../src/people/service.js').PeopleService;
  AuthService: typeof import('../src/auth/service.js').AuthService;
  TableService: typeof import('../src/tables/service.js').TableService;
};

let cachedModules: ServiceModules | null = null;
let cachedEnvKey = '';

afterEach(() => {
  process.env = { ...envBackup };
});

beforeAll(() => {
  process.env.ROOT_USER_EMAIL = 'root@example.com';
  process.env.INVITE_ONLY_MODE = 'true';
  process.env.NODE_ENV = 'development';
});

async function loadServiceModules(envKey: string): Promise<ServiceModules> {
  if (cachedModules && cachedEnvKey === envKey) {
    return cachedModules;
  }
  if (cachedEnvKey !== envKey) {
    vi.resetModules();
    cachedModules = null;
  }
  cachedEnvKey = envKey;
  const [memoryStore, peopleMod, authMod, tablesMod] = await Promise.all([
    import('../src/store/memoryStore.js'),
    import('../src/people/service.js'),
    import('../src/auth/service.js'),
    import('../src/tables/service.js'),
  ]);
  cachedModules = {
    createMemoryStore: memoryStore.createMemoryStore,
    PeopleService: peopleMod.PeopleService,
    AuthService: authMod.AuthService,
    TableService: tablesMod.TableService,
  };
  return cachedModules;
}

async function setupServices(rootEmail = 'root@example.com', inviteOnly = true) {
  process.env.ROOT_USER_EMAIL = rootEmail;
  process.env.INVITE_ONLY_MODE = inviteOnly ? 'true' : 'false';
  process.env.NODE_ENV = 'development';
  const envKey = `${rootEmail}|${inviteOnly}|development`;
  const {
    createMemoryStore,
    PeopleService: PeopleServiceClass,
    AuthService: AuthServiceClass,
    TableService: TableServiceClass,
  } = await loadServiceModules(envKey);
  const store = createMemoryStore();
  const people = new PeopleServiceClass(store);
  const auth = new AuthServiceClass(store, people);
  const tables = new TableServiceClass(store, people);
  return { store, people, auth, tables };
}

describe('people access control', () => {
  it('ROOT_USER_EMAIL can request magic link when not in people store', async () => {
    const { auth } = await setupServices('root@example.com');
    const result = await auth.requestMagicLink('root@example.com');
    expect(result.ok).toBe(true);
    expect(result.devLink).toBeTruthy();
  });

  it('root person auto-created on first login', async () => {
    const { auth, store } = await setupServices('root@example.com');
    const { devLink } = await auth.requestMagicLink('root@example.com');
    const token = new URL(devLink!, 'http://localhost:5173').searchParams.get('token')!;
    await auth.verifyMagicLink(token);
    const person = await store.getPersonByEmail('root@example.com');
    expect(person).toBeTruthy();
    expect(person!.role).toBe('root');
    expect(person!.canOwnTables).toBe(true);
  });

  it('root cannot be disabled or demoted', async () => {
    const { people, store } = await setupServices('root@example.com');
    const user = await store.createUser('root@example.com', 'Root');
    await people.ensurePersonOnLogin('root@example.com', user.id);
    const person = (await store.getPersonByEmail('root@example.com'))!;
    await expect(people.updatePerson(person.id, { status: 'disabled' }, 'admin@example.com')).rejects.toThrow(/Root user cannot be disabled/i);
    await expect(people.updatePerson(person.id, { role: 'player' }, 'admin@example.com')).rejects.toThrow(/Root user cannot be disabled/i);
  });

  it('unknown email rejected when invite-only enabled', async () => {
    const { auth } = await setupServices('root@example.com', true);
    await expect(auth.requestMagicLink('stranger@example.com')).rejects.toThrow(/not registered or authorised/i);
  });

  it('invited person can request magic link', async () => {
    const { auth, store } = await setupServices('root@example.com', true);
    await seedPerson(store, { email: 'invited@example.com', role: 'player', status: 'invited' });
    const result = await auth.requestMagicLink('invited@example.com');
    expect(result.ok).toBe(true);
  });

  it('table invite grants canLogin/canPlay/canOwnTables/canInvite by default', async () => {
    const { people, tables, store } = await setupServices();
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const { personId, emailSent } = await tables.invitePersonByEmail({
      tableId: table.id,
      userId: host.id,
      email: 'newguest@example.com',
      displayName: 'New Guest',
      role: 'player',
    });
    expect(emailSent).toBe(true);
    const person = await store.getPersonByEmail('newguest@example.com');
    expect(person).toBeTruthy();
    expect(person!.canLogin).toBe(true);
    expect(person!.canPlay).toBe(true);
    expect(person!.canOwnTables).toBe(true);
    expect(person!.canInvite).toBe(true);
    expect(personId).toBe(person!.id);
  });

  it('canOwnTables required to create table', async () => {
    const { tables, store } = await setupServices();
    const user = await store.createUser('player@example.com', 'Player');
    await seedPerson(store, { userId: user.id, email: 'player@example.com', role: 'player' });
    await expect(tables.createTable(user.id, 'Player')).rejects.toThrow(/permission to create tables/i);
  });

  it('canInvite required to invite others', async () => {
    const { tables, store } = await setupServices();
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const guest = await store.createUser('guest@example.com', 'Guest');
    await seedPerson(store, { userId: guest.id, email: 'guest@example.com', role: 'player', canInvite: false });
    await expect(
      tables.createInvite({
        tableId: table.id,
        userId: guest.id,
        invitedEmail: 'friend@example.com',
        invitedName: 'Friend',
      })).rejects.toThrow(/permission to invite/i);
  });

  it('canPlay or table invite required to join table', async () => {
    const { tables, store } = await setupServices();
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const blocked = await store.createUser('blocked@example.com', 'Blocked');
    await seedPerson(store, {
      userId: blocked.id,
      email: 'blocked@example.com',
      role: 'guest',
      canPlay: false,
    });
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'allowed@example.com',
      invitedName: 'Allowed',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const invite = (await store.getInviteByToken(token))!;
    await expect(tables.joinTable({
        userId: blocked.id,
        displayName: 'Blocked',
        tableId: table.id,
        inviteId: invite.id,
        token,
      })).rejects.toMatchObject({
        code: 'INVITE_EMAIL_MISMATCH',
      });

    const invited = await store.createUser('allowed@example.com', 'Allowed');
    const joined = await tables.joinTable({
      userId: invited.id,
      displayName: 'Allowed',
      tableId: table.id,
      inviteId: invite.id,
      token,
    });
    expect(joined.table.id).toBe(table.id);
    expect(joined.memberPersonId).toBe(store.getMember(table.id, invited.id)!.personId);
  });

  it('invite email uses PUBLIC_ORIGIN and no localhost in production config', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_ORIGIN = 'https://play.sxmcards.example';
    process.env.ROOT_USER_EMAIL = 'root@example.com';
    vi.resetModules();
    const { config: prodConfig, getEffectivePublicOrigin: effectiveOrigin } = await import('../src/config.js');
    const { createMemoryStore } = await import('../src/store/memoryStore.js');
    const { PeopleService } = await import('../src/people/service.js');
    const { TableService } = await import('../src/tables/service.js');
    const store = createMemoryStore();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    expect(joinUrl).toContain(effectiveOrigin());
    expect(joinUrl.toLowerCase()).not.toContain('localhost');
  });
});

describe('people admin HTTP API', () => {
  it('people admin APIs require root/admin', async () => {
    process.env.ROOT_USER_EMAIL = 'root@example.com';
    process.env.INVITE_ONLY_MODE = 'true';
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { createApp } = await import('../src/app.js');
    const { createMemoryStore } = await import('../src/store/memoryStore.js');
    const { PeopleService } = await import('../src/people/service.js');
    const { app, store } = createApp();

    const player = await store.createUser('player@example.com', 'Player');
    await seedPerson(store, { userId: player.id, email: 'player@example.com', role: 'player' });
    const playerCookie = `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${createSessionToken({ userId: player.id, email: 'player@example.com' })}`;

    const denied = await request(app).get('/api/people').set('Cookie', playerCookie);
    expect(denied.status).toBe(403);

    const root = await store.createUser('root@example.com', 'Root');
    const people = new PeopleService(store);
    await people.ensurePersonOnLogin('root@example.com', root.id);
    const rootCookie = `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${createSessionToken({ userId: root.id, email: 'root@example.com' })}`;

    const allowed = await request(app).get('/api/people').set('Cookie', rootCookie);
    expect(allowed.status).toBe(200);
    expect(Array.isArray(allowed.body.people)).toBe(true);
  });

  it('/api/auth/me returns permissions', async () => {
    process.env.ROOT_USER_EMAIL = 'root@example.com';
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { createApp } = await import('../src/app.js');
    const { PeopleService } = await import('../src/people/service.js');
    const { app, store } = createApp();
    const root = await store.createUser('root@example.com', 'Root');
    const people = new PeopleService(store);
    await people.ensurePersonOnLogin('root@example.com', root.id);
    const cookie = `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${createSessionToken({ userId: root.id, email: 'root@example.com' })}`;

    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('root');
    expect(res.body.user.canOwnTables).toBe(true);
    expect(res.body.user.canInvite).toBe(true);
    expect(res.body.user.isRoot).toBe(true);
  });

  it('root email has people admin before person row is linked', async () => {
    process.env.ROOT_USER_EMAIL = 'root@example.com';
    process.env.INVITE_ONLY_MODE = 'true';
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { createApp } = await import('../src/app.js');
    const { app, store } = createApp();
    const root = await store.createUser('root@example.com', 'Root');
    const cookie = `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${createSessionToken({ userId: root.id, email: 'root@example.com' })}`;
    const res = await request(app).get('/api/people').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.people)).toBe(true);
  });
});
