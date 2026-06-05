import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

import { createMemoryStore } from '../src/store/memoryStore.js';
import { PeopleService } from '../src/people/service.js';
import { TableService } from '../src/tables/service.js';
import { seedHostUser } from './testHelpers.js';
import { TABLE_RESET_LEDGER_MESSAGE } from '../../src/engine/session/tableReset.js';
import { hasPersonalLedgerEntryForTable } from '../../src/engine/scoreLedger/scoreLedger.js';

describe('resetTable action', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let tables: TableService;

  beforeEach(() => {
    store = createMemoryStore();
    const people = new PeopleService(store);
    tables = new TableService(store, people);
  });

  it('host can reset mid-game; non-host receives 403', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const guest = await store.createUser('guest@example.com', 'Guest');
    store.addMember({
      tableId: table.id,
      userId: guest.id,
      personId: 'guest-person',
      role: 'player',
      joinedAt: new Date().toISOString(),
    });

    const hostView = await tables.getTableForUser(table.id, host.id);
    const boxId = Object.keys(hostView.state.players).find(
      (id) => hostView.state.players[id]?.role === 'box',
    )!;
    let v = hostView.version;
    v = (await tables.applyAction(table.id, host.id, 'placeBet', { boxId, amount: 10 }, v)).version;

    const payload = {
      stakeDescription: 'Rematch',
      seatChips: 500,
      bankChips: 500,
      bankerMode: 'bot',
      bankerName: '',
      controllerName: 'Host',
      controllerEmail: '',
      protocolId: 'las-vegas-house',
      naturalDealing: false,
      dealSpeedPreset: 'normal',
      cardTimerPreset: 0,
      bankDrawAuto: true,
    };

    const reset = await tables.applyAction(table.id, host.id, 'resetTable', payload, v);
    expect(reset.state.session.id).toBe(table.id);
    expect(reset.state.blackjack).toBeNull();
    expect(reset.state.deck).toBeNull();
    expect(reset.state.tableMeta.agreement?.stakeDescription).toBe('Rematch');
    expect(
      reset.state.ledger.entries.some((e) => e.description.includes(TABLE_RESET_LEDGER_MESSAGE)),
    ).toBe(true);
    expect(hasPersonalLedgerEntryForTable(reset.state.session.id)).toBe(false);

    await expect(tables.applyAction(table.id, guest.id, 'resetTable', payload, reset.version)).rejects.toThrow(/host/i);
  });
});
