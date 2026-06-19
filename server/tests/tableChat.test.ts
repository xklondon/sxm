import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

import request from 'supertest';
import { createApp } from '../src/app.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { PeopleService } from '../src/people/service.js';
import { TableService } from '../src/tables/service.js';
import { createSessionToken } from '../src/auth/tokens.js';
import { seedHostUser, seedPerson } from './testHelpers.js';
import { resetTableChatStore } from '../src/tables/tableChatStore.js';

function sessionCookie(userId: string, email: string): string {
  return `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${createSessionToken({ userId, email })}`;
}

describe('table chat API', () => {
  beforeEach(() => {
    resetTableChatStore();
  });

  it('shares messages between members on the same table', async () => {
    const { app, store } = createApp();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = await seedHostUser(store, 'host@example.com');
    const guest = await store.createUser('guest@example.com', 'Guest');
    await seedPerson(store, { userId: guest.id, email: 'guest@example.com', role: 'player' });
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
      userId: guest.id,
      displayName: 'Guest',
      tableId: table.id,
      inviteId: invite.id,
      token,
      sessionEmail: 'guest@example.com',
    });

    const hostCookie = sessionCookie(host.id, 'host@example.com');
    const guestCookie = sessionCookie(guest.id, 'guest@example.com');

    const postRes = await request(app)
      .post(`/api/tables/${table.id}/messages`)
      .set('Cookie', hostCookie)
      .send({ senderEmail: 'host@example.com', senderName: 'Host', body: '  hello table  ' });
    expect(postRes.status).toBe(201);
    expect(postRes.body.ok).toBe(true);
    expect(postRes.body.message.body).toBe('hello table');

    const guestView = await request(app)
      .get(`/api/tables/${table.id}/messages`)
      .set('Cookie', guestCookie);
    expect(guestView.status).toBe(200);
    expect(guestView.body.messages).toHaveLength(1);
    expect(guestView.body.messages[0].body).toBe('hello table');
  });

  it('rejects empty messages and scopes messages by table', async () => {
    const { app, store } = createApp();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = await seedHostUser(store, 'host@example.com');
    const tableA = await tables.createTable(host.id, 'Table A');
    const tableB = await tables.createTable(host.id, 'Table B');
    const cookie = sessionCookie(host.id, 'host@example.com');

    const empty = await request(app)
      .post(`/api/tables/${tableA.id}/messages`)
      .set('Cookie', cookie)
      .send({ body: '   ' });
    expect(empty.status).toBe(400);

    await request(app)
      .post(`/api/tables/${tableA.id}/messages`)
      .set('Cookie', cookie)
      .send({ senderName: 'Host', body: 'A only' });
    await request(app)
      .post(`/api/tables/${tableB.id}/messages`)
      .set('Cookie', cookie)
      .send({ senderName: 'Host', body: 'B only' });

    const aMessages = await request(app)
      .get(`/api/tables/${tableA.id}/messages`)
      .set('Cookie', cookie);
    const bMessages = await request(app)
      .get(`/api/tables/${tableB.id}/messages`)
      .set('Cookie', cookie);

    expect(aMessages.body.messages.map((message: { body: string }) => message.body)).toEqual(['A only']);
    expect(bMessages.body.messages.map((message: { body: string }) => message.body)).toEqual(['B only']);
  });

  it('blocks non-members from reading or sending chat', async () => {
    const { app, store } = createApp();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = await seedHostUser(store, 'host@example.com');
    const outsider = await store.createUser('outsider@example.com', 'Outsider');
    const table = await tables.createTable(host.id, 'Host');
    const outsiderCookie = sessionCookie(outsider.id, 'outsider@example.com');

    const readRes = await request(app)
      .get(`/api/tables/${table.id}/messages`)
      .set('Cookie', outsiderCookie);
    expect(readRes.status).toBe(403);

    const postRes = await request(app)
      .post(`/api/tables/${table.id}/messages`)
      .set('Cookie', outsiderCookie)
      .send({ body: 'nope' });
    expect(postRes.status).toBe(403);
  });
});
