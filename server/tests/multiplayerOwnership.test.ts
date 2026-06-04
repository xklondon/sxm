import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

import { createMemoryStore } from '../src/store/memoryStore.js';
import { PeopleService } from '../src/people/service.js';
import { TableService } from '../src/tables/service.js';
import { seedHostUser } from './testHelpers.js';
import { addSeatAtTable } from '../../src/engine/session/table.js';
import { allocateChipsToBankrollOwner } from '../../src/engine/session/allocation.js';
import { derivePlayerBalanceFromLedger } from '../../src/engine/ledger/ledger.js';
import { getAvailableChipsForBankrollOwner } from '../../src/engine/session/bankroll.js';
import {
  ensureBoxPositionForPerson,
  getCallerPersonIdForBox,
} from '../../src/engine/session/playerAssignment.js';
import { getBlackjackProtocolPhase } from '../../src/engine/blackjack/protocol.js';

describe('multiplayer ownership (server authority)', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let tables: TableService;

  beforeEach(() => {
    store = createMemoryStore();
    const people = new PeopleService(store);
    tables = new TableService(store, people);
  });

  it('invited player accept assigns next free box', async () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'guest@example.com',
      invitedName: 'Guest',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    const result = tables.acceptInviteByToken(token);
    expect(result.boxAssigned).toBe(true);

    const guest = store.getUserByEmail('guest@example.com')!;
    const member = store.getMember(table.id, guest.id)!;
    const updated = store.getTable(table.id)!;
    const assignedSlot = updated.state.tableMeta.boxSlots.find(
      (s) => s.nativeAssignedPersonId === member.personId,
    );
    expect(assignedSlot).toBeTruthy();

    const guestPersonId = member.personId;
    expect(derivePlayerBalanceFromLedger(guestPersonId, updated.state.ledger)).toBe(500);
    expect(getAvailableChipsForBankrollOwner(updated.state, guestPersonId)).toBe(500);
    expect(updated.state.tableMeta.tableNotice?.message).toMatch(/Guest joined the table on Box \d+\./);

    const boxId = assignedSlot!.playerId!;
    const bet = tables.applyAction(
      table.id,
      guest.id,
      'placeBet',
      { boxId, amount: 5 },
      updated.version,
    );
    expect(bet.state.tableMeta.boxStakes[boxId]?.amount).toBe(5);
    expect(getAvailableChipsForBankrollOwner(bet.state, guestPersonId)).toBe(495);
  });

  it('host assignChips syncs balance used for betting', async () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const { joinUrl } = await tables.createInvite({
      tableId: table.id,
      userId: host.id,
      invitedEmail: 'low@example.com',
      invitedName: 'Low',
    });
    const token = new URL(joinUrl).searchParams.get('token')!;
    tables.acceptInviteByToken(token);
    const guest = store.getUserByEmail('low@example.com')!;
    let current = store.getTable(table.id)!;
    const guestPersonId = store.getMember(table.id, guest.id)!.personId;

    current = tables.applyAction(
      table.id,
      host.id,
      'assignChips',
      { recipientId: guestPersonId, amount: 200, reason: 'top-up' },
      current.version,
    );
    expect(getAvailableChipsForBankrollOwner(current.state, guestPersonId)).toBe(700);

    const boxId = current.state.tableMeta.boxSlots.find(
      (s) => s.nativeAssignedPersonId === guestPersonId,
    )!.playerId!;
    const bet = tables.applyAction(
      table.id,
      guest.id,
      'placeBet',
      { boxId, amount: 10 },
      current.version,
    );
    expect(bet.state.tableMeta.boxStakes[boxId]?.amount).toBe(10);
  });

  it('assigned box: non-owner can bet but cannot hit', () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const hostPersonId = store.getMember(table.id, host.id)!.personId;
    const hostBoxId = Object.keys(table.state.players).find(
      (id) => table.state.players[id]?.role === 'box',
    )!;

    const guest = store.createUser('guest@example.com', 'Guest');
    let state = addSeatAtTable(table.state, {
      displayName: 'Guest',
      controllerName: 'Guest',
      role: 'person',
      startingChips: 500,
    });
    const guestPersonId = state.session.playerIds[state.session.playerIds.length - 1]!;
    state = allocateChipsToBankrollOwner(state, {
      bankrollOwnerId: guestPersonId,
      amount: 500,
      reason: 'initial-player',
      source: 'setup',
    });
    store.addMember({
      tableId: table.id,
      userId: guest.id,
      personId: guestPersonId,
      role: 'player',
      joinedAt: new Date().toISOString(),
    });
    store.updateTable(table.id, state, table.version);

    const betResult = tables.applyAction(
      table.id,
      guest.id,
      'placeBet',
      { boxId: hostBoxId, amount: 10 },
      table.version,
    );
    expect(betResult.state.tableMeta.boxStakes[hostBoxId]?.amount).toBe(10);
    expect(getCallerPersonIdForBox(betResult.state, hostBoxId)).toBe(hostPersonId);

    const handKey = `${hostBoxId}:0`;
    const playerTurnState = {
      ...betResult.state,
      blackjack: {
        status: 'player-turns',
        activeHandKey: handKey,
        playerHands: {
          [handKey]: {
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
      tableMeta: {
        ...betResult.state.tableMeta,
        bettingLocked: true,
        shoeStarted: true,
      },
    } as typeof betResult.state;

    store.updateTable(table.id, playerTurnState, betResult.version);
    const updated = store.getTable(table.id)!;

    expect(getBlackjackProtocolPhase(updated.state)).toBe('player');

    expect(() => tables.applyAction(table.id, guest.id, 'hit', {}, updated.version)).toThrow(
      /Not box owner/i,
    );
  });

  it('unassigned box: second bettor cannot take insurance for the box', () => {
    const host = seedHostUser(store);
    const table = tables.createTable(host.id, 'Host');
    const hostPersonId = store.getMember(table.id, host.id)!.personId;

    const guest = store.createUser('guest@example.com', 'Guest');
    let state = addSeatAtTable(table.state, {
      displayName: 'Guest',
      controllerName: 'Guest',
      role: 'person',
      startingChips: 500,
    });
    const guestPersonId = state.session.playerIds[state.session.playerIds.length - 1]!;
    state = allocateChipsToBankrollOwner(state, {
      bankrollOwnerId: guestPersonId,
      amount: 500,
      reason: 'initial-player',
      source: 'setup',
    });
    store.addMember({
      tableId: table.id,
      userId: guest.id,
      personId: guestPersonId,
      role: 'player',
      joinedAt: new Date().toISOString(),
    });

    const emptySlot = state.tableMeta.boxSlots.find((s) => !s.playerId)!;
    state = ensureBoxPositionForPerson(state, emptySlot.slotNumber, hostPersonId);
    const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === emptySlot.slotNumber)!.playerId!;
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxSlots: state.tableMeta.boxSlots.map((s) =>
          s.playerId === boxId ? { ...s, nativeAssignedPersonId: null } : s,
        ),
      },
    };
    store.updateTable(table.id, state, table.version);

    let v = store.getTable(table.id)!.version;
    v = tables.applyAction(table.id, host.id, 'placeBet', { boxId, amount: 10 }, v).version;
    v = tables.applyAction(table.id, guest.id, 'placeBet', { boxId, amount: 5 }, v).version;
    v = tables.applyAction(table.id, host.id, 'shuffleToStart', {}, v).version;
    const dealt = tables.applyAction(table.id, host.id, 'dealCards', {}, v);

    if (getBlackjackProtocolPhase(dealt.state) === 'insurance') {
      expect(() =>
        tables.applyAction(table.id, guest.id, 'takeInsurance', { playerId: boxId }, dealt.version),
      ).toThrow(/Not authorized/i);
    }
  });
});
