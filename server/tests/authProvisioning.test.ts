import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

async function createInviteOnlyApp() {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-secret';
  process.env.INVITE_ONLY_MODE = 'true';
  process.env.ROOT_USER_EMAIL = 'root@example.com';
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  return createApp();
}

describe('auth user provisioning', () => {
  it('GET /api/auth/me recovers stale session userId via email (200, not throw)', async () => {
    const { app } = await createInviteOnlyApp();
    const { createSessionToken } = await import('../src/auth/tokens.js');
    const token = createSessionToken({
      userId: 'stale-after-restart',
      email: 'root@example.com',
      persistent: true,
    });
    const cookie = `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${token}`;
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('root@example.com');
    expect(res.body.user.isRoot).toBe(true);
  });

  it('POST /api/tables with stale session provisions root and creates table', async () => {
    const { app } = await createInviteOnlyApp();
    const { createSessionToken } = await import('../src/auth/tokens.js');
    const token = createSessionToken({
      userId: 'stale-host-id',
      email: 'root@example.com',
      persistent: true,
    });
    const cookie = `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${token}`;
    const res = await request(app)
      .post('/api/tables')
      .set('Cookie', cookie)
      .send({ displayName: 'Root Host' });
    expect(res.status).toBe(201);
    expect(res.body.tableId).toBeTruthy();
  });

  it('GET /api/auth/me returns 403 JSON for invite-only stranger with session', async () => {
    const { app, store } = await createInviteOnlyApp();
    const email = 'stranger@example.com';
    const user = store.createUser(email, 'Stranger');
    const { createSessionToken } = await import('../src/auth/tokens.js');
    const token = createSessionToken({ userId: user.id, email, persistent: true });
    const cookie = `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${token}`;
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.canOwnTables).toBe(false);
    const createRes = await request(app)
      .post('/api/tables')
      .set('Cookie', cookie)
      .send({ displayName: 'X' });
    expect(createRes.status).toBe(403);
    expect(createRes.body.code).toBe('NOT_REGISTERED');
    expect(createRes.body.error).toMatch(/invite/i);
  });

  it('invite accept with stale session userId provisions guest user/person', async () => {
    const { store } = await createInviteOnlyApp();
    const { PeopleService } = await import('../src/people/service.js');
    const { TableService } = await import('../src/tables/service.js');
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const root = store.createUser('root@example.com', 'Root');
    people.ensurePersonOnLogin('root@example.com', root.id);
    const table = tables.createTable(root.id, 'Root', undefined, 'root@example.com');
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: root.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
      sessionEmail: 'root@example.com',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const result = tables.acceptInviteByToken(token, 'stale-guest-session-id');
    expect(result.tableId).toBe(table.id);
    const guest = store.getUserByEmail('guest@example.com');
    expect(guest).toBeTruthy();
    expect(store.getPersonByEmail('guest@example.com')).toBeTruthy();
    expect(store.getMember(table.id, guest!.id)).toBeTruthy();
  });
});
