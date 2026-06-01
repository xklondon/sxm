import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { PeopleService } from '../src/people/service.js';
import { TableService } from '../src/tables/service.js';
import { AuthService } from '../src/auth/service.js';
import { createSessionToken } from '../src/auth/tokens.js';
import { seedHostUser, seedPerson } from './testHelpers.js';
import { addSeatAtTable } from '../../src/engine/session/table.js';
import { ensureBoxPositionForPerson } from '../../src/engine/session/playerAssignment.js';

describe('table deal flow', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let tables: TableService;

  beforeEach(() => {
    store = createMemoryStore();
    const people = new PeopleService(store);
    tables = new TableService(store, people);
  });

  it('place valid bet → shuffle → dealCards deals cards', () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const member = store.getMember(table.id, host.id)!;
    const boxId = Object.keys(table.state.players).find(
      (id) => table.state.players[id]?.role === 'box',
    )!;

    tables.applyAction(table.id, host.id, 'placeBet', { boxId, amount: 10 }, table.version);
    const shuffled = tables.applyAction(table.id, host.id, 'shuffleToStart', {}, table.version + 1);
    expect(shuffled.state.tableMeta.shoeStarted).toBe(true);

    const dealt = tables.applyAction(table.id, host.id, 'dealCards', {}, shuffled.version);
    expect(dealt.state.blackjack?.dealerCardIds.length).toBeGreaterThan(0);
    expect(Object.keys(dealt.state.blackjack?.playerHands ?? {}).length).toBeGreaterThan(0);
  });

  it('online round settles server-side and nextRound resets stakes', () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const boxId = Object.keys(table.state.players).find(
      (id) => table.state.players[id]?.role === 'box',
    )!;

    let v = table.version;
    v = tables.applyAction(table.id, host.id, 'placeBet', { boxId, amount: 10 }, v).version;
    v = tables.applyAction(table.id, host.id, 'shuffleToStart', {}, v).version;
    let res = tables.applyAction(table.id, host.id, 'dealCards', {}, v);
    v = res.version;

    let guard = 0;
    while (res.state.blackjack?.status === 'player-turns' && guard < 12) {
      guard += 1;
      res = tables.applyAction(table.id, host.id, 'stand', {}, v);
      v = res.version;
    }

    // Bank turn + settlement resolved server-side — no client-local bank draw.
    expect(res.state.blackjack?.status).toBe('resolved');
    expect(res.state.tableMeta.awaitingNextRound).toBe(true);

    const next = tables.applyAction(table.id, host.id, 'nextRound', {}, v);
    expect(next.state.tableMeta.awaitingNextRound).toBe(false);
    expect(next.state.tableMeta.bettingLocked).toBe(false);
    expect(next.state.tableMeta.boxStakes).toEqual({});
  });

  it('non-host cannot advance to next round', () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const guest = store.createUser('guest@example.com', 'Guest');
    store.addMember({
      tableId: table.id,
      userId: guest.id,
      personId: 'guest-person',
      role: 'player',
      joinedAt: new Date().toISOString(),
    });
    // Force an awaiting-next-round state.
    const awaiting = {
      ...table.state,
      tableMeta: { ...table.state.tableMeta, awaitingNextRound: true },
    } as typeof table.state;
    store.updateTable(table.id, awaiting, table.version);

    expect(() =>
      tables.applyAction(table.id, guest.id, 'nextRound', {}),
    ).toThrow(/host/i);
  });

  it('unauthorized player cannot deal', () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const member = store.getMember(table.id, host.id)!;
    const boxId = Object.keys(table.state.players).find(
      (id) => table.state.players[id]?.role === 'box',
    )!;
    tables.applyAction(table.id, host.id, 'placeBet', { boxId, amount: 10 }, table.version);
    const shuffled = tables.applyAction(table.id, host.id, 'shuffleToStart', {}, table.version + 1);
    const guest = store.createUser('guest@example.com', 'Guest');
    store.addMember({
      tableId: table.id,
      userId: guest.id,
      personId: 'guest-person',
      role: 'player',
      joinedAt: new Date().toISOString(),
    });
    expect(() =>
      tables.applyAction(table.id, guest.id, 'dealCards', {}, shuffled.version),
    ).toThrow(/host/i);
  });

  it('deal rejected without eligible bet', () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    expect(() => tables.applyAction(table.id, host.id, 'dealCards', {}, table.version)).toThrow();
  });

  it('hosted online table skips stake setup overlay', () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    expect(table.state.tableMeta.showStakeSetup).toBe(false);
    expect(table.state.tableMeta.agreement).toBeTruthy();
  });

  it('host can claim free box by first bet on empty slot', () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const emptySlot = table.state.tableMeta.boxSlots.find((s) => !s.playerId)!;

    const bet = tables.applyAction(
      table.id,
      host.id,
      'placeBet',
      { slotNumber: emptySlot.slotNumber, amount: 10 },
      table.version,
    );
    const slot = bet.state.tableMeta.boxSlots.find((s) => s.slotNumber === emptySlot.slotNumber);
    expect(slot?.playerId).toBeTruthy();
    expect(bet.state.tableMeta.boxStakes[slot!.playerId!]?.amount).toBe(10);
  });

  it('cannot bet on another player occupied box', () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const guest = store.createUser('guest@example.com', 'Guest');
    let state = addSeatAtTable(table.state, {
      displayName: 'Guest',
      controllerName: 'Guest',
      role: 'person',
      startingChips: 0,
    });
    const guestPersonId = state.session.playerIds[state.session.playerIds.length - 1]!;
    store.addMember({
      tableId: table.id,
      userId: guest.id,
      personId: guestPersonId,
      role: 'player',
      joinedAt: new Date().toISOString(),
    });
    const guestSlot = state.tableMeta.boxSlots.find((s) => !s.playerId)!;
    state = ensureBoxPositionForPerson(state, guestSlot.slotNumber, guestPersonId);
    const guestBoxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === guestSlot.slotNumber)!.playerId!;
    store.updateTable(table.id, state, table.version);

    expect(() =>
      tables.applyAction(table.id, host.id, 'placeBet', { boxId: guestBoxId, amount: 10 }, table.version),
    ).toThrow(/not authorized/i);
  });
});

describe('invite accept flow', () => {
  beforeEach(() => {
    process.env.ROOT_USER_EMAIL = 'root@example.com';
    process.env.NODE_ENV = 'development';
  });

  it('accept token joins invited user and assigns box', async () => {
    const store = createMemoryStore();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const { joinUrl } = tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const result = tables.acceptInviteByToken(token);
    expect(result.tableId).toBe(table.id);
    expect(result.boxAssigned).toBe(true);
    const guest = store.getUserByEmail('guest@example.com')!;
    expect(store.getMember(table.id, guest.id)).toBeTruthy();
    const person = store.getPersonByEmail('guest@example.com')!;
    expect(person.canPlay).toBe(true);
    expect(person.canOwnTables).toBe(true);
    expect(person.canInvite).toBe(true);
  });

  it('invite token cannot be reused', () => {
    const store = createMemoryStore();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    seedPerson(store, { email: 'guest@example.com', role: 'player', status: 'invited' });
    const { joinUrl } = tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    tables.acceptInviteByToken(token);
    expect(() => tables.acceptInviteByToken(token)).toThrow(/already used/i);
  });

  it('wrong-session user id still accepts invite as invitee', () => {
    const store = createMemoryStore();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const other = store.createUser('other@example.com', 'Other');
    const { joinUrl } = tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const result = tables.acceptInviteByToken(token, other.id);
    expect(result.tableId).toBe(table.id);
    const guest = store.getUserByEmail('guest@example.com')!;
    expect(guest.id).not.toBe(other.id);
    expect(store.getMember(table.id, guest.id)).toBeTruthy();
  });

  it('failed HTTP accept redirects to table not login', async () => {
    const { app, store } = createApp();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const { joinUrl } = tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    tables.acceptInviteByToken(token);
    const res = await request(app)
      .get(`/api/tables/invites/accept?token=${encodeURIComponent(token)}`)
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(`table=${encodeURIComponent(table.id)}`);
    expect(res.headers.location).not.toContain('/login');
    expect(res.headers.location).toContain('inviteError=');
  });

  it('expired invite rejected', () => {
    const store = createMemoryStore();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const { joinUrl } = tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const invite = store.getInviteByToken(token)!;
    store.createInvite({
      ...invite,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(() => tables.acceptInviteByToken(token)).toThrow(/expired/i);
  });

  it('HTTP accept sets session and redirects', async () => {
    const { app, store } = createApp();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const { joinUrl } = tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const res = await request(app)
      .get(`/api/tables/invites/accept?token=${encodeURIComponent(token)}`)
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(`table=${encodeURIComponent(table.id)}`);
    expect(res.headers['set-cookie']).toBeTruthy();
  });

  it('HTTP accept with wrong session clears host and accepts invitee', async () => {
    const { app, store } = createApp();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const { joinUrl } = tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const hostCookie = `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${createSessionToken({ userId: host.id, email: 'host@example.com' })}`;
    const res = await request(app)
      .get(`/api/tables/invites/accept?token=${encodeURIComponent(token)}`)
      .set('Cookie', hostCookie)
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(`table=${encodeURIComponent(table.id)}`);
    expect(res.headers.location).not.toContain('/login');
    const guest = store.getUserByEmail('guest@example.com')!;
    expect(store.getMember(table.id, guest.id)).toBeTruthy();
  });

  it('online action sequence uses table version for deal', async () => {
    const { app, store } = createApp();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const boxId = Object.keys(table.state.players).find(
      (id) => table.state.players[id]?.role === 'box',
    )!;
    const cookie = `${process.env.SESSION_COOKIE_NAME ?? 'sxmcards_session'}=${createSessionToken({ userId: host.id, email: 'host@example.com' })}`;

    const betRes = await request(app)
      .post(`/api/tables/${table.id}/actions`)
      .set('Cookie', cookie)
      .send({ type: 'placeBet', payload: { boxId, amount: 10 }, expectedVersion: table.version });
    expect(betRes.status).toBe(200);
    const afterBet = betRes.body.version as number;

    const shuffleRes = await request(app)
      .post(`/api/tables/${table.id}/actions`)
      .set('Cookie', cookie)
      .send({ type: 'shuffleToStart', payload: {}, expectedVersion: afterBet });
    expect(shuffleRes.status).toBe(200);
    const afterShuffle = shuffleRes.body.version as number;

    const dealRes = await request(app)
      .post(`/api/tables/${table.id}/actions`)
      .set('Cookie', cookie)
      .send({ type: 'dealCards', payload: {}, expectedVersion: afterShuffle });
    expect(dealRes.status).toBe(200);
    expect(dealRes.body.state.blackjack.dealerCardIds.length).toBeGreaterThan(0);

    const staleDeal = await request(app)
      .post(`/api/tables/${table.id}/actions`)
      .set('Cookie', cookie)
      .send({ type: 'dealCards', payload: {}, expectedVersion: afterShuffle });
    expect(staleDeal.status).toBe(409);
  });

  it('invite link uses accept endpoint', () => {
    const store = createMemoryStore();
    const people = new PeopleService(store);
    const tables = new TableService(store, people);
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const { joinUrl } = tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    expect(joinUrl).toContain('/api/tables/invites/accept?token=');
  });
});

describe('placeBet target resolution (server)', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let tables: TableService;

  beforeEach(() => {
    store = createMemoryStore();
    const people = new PeopleService(store);
    tables = new TableService(store, people);
  });

  it('rejects placeBet with unknown boxId (Box not found regression)', () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    expect(() =>
      tables.applyAction(table.id, host.id, 'placeBet', { boxId: 'nonexistent-box-id', amount: 10 }, table.version),
    ).toThrow(/Box not found/);
  });

  it('accepts placeBet on empty slot via slotNumber and materializes the box', () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const result = tables.applyAction(
      table.id,
      host.id,
      'placeBet',
      { slotNumber: 1, amount: 10 },
      table.version,
    );
    const slot = result.state.tableMeta.boxSlots.find((s) => s.slotNumber === 1);
    expect(slot?.playerId).toBeTruthy();
    expect(result.state.tableMeta.boxStakes[slot!.playerId!]?.amount).toBe(10);
  });
});
