import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

import request from 'supertest';

import { createApp } from '../src/app.js';

import { createSessionToken } from '../src/auth/tokens.js';

import { createMemoryStore } from '../src/store/memoryStore.js';

import { AuthService } from '../src/auth/service.js';

import { TableService } from '../src/tables/service.js';

import { PeopleService } from '../src/people/service.js';

import { seedHostUser, seedPerson } from './testHelpers.js';



describe('SXMCards multiplayer API', () => {

  let store: ReturnType<typeof createMemoryStore>;

  let auth: AuthService;

  let tables: TableService;



  beforeEach(() => {

    store = createMemoryStore();

    const people = new PeopleService(store);

    auth = new AuthService(store, people);

    tables = new TableService(store, people);

    seedPerson(store, { email: 'player@example.com', role: 'player', status: 'invited' });

  });



  it('magic link token creates session', async () => {

    const { devLink } = await auth.requestMagicLink('player@example.com');

    expect(devLink).toBeTruthy();

    const token = new URL(devLink!, 'http://localhost:5173').searchParams.get('token')!;

    const session = auth.verifyMagicLink(token);

    expect(createSessionToken({ userId: 'x', email: 'player@example.com' })).toBeTruthy();

    expect(session.length).toBeGreaterThan(10);

  });



  it('expired/used token rejected', async () => {
    seedPerson(store, { email: 'a@example.com', role: 'player', status: 'invited' });
    const { devLink } = await auth.requestMagicLink('a@example.com');
    const token = new URL(devLink!, 'http://localhost:5173').searchParams.get('token')!;

    auth.verifyMagicLink(token);

    expect(() => auth.verifyMagicLink(token)).toThrow(/already used/i);

  });



  it('invite link joins correct table after login flow', async () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    seedPerson(store, { email: 'guest@example.com', role: 'player', status: 'invited' });
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const invite = store.getInviteByToken(token)!;
    const guest = store.createUser('guest@example.com', 'Guest');
    const join = tables.joinTable({
      userId: guest.id,
      displayName: 'Guest',
      tableId: table.id,
      inviteId: invite.id,
      token,
    });

    expect(join.id).toBe(table.id);

    expect(store.getMember(table.id, guest.id)).toBeTruthy();

  });



  it('non-member cannot placeBet on host box', () => {

    const host = seedHostUser(store, 'host@example.com');

    const table = tables.createTable(host.id, 'Host');

    const hostBoxId = Object.keys(table.state.players).find(

      (id) => table.state.players[id]?.role === 'box',

    )!;



    store.addMember({

      tableId: table.id,

      userId: 'other-user',

      personId: 'fake-person',

      role: 'player',

      joinedAt: new Date().toISOString(),

    });



    expect(() =>

      tables.applyAction(table.id, 'other-user', 'placeBet', {

        boxId: hostBoxId,

        amount: 10,

      }),

    ).toThrow(/Not authorized/i);

  });



  it('ignores client-sent handKey and resolves on the authoritative active hand', () => {

    const host = seedHostUser(store, 'host@example.com');

    const table = tables.createTable(host.id, 'Host');

    let state = table.state;

    state = {

      ...state,

      blackjack: {

        status: 'player-turns',

        // Active hand belongs to a box the host does not own/call.

        activeHandKey: 'box-a:0',

        playerHands: {

          'box-a:0': {

            cardIds: ['c1', 'c2'],

            actionStatus: 'acting',

            stakeAmount: 10,

            isDoubled: false,

            isSplitChild: false,

          },

        },

        dealerCardIds: ['d1'],

        dealerHoleHidden: true,

        insuranceOffered: false,

        evenMoneyOfferHandKey: null,

        bankDrawMode: 'auto',

        initialDealMode: 'auto',

      },

      tableMeta: { ...state.tableMeta, bettingLocked: true, shoeStarted: true },

    } as typeof state;

    store.updateTable(table.id, state, table.version);



    // A foreign payload.handKey must be ignored: authority keys off the

    // authoritative active hand, so this is rejected by box ownership — never

    // with a render-time "stale turn" error.

    expect(() =>

      tables.applyAction(table.id, host.id, 'hit', { handKey: 'box-b:0' }),

    ).toThrow(/Not box owner/i);



    expect(() =>

      tables.applyAction(table.id, host.id, 'hit', { handKey: 'box-b:0' }),

    ).not.toThrow(/Stale turn/i);

  });



  it('stale table version rejected', () => {

    const host = seedHostUser(store, 'host@example.com');

    const table = tables.createTable(host.id, 'Host');

    expect(() =>

      tables.applyAction(table.id, host.id, 'placeBet', { slotNumber: 1, amount: 10 }, 9999),

    ).toThrow(/Stale table version/i);

  });



  it('rejects personal ledger before game end', () => {

    const host = seedHostUser(store, 'host@example.com');

    const table = tables.createTable(host.id, 'Host');

    expect(() =>

      tables.applyAction(table.id, host.id, 'addGameToPersonalLedger', {}),

    ).toThrow(/Game must end/i);

  });

});



describe('HTTP auth guards', () => {

  it('unauthenticated user blocked from table', async () => {

    const { app } = createApp();

    const res = await request(app).get('/api/tables/fake-table-id');

    expect(res.status).toBe(401);

  });

});



describe('production origin guard', () => {

  it('no localhost invite link in production config helper', async () => {

    const prevEnv = process.env.NODE_ENV;

    const prevOrigin = process.env.PUBLIC_ORIGIN;

    process.env.NODE_ENV = 'production';

    process.env.PUBLIC_ORIGIN = 'https://play.sxmcards.example';

    vi.resetModules();

    const { assertProductionOrigin: assertOk } = await import('../src/config.js');

    expect(() => assertOk()).not.toThrow();

    process.env.PUBLIC_ORIGIN = 'http://localhost:5173';

    vi.resetModules();

    const { assertProductionOrigin: assertBad } = await import('../src/config.js');

    expect(() => assertBad()).toThrow();

    process.env.NODE_ENV = prevEnv;

    process.env.PUBLIC_ORIGIN = prevOrigin;

    vi.resetModules();

  });

});

