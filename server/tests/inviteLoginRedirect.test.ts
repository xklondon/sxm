import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { PENDING_INVITE_COOKIE_NAME } from '../src/auth/pendingInviteCookie.js';
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

async function setupApp() {
  process.env.ROOT_USER_EMAIL = 'root@example.com';
  process.env.INVITE_ONLY_MODE = 'true';
  process.env.NODE_ENV = 'development';
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  const { PeopleService } = await import('../src/people/service.js');
  const { TableService } = await import('../src/tables/service.js');
  const { AuthService } = await import('../src/auth/service.js');
  const { createSessionToken } = await import('../src/auth/tokens.js');
  const { app, store } = createApp();
  const people = new PeopleService(store);
  const auth = new AuthService(store, people);
  const tables = new TableService(store, people);
  return { app, store, people, auth, tables, createSessionToken };
}

function sessionCookie(createSessionToken: (payload: { userId: string; email: string }) => string, userId: string, email: string): string {
  const name = process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session';
  return `${name}=${encodeURIComponent(createSessionToken({ userId, email }))}`;
}

function pendingInviteCookie(token: string): string {
  return `${PENDING_INVITE_COOKIE_NAME}=${encodeURIComponent(token)}`;
}

function parseSetCookies(header: string | string[] | undefined): string[] {
  if (!header) {
    return [];
  }
  return Array.isArray(header) ? header : [header];
}

async function createGuestInvite(appSetup: Awaited<ReturnType<typeof setupApp>>) {
  const { store, tables } = appSetup;
  const host = await seedHostUser(store);
  const table = await tables.createTable(host.id, 'Friday Night');
  await seedPerson(store, { email: 'guest@example.com', role: 'player', status: 'invited' });
  const { joinUrl } = await tables.createInvite({
    tableId: table.id,
    userId: host.id,
    invitedEmail: 'guest@example.com',
    invitedName: 'Guest',
  });
  const token = new URL(joinUrl).searchParams.get('token')!;
  return { host, table, token };
}

describe('invite login redirect flow', () => {
  it('authenticated user clicks invite → joins table', async () => {
    const setup = await setupApp();
    const { app, store, createSessionToken } = setup;
    const { table, token } = await createGuestInvite(setup);
    const guest = await store.createUser('guest@example.com', 'Guest');
    await seedPerson(store, { email: 'guest@example.com', userId: guest.id, role: 'player' });

    const res = await request(app)
      .get(`/api/tables/invites/accept?token=${encodeURIComponent(token)}`)
      .set('Cookie', sessionCookie(createSessionToken, guest.id, 'guest@example.com'))
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(`table=${encodeURIComponent(table.id)}`);
    expect(store.getMember(table.id, guest.id)).toBeTruthy();
    const invite = (await store.getInviteByToken(token))!;
    expect(invite.status).toBe('accepted');
  });

  it('unauthenticated user clicks invite → login → magic verify → invited table opens', async () => {
    const setup = await setupApp();
    const { app, store, auth } = setup;
    const { table, token } = await createGuestInvite(setup);

    const acceptRes = await request(app)
      .get(`/api/tables/invites/accept?token=${encodeURIComponent(token)}`)
      .redirects(0);

    expect(acceptRes.status).toBe(302);
    expect(acceptRes.headers.location).toContain('/login');
    expect(acceptRes.headers.location).toContain('invitedEmail=guest%40example.com');
    expect(parseSetCookies(acceptRes.headers['set-cookie']).some((c) => c.includes(PENDING_INVITE_COOKIE_NAME))).toBe(
      true,
    );
    expect((await store.getInviteByToken(token))!.status).toBe('pending');
    expect(store.getMembers(table.id)).toHaveLength(1);

    const { devLink } = await auth.requestMagicLink('guest@example.com');
    const magicToken = new URL(devLink!, 'http://localhost:5173').searchParams.get('token')!;

    const verifyRes = await request(app)
      .get(`/api/auth/verify?token=${encodeURIComponent(magicToken)}`)
      .set('Cookie', pendingInviteCookie(token))
      .redirects(0);

    expect(verifyRes.status).toBe(302);
    expect(verifyRes.headers.location).toContain(`table=${encodeURIComponent(table.id)}`);
    const guest = (await store.getUserByEmail('guest@example.com'))!;
    expect(store.getMember(table.id, guest.id)).toBeTruthy();
    expect((await store.getInviteByToken(token))!.status).toBe('accepted');
  });

  it('pending invite cookie cleared after successful verify accept', async () => {
    const setup = await setupApp();
    const { app, store, auth } = setup;
    const { table, token } = await createGuestInvite(setup);
    const { devLink } = await auth.requestMagicLink('guest@example.com');
    const magicToken = new URL(devLink!, 'http://localhost:5173').searchParams.get('token')!;

    const verifyRes = await request(app)
      .get(`/api/auth/verify?token=${encodeURIComponent(magicToken)}`)
      .set('Cookie', pendingInviteCookie(token))
      .redirects(0);

    expect(verifyRes.status).toBe(302);
    expect(verifyRes.headers.location).toContain(`table=${encodeURIComponent(table.id)}`);
    const cookies = parseSetCookies(verifyRes.headers['set-cookie']);
    expect(cookies.some((c) => c.includes(`${PENDING_INVITE_COOKIE_NAME}=;`) && c.includes('Max-Age=0'))).toBe(true);
    expect(store.getMember(table.id, (await store.getUserByEmail('guest@example.com'))!.id)).toBeTruthy();
  });

  it('invalid token shows error redirect', async () => {
    const { app } = await setupApp();
    const res = await request(app)
      .get('/api/tables/invites/accept?token=not-a-real-token')
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('inviteError=');
    expect(res.headers.location).not.toContain('/login');
  });

  it('expired token shows error redirect', async () => {
    const setup = await setupApp();
    const { app, store } = setup;
    const { table, token } = await createGuestInvite(setup);
    const invite = (await store.getInviteByToken(token))!;
    store.createInvite({
      ...invite,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    const res = await request(app)
      .get(`/api/tables/invites/accept?token=${encodeURIComponent(token)}`)
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(`table=${encodeURIComponent(table.id)}`);
    expect(res.headers.location).toContain('inviteError=');
    expect(res.headers.location).toMatch(/expired|invalid/i);
  });

  it('normal login without invite still goes to lobby', async () => {
    const setup = await setupApp();
    const { app, auth } = setup;
    await seedPerson(setup.store, { email: 'guest@example.com', role: 'player', status: 'invited' });

    const { devLink } = await auth.requestMagicLink('guest@example.com');
    const magicToken = new URL(devLink!, 'http://localhost:5173').searchParams.get('token')!;

    const verifyRes = await request(app)
      .get(`/api/auth/verify?token=${encodeURIComponent(magicToken)}`)
      .redirects(0);

    expect(verifyRes.status).toBe(302);
    expect(verifyRes.headers.location).toMatch(/\/$/);
    expect(verifyRes.headers.location).not.toContain('table=');
  });

  it('unauthenticated invite login keeps returnTo so one magic cycle can resume', async () => {
    const setup = await setupApp();
    const { app } = setup;
    const { token } = await createGuestInvite(setup);

    const acceptRes = await request(app)
      .get(`/api/tables/invites/accept?token=${encodeURIComponent(token)}`)
      .redirects(0);

    expect(acceptRes.status).toBe(302);
    const loginUrl = new URL(acceptRes.headers.location, 'https://play.example.com');
    expect(loginUrl.pathname).toBe('/login');
    expect(loginUrl.searchParams.get('returnTo')).toBe(`/join-table?token=${token}`);
    expect(loginUrl.searchParams.get('invitedEmail')).toBe('guest@example.com');
  });

  it('magic verify without pending cookie still returns to invite resume path', async () => {
    const setup = await setupApp();
    const { app, auth } = setup;
    const { token } = await createGuestInvite(setup);
    await seedPerson(setup.store, { email: 'guest@example.com', role: 'player', status: 'invited' });
    const { devLink } = await auth.requestMagicLink(
      'guest@example.com',
      true,
      `/join-table?token=${token}`,
    );
    const magicUrl = new URL(devLink!, 'https://play.example.com');
    expect(magicUrl.searchParams.get('returnTo')).toBe(`/join-table?token=${token}`);

    const verifyRes = await request(app)
      .get(`${magicUrl.pathname}${magicUrl.search}`)
      .redirects(0);

    expect(verifyRes.status).toBe(302);
    expect(verifyRes.headers.location).toContain(`/join-table?token=${encodeURIComponent(token)}`);
    expect(verifyRes.headers.location).not.toMatch(/\/login/);
  });

  it('authenticated matching user joins without a magic-link hop', async () => {
    const setup = await setupApp();
    const { app, store, createSessionToken } = setup;
    const { table, token } = await createGuestInvite(setup);
    const guest = await store.createUser('guest@example.com', 'Guest');
    await seedPerson(store, { email: 'guest@example.com', userId: guest.id, role: 'player' });

    const first = await request(app)
      .get(`/api/tables/invites/accept?token=${encodeURIComponent(token)}`)
      .set('Cookie', sessionCookie(createSessionToken, guest.id, 'guest@example.com'))
      .redirects(0);
    expect(first.headers.location).toContain(`table=${encodeURIComponent(table.id)}`);
    expect(first.headers.location).not.toContain('/login');

    const second = await request(app)
      .get(`/api/tables/invites/accept?token=${encodeURIComponent(token)}`)
      .set('Cookie', sessionCookie(createSessionToken, guest.id, 'guest@example.com'))
      .redirects(0);
    expect(second.status).toBe(302);
    expect(second.headers.location).toContain(`table=${encodeURIComponent(table.id)}`);
    expect(second.headers.location).not.toContain('/login');
  });

  it('authenticated wrong email is blocked and does not join', async () => {
    const setup = await setupApp();
    const { app, store, createSessionToken } = setup;
    const { table, token } = await createGuestInvite(setup);
    const wrong = await store.createUser('wrong@example.com', 'Wrong');
    await seedPerson(store, { email: 'wrong@example.com', userId: wrong.id, role: 'player' });

    const res = await request(app)
      .get(`/api/tables/invites/accept?token=${encodeURIComponent(token)}`)
      .set('Cookie', sessionCookie(createSessionToken, wrong.id, 'wrong@example.com'))
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login');
    expect(res.headers.location).toContain('invitedEmail=guest%40example.com');
    expect(new URL(res.headers.location, 'https://play.example.com').searchParams.get('returnTo')).toContain(
      token,
    );
    expect(store.getMember(table.id, wrong.id)).toBeFalsy();
    expect((await store.getInviteByToken(token))!.status).toBe('pending');
  });

  it('production-style absolute returnTo keeps the invite token', async () => {
    const { safeReturnTo, buildInviteResumePath, isInviteResumePath } = await import(
      '../src/auth/pendingInviteCookie.js'
    );
    const origin = 'https://play.sxmcards.example';
    const token = 'prod-invite-token';
    const absolute = `${origin}${buildInviteResumePath(token)}`;
    expect(safeReturnTo(origin, absolute)).toBe(`/join-table?token=${token}`);
    expect(isInviteResumePath(safeReturnTo(origin, absolute))).toBe(true);
  });
});
