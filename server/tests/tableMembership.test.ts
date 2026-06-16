import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

import { createMemoryStore } from '../src/store/memoryStore.js';
import { PeopleService } from '../src/people/service.js';
import { TableService } from '../src/tables/service.js';
import { seedHostUser } from './testHelpers.js';
import { getBlackjackProtocolPhase } from '../../src/engine/blackjack/protocol.js';
import { addSeatAtTable } from '../../src/engine/session/table.js';

const CHALLENGE_SETUP = {
  stakeDescription: 'Challenge rematch',
  seatChips: 500,
  bankChips: 500,
  bankerMode: 'self' as const,
  bankerName: '',
  controllerName: 'Host',
  controllerEmail: 'host@example.com',
  protocolId: 'las-vegas-house',
  naturalDealing: false,
  dealSpeedPreset: 'normal' as const,
  cardTimerPreset: 0,
  bankDrawAuto: true,
  tableMode: 'challenge' as const,
};

describe('table membership stability', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let tables: TableService;

  beforeEach(() => {
    store = createMemoryStore();
    tables = new TableService(store, new PeopleService(store));
  });

  async function inviteGuest(tableId: string, hostId: string) {
    const { joinUrl } = await tables.createInvite({
      tableId,
      userId: hostId,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    await tables.acceptInviteByToken(token);
    return store.getUserByEmail('guest@example.com')!;
  }

  it('host create table creates member and survives reload-style lookup', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host', undefined, host.email);
    expect(store.getMember(table.id, host.id)?.role).toBe('host');

    store.getMembers(table.id).splice(0, store.getMembers(table.id).length);
    const personId = await tables.getMemberPersonIdForSession(table.id, host.id, host.email);
    expect(personId).toBe(table.state.tableMeta.ownerPersonId);
    expect(store.getMember(table.id, host.id)?.role).toBe('host');
  });

  it('invite accept creates member; invitee can placeBet and hit on assigned box', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host', undefined, host.email);
    const guest = await inviteGuest(table.id, host.id);
    let current = store.getTable(table.id)!;
    const guestPersonId = store.getMember(table.id, guest.id)!.personId;
    const guestBoxId = current.state.tableMeta.boxSlots.find(
      (s) => s.nativeAssignedPersonId === guestPersonId,
    )!.playerId!;

    let v = current.version;
    v = (await tables.applyAction(table.id, guest.id, 'placeBet', { boxId: guestBoxId, amount: 10 }, v, guest.email)).version;
    v = (await tables.applyAction(table.id, host.id, 'shuffleToStart', {}, v, host.email)).version;
    const dealt = await tables.applyAction(table.id, host.id, 'dealCards', {}, v, host.email);

    let state = dealt.state;
    let version = dealt.version;
    let guard = 0;
    while (guard < 12 && getBlackjackProtocolPhase(state) === 'player') {
      const active = state.blackjack?.activeHandKey;
      const boxId = active?.split(':')[0];
      const callerPersonId = boxId
        ? state.tableMeta.boxSlots.find((s) => s.playerId === boxId)?.nativeAssignedPersonId
        : null;
      const actorId = callerPersonId === guestPersonId ? guest.id : host.id;
      const actorEmail = callerPersonId === guestPersonId ? guest.email : host.email;
      const result = await tables.applyAction(table.id, actorId, 'stand', {}, version, actorEmail);
      state = result.state;
      version = result.version;
      guard += 1;
    }

    expect(store.getMember(table.id, guest.id)).toBeTruthy();
  });

  it('repairs missing host member before resetTable and syncs owner person id', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host', undefined, host.email);
    store.getMembers(table.id).splice(0, store.getMembers(table.id).length);

    const reset = await tables.applyAction(
      table.id,
      host.id,
      'resetTable',
      CHALLENGE_SETUP,
      table.version,
      host.email,
    );
    expect(reset.state.tableMeta.tableMode).toBe('challenge');
    expect(store.getMember(table.id, host.id)?.personId).toBe(reset.state.tableMeta.ownerPersonId);
  });

  it('host as bank + player box stays member through challenge configureTable', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host', undefined, host.email);
    const configured = await tables.applyAction(
      table.id,
      host.id,
      'configureTable',
      CHALLENGE_SETUP,
      table.version,
      host.email,
    );
    const hostPersonId = store.getMember(table.id, host.id)!.personId;
    expect(hostPersonId).toBe(configured.state.tableMeta.ownerPersonId);

    const hostBox = configured.state.tableMeta.boxSlots.find((s) => !s.playerId);
    expect(hostBox).toBeTruthy();
    const bet = await tables.applyAction(
      table.id,
      host.id,
      'placeBet',
      { slotNumber: hostBox!.slotNumber, amount: 25 },
      configured.version,
      host.email,
    );
    expect(bet.state.tableMeta.boxStakes).toBeTruthy();
  });

  it('syncs stale host member personId when ownerPersonId changes in state', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host', undefined, host.email);
    const stalePersonId = store.getMember(table.id, host.id)!.personId;
    let state = store.getTable(table.id)!.state;
    state = addSeatAtTable(state, {
      displayName: 'Host Replacement',
      controllerName: 'Host Replacement',
      role: 'person',
      startingChips: 0,
    });
    const replacementPersonId = state.session.playerIds[state.session.playerIds.length - 1]!;
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        ownerPersonId: replacementPersonId,
      },
    };
    store.updateTable(table.id, state, table.version + 1);

    const repaired = await tables.getMemberPersonIdForSession(table.id, host.id, host.email);
    expect(repaired).toBe(replacementPersonId);
    expect(repaired).not.toBe(stalePersonId);
    expect(store.getMembers(table.id).filter((m) => m.userId === host.id)).toHaveLength(1);
  });

  it('repairs missing invitee member from seated game state', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host', undefined, host.email);
    const guest = await inviteGuest(table.id, host.id);
    const guestPersonId = store.getMember(table.id, guest.id)!.personId;
    store.getMembers(table.id).splice(
      store.getMembers(table.id).findIndex((m) => m.userId === guest.id),
      1,
    );
    expect(store.getMember(table.id, guest.id)).toBeNull();

    const repaired = await tables.getMemberPersonIdForSession(table.id, guest.id, guest.email);
    expect(repaired).toBe(guestPersonId);
    expect(store.getMembers(table.id).filter((m) => m.userId === guest.id)).toHaveLength(1);
  });

  it('non-member placeBet returns membership error', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host', undefined, host.email);
    const outsider = await store.createUser('outsider@example.com', 'Outsider');
    const boxId = Object.keys(table.state.players).find((id) => table.state.players[id]?.role === 'box')!;

    await expect(
      tables.applyAction(table.id, outsider.id, 'placeBet', { boxId, amount: 10 }, table.version, outsider.email),
    ).rejects.toThrow(/Not a member/i);
  });

  it('non-owner resetTable is forbidden without membership repair for outsider', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host', undefined, host.email);
    const guest = await inviteGuest(table.id, host.id);
    const current = store.getTable(table.id)!;

    await expect(
      tables.applyAction(table.id, guest.id, 'resetTable', CHALLENGE_SETUP, current.version, guest.email),
    ).rejects.toThrow(/host/i);
  });

  it('does not create duplicate members on repeated join repair', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host', undefined, host.email);
    const guest = await inviteGuest(table.id, host.id);

    await tables.getMemberPersonIdForSession(table.id, guest.id, guest.email);
    await tables.getMemberPersonIdForSession(table.id, guest.id, guest.email);
    expect(store.getMembers(table.id).filter((m) => m.userId === guest.id)).toHaveLength(1);
  });
});
