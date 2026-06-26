import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

import { createMemoryStore } from '../src/store/memoryStore.js';
import { PeopleService } from '../src/people/service.js';
import { TableService } from '../src/tables/service.js';
import { seedHostUser } from './testHelpers.js';
import type { GameState } from '../../src/types/index.js';
import { appendLedgerEntry } from '../../src/engine/ledger/ledger.js';
import { assertActionAuthorized } from '../src/tables/authority.js';
import { getHoldemPlayerIdForPerson } from '../../src/engine/holdem/holdemTurnAuthority.js';
import { executeHoldemPayout } from '../../src/engine/holdem/showdownPayout.js';
import { createEmptyHoldemRound } from '../../src/types/holdem.js';
import { createEmptyLedger } from '../../src/types/ledger.js';
import { createDefaultPokerTableConfig } from '../../src/types/poker.js';

function fundHoldemSeats(state: GameState): GameState {
  let next = state;
  for (const playerId of next.session.playerIds) {
    const result = appendLedgerEntry(next.session, next.ledger, {
      playerId,
      entryType: 'buy-in',
      amount: 500,
      description: 'Test buy-in',
      roundNumber: next.session.currentRound,
    });
    next = { ...next, session: result.session, ledger: result.ledger };
  }
  return next;
}

const HOLDEM_CONFIGURE_PAYLOAD = {
  stakeDescription: 'Practice',
  seatChips: 500,
  bankChips: 500,
  bankerMode: 'self' as const,
  bankerName: 'Host',
  controllerName: 'Host',
  controllerEmail: 'host@example.com',
  protocolId: 'texas-holdem',
  gameType: 'texas-holdem',
  cardGame: 'holdem',
  naturalDealing: false,
  dealSpeedPreset: 'normal' as const,
  cardTimerPreset: 0,
  bankDrawAuto: true,
  tableMode: 'practice' as const,
  smallBlind: 5,
  bigBlind: 10,
  virtualPlayerCount: 1,
};

const HOLDEM_CHALLENGE_CONFIGURE_PAYLOAD = {
  ...HOLDEM_CONFIGURE_PAYLOAD,
  tableMode: 'challenge' as const,
  stakeDescription: '$100 challenge',
  totalChallengeValue: 100,
  virtualPlayerCount: undefined,
};

function setPlayerBalance(state: GameState, playerId: string, amount: number): GameState {
  if (amount <= 0) {
    return state;
  }
  const result = appendLedgerEntry(state.session, state.ledger, {
    playerId,
    entryType: 'buy-in',
    amount,
    description: 'Test buy-in',
    roundNumber: state.session.currentRound,
  });
  return { ...state, session: result.session, ledger: result.ledger };
}

function asChallengeTable(state: GameState): GameState {
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      tableMode: 'challenge',
      pokerConfig: createDefaultPokerTableConfig({
        mode: 'challenge',
        totalChallengeValue: 100,
        startingStack: 500,
        smallBlind: 5,
        bigBlind: 10,
        handNumber: 0,
      }),
    },
    holdem: state.holdem
      ? { ...state.holdem, status: 'resolved' as const }
      : undefined,
  };
}

describe('holdem table actions', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let tables: TableService;

  beforeEach(() => {
    store = createMemoryStore();
    const people = new PeopleService(store);
    tables = new TableService(store, people);
  });

  async function configureHoldemTable(hostId: string, tableId: string, version: number) {
    const configured = await tables.applyAction(
      tableId,
      hostId,
      'configureTable',
      HOLDEM_CONFIGURE_PAYLOAD,
      version,
    );
    const funded = fundHoldemSeats(configured.state);
    store.updateTable(tableId, funded, configured.version);
    return { ...configured, state: funded };
  }

  it('non-poker table rejects holdem action', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    await expect(
      tables.applyAction(table.id, host.id, 'holdemFold', {}, table.version),
    ).rejects.toThrow(/Texas Hold'em/i);
  });

  it('non-owner cannot start hand (authority)', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);
    expect(() =>
      assertActionAuthorized(configured.state, {
        tableId: table.id,
        userId: 'guest-user',
        personId: 'guest-person',
        action: 'startHoldemHand',
        payload: {},
      }),
    ).toThrow(/host/i);
  });

  it('unseated person cannot fold (authority)', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);
    const withRound = {
      ...configured.state,
      holdem: {
        status: 'preflop' as const,
        bettingStreet: 'preflop' as const,
        smallBlind: 5,
        bigBlind: 10,
        communityCardIds: [],
        pot: 15,
        currentBet: 10,
        dealerButtonPlayerId: configured.state.session.playerIds[0]!,
        smallBlindPlayerId: configured.state.session.playerIds[0]!,
        bigBlindPlayerId: configured.state.session.playerIds[1] ?? configured.state.session.playerIds[0]!,
        activePlayerId: configured.state.session.playerIds[0]!,
        playerStates: {},
        actionLog: [],
        winners: [],
        resultSummary: '',
        lastRaiseSize: 10,
      },
    };
    expect(() =>
      assertActionAuthorized(withRound, {
        tableId: table.id,
        userId: 'guest-user',
        personId: 'guest-person',
        action: 'holdemFold',
        payload: {},
      }),
    ).toThrow(/not seated/i);
  });

  it('owner can shuffle and start hand', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    let configured = await configureHoldemTable(host.id, table.id, table.version);
    let v = configured.version;

    const shuffled = await tables.applyAction(table.id, host.id, 'holdemShuffleDeck', {}, v);
    expect(shuffled.state.deck).toBeTruthy();
    v = shuffled.version;

    const started = await tables.applyAction(table.id, host.id, 'startHoldemHand', {}, v);
    expect(started.state.holdem?.status).toBe('preflop');
  });

  it('start hand blocked while hand active', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    let configured = await configureHoldemTable(host.id, table.id, table.version);
    let v = configured.version;
    v = (await tables.applyAction(table.id, host.id, 'holdemShuffleDeck', {}, v)).version;
    const started = await tables.applyAction(table.id, host.id, 'startHoldemHand', {}, v);

    await expect(
      tables.applyAction(table.id, host.id, 'startHoldemHand', {}, started.version),
    ).rejects.toThrow(/already in progress/i);
  });

  it('out-of-turn player cannot fold (authority)', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);
    const ownerPersonId = configured.state.tableMeta.ownerPersonId!;
    const ownerPlayerId = getHoldemPlayerIdForPerson(configured.state, ownerPersonId)!;
    const otherPlayerId = configured.state.session.playerIds.find((id) => id !== ownerPlayerId)!;
    const withRound = {
      ...configured.state,
      holdem: {
        status: 'preflop' as const,
        bettingStreet: 'preflop' as const,
        smallBlind: 5,
        bigBlind: 10,
        communityCardIds: [],
        pot: 15,
        currentBet: 10,
        dealerButtonPlayerId: ownerPlayerId,
        smallBlindPlayerId: ownerPlayerId,
        bigBlindPlayerId: otherPlayerId,
        activePlayerId: ownerPlayerId,
        playerStates: {},
        actionLog: [],
        winners: [],
        resultSummary: '',
        lastRaiseSize: 10,
      },
    };
    expect(() =>
      assertActionAuthorized(withRound, {
        tableId: table.id,
        userId: 'guest-user',
        personId: otherPlayerId,
        action: 'holdemFold',
        payload: {},
      }),
    ).toThrow(/Not your turn|not seated/i);
  });

  it('invalid bet amount returns error without persisting stale version bump on failure', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    let configured = await configureHoldemTable(host.id, table.id, table.version);
    let v = configured.version;
    v = (await tables.applyAction(table.id, host.id, 'holdemShuffleDeck', {}, v)).version;
    const started = await tables.applyAction(table.id, host.id, 'startHoldemHand', {}, v);
    const before = store.getTable(table.id)!;

    await expect(
      tables.applyAction(table.id, host.id, 'holdemBet', { amount: 0 }, started.version),
    ).rejects.toThrow(/amount must be a positive number/i);

    const after = store.getTable(table.id)!;
    expect(after.version).toBe(before.version);
    expect(after.state.holdem?.status).toBe(before.state.holdem?.status);
  });

  it('non-poker table rejects updateHoldemBlinds', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    await expect(
      tables.applyAction(
        table.id,
        host.id,
        'updateHoldemBlinds',
        { smallBlind: 5, bigBlind: 10 },
        table.version,
      ),
    ).rejects.toThrow(/Texas Hold'em/i);
  });

  it('non-owner cannot update blinds', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);
    expect(() =>
      assertActionAuthorized(configured.state, {
        tableId: table.id,
        userId: 'guest-user',
        personId: 'guest-person',
        action: 'updateHoldemBlinds',
        payload: { smallBlind: 10, bigBlind: 20 },
      }),
    ).toThrow(/host/i);
  });

  it('owner can update blinds before hand', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);

    const updated = await tables.applyAction(
      table.id,
      host.id,
      'updateHoldemBlinds',
      { smallBlind: 10, bigBlind: 20 },
      configured.version,
    );

    expect(updated.state.tableMeta.pokerConfig?.smallBlind).toBe(10);
    expect(updated.state.tableMeta.pokerConfig?.bigBlind).toBe(20);
    expect(updated.state.holdemSettings?.smallBlind).toBe(10);
    expect(updated.state.holdemSettings?.bigBlind).toBe(20);
  });

  it('owner cannot update blinds mid-hand', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    let configured = await configureHoldemTable(host.id, table.id, table.version);
    let v = configured.version;
    v = (await tables.applyAction(table.id, host.id, 'holdemShuffleDeck', {}, v)).version;
    const started = await tables.applyAction(table.id, host.id, 'startHoldemHand', {}, v);

    await expect(
      tables.applyAction(
        table.id,
        host.id,
        'updateHoldemBlinds',
        { smallBlind: 10, bigBlind: 20 },
        started.version,
      ),
    ).rejects.toThrow(/before a hand starts/i);
  });

  it('invalid blinds rejected server-side', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);

    await expect(
      tables.applyAction(
        table.id,
        host.id,
        'updateHoldemBlinds',
        { smallBlind: 10, bigBlind: 10 },
        configured.version,
      ),
    ).rejects.toThrow(/Big blind must be greater/i);

    await expect(
      tables.applyAction(
        table.id,
        host.id,
        'updateHoldemBlinds',
        { smallBlind: 0, bigBlind: 10 },
        configured.version,
      ),
    ).rejects.toThrow(/Small blind must be a positive/i);
  });

  it('failed blind update does not mutate table state', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);
    const before = store.getTable(table.id)!;

    await expect(
      tables.applyAction(
        table.id,
        host.id,
        'updateHoldemBlinds',
        { smallBlind: 10, bigBlind: 5 },
        configured.version,
      ),
    ).rejects.toThrow(/Big blind must be greater/i);

    const after = store.getTable(table.id)!;
    expect(after.version).toBe(before.version);
    expect(after.state.tableMeta.pokerConfig?.smallBlind).toBe(5);
    expect(after.state.tableMeta.pokerConfig?.bigBlind).toBe(10);
  });

  it('non-poker table rejects holdemAllIn', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    await expect(
      tables.applyAction(table.id, host.id, 'holdemAllIn', {}, table.version),
    ).rejects.toThrow(/Texas Hold'em/i);
  });

  it('unseated player cannot all-in (authority)', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);
    const withRound = {
      ...configured.state,
      holdem: {
        status: 'preflop' as const,
        bettingStreet: 'preflop' as const,
        smallBlind: 5,
        bigBlind: 10,
        communityCardIds: [],
        pot: 15,
        currentBet: 10,
        dealerButtonPlayerId: configured.state.session.playerIds[0]!,
        smallBlindPlayerId: configured.state.session.playerIds[0]!,
        bigBlindPlayerId: configured.state.session.playerIds[1] ?? configured.state.session.playerIds[0]!,
        activePlayerId: configured.state.session.playerIds[0]!,
        playerStates: {},
        actionLog: [],
        winners: [],
        resultSummary: '',
        lastRaiseSize: 10,
      },
    };
    expect(() =>
      assertActionAuthorized(withRound, {
        tableId: table.id,
        userId: 'guest-user',
        personId: 'guest-person',
        action: 'holdemAllIn',
        payload: {},
      }),
    ).toThrow(/not seated/i);
  });

  it('current actor can all-in before hand mutation', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    let configured = await configureHoldemTable(host.id, table.id, table.version);
    let v = configured.version;
    v = (await tables.applyAction(table.id, host.id, 'holdemShuffleDeck', {}, v)).version;
    const started = await tables.applyAction(table.id, host.id, 'startHoldemHand', {}, v);
    const actor = started.state.holdem?.activePlayerId;
    expect(actor).toBeTruthy();

    const allIn = await tables.applyAction(table.id, host.id, 'holdemAllIn', {}, started.version);
    expect(allIn.state.holdem?.playerStates[actor!]?.actionStatus).toBe('all-in');
    expect(allIn.state.holdem?.sidePots?.length).toBeGreaterThan(0);
  });

  it('failed all-in does not mutate table state', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    let configured = await configureHoldemTable(host.id, table.id, table.version);
    let v = configured.version;
    v = (await tables.applyAction(table.id, host.id, 'holdemShuffleDeck', {}, v)).version;
    const started = await tables.applyAction(table.id, host.id, 'startHoldemHand', {}, v);
    const before = store.getTable(table.id)!;

    expect(() =>
      assertActionAuthorized(started.state, {
        tableId: table.id,
        userId: 'guest-user',
        personId: 'guest-person',
        action: 'holdemAllIn',
        payload: {},
      }),
    ).toThrow(/not seated/i);

    const after = store.getTable(table.id)!;
    expect(after.version).toBe(before.version);
  });

  it('payout reducer output matches fields persisted on holdem round', () => {
    const session = {
      id: 'sess-payout',
      playerIds: ['A', 'B'],
      currentRound: 1,
      status: 'active',
      gameType: 'texas-holdem',
      dealerButtonPlayerId: 'A',
      ledgerEntryIds: [],
    } as import('../../src/types/session.js').GameSession;
    const ledger = createEmptyLedger('sess-payout');
    let round = createEmptyHoldemRound('A', 'A', 'B');
    round = {
      ...round,
      playerStates: {
        A: {
          holeCardIds: [],
          actionStatus: 'active',
          playerBetsThisStreet: 50,
          playerTotalCommitted: 50,
          hasActedThisStreet: true,
        },
        B: {
          holeCardIds: [],
          actionStatus: 'folded',
          playerBetsThisStreet: 50,
          playerTotalCommitted: 50,
          hasActedThisStreet: true,
        },
      },
    };

    const payout = executeHoldemPayout(session, {}, ledger, round, ['A'], {
      reason: 'all others folded',
    });

    expect(payout.round.status).toBe('resolved');
    expect(payout.round.payoutSummary?.length).toBeGreaterThan(0);
    expect(payout.round.sidePotPayouts?.length).toBeGreaterThan(0);
    expect(payout.ledger.entries.some((e) => e.entryType === 'pot-paid')).toBe(true);
  });

  it('10. non-owner cannot end challenge early', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);
    let challenge = asChallengeTable(setPlayerBalance(configured.state, configured.state.session.playerIds[0]!, 900));
    store.updateTable(table.id, challenge, configured.version);

    expect(() =>
      assertActionAuthorized(challenge, {
        tableId: table.id,
        userId: 'guest-user',
        personId: 'guest-person',
        action: 'endHoldemChallenge',
        payload: {},
      }),
    ).toThrow(/host/i);
  });

  it('11. owner can end challenge early when no active hand', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);
    const playerId = configured.state.session.playerIds[0]!;
    let challenge = asChallengeTable(setPlayerBalance(configured.state, playerId, 900));
    store.updateTable(table.id, challenge, configured.version);

    const ended = await tables.applyAction(table.id, host.id, 'endHoldemChallenge', {}, configured.version);
    expect(ended.state.tableMeta.pokerConfig?.challengeStatus).toBe('ended');
    expect(ended.state.tableMeta.pokerConfig?.challengeWinnerSeatId).toBe(playerId);
    expect(ended.state.tableMeta.pokerConfig?.challengeEndReason).toBe('chip-leader');
  });

  it('12. owner cannot end challenge during active hand', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);
    const challenge = asChallengeTable(configured.state);
    const midHand = {
      ...challenge,
      holdem: {
        ...createEmptyHoldemRound(
          challenge.session.playerIds[0]!,
          challenge.session.playerIds[0]!,
          challenge.session.playerIds[1] ?? challenge.session.playerIds[0]!,
        ),
        status: 'preflop' as const,
      },
    };
    store.updateTable(table.id, midHand, configured.version);

    await expect(
      tables.applyAction(table.id, host.id, 'endHoldemChallenge', {}, configured.version),
    ).rejects.toThrow(/active hand/i);
  });

  it('13. early end tie does not mutate state', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);
    const hostPersonId = configured.state.tableMeta.ownerPersonId!;
    const guestPersonId = 'guest-challenge-person';
    let challenge = asChallengeTable({
      ...configured.state,
      session: {
        ...configured.state.session,
        playerIds: [...configured.state.session.playerIds, guestPersonId],
      },
      players: {
        ...configured.state.players,
        [guestPersonId]: {
          id: guestPersonId,
          displayName: 'Guest',
          controllerName: 'Guest',
          playerType: 'real',
          role: 'person',
          cardIds: [],
          currentBet: 0,
          status: 'active',
          startingBalance: 500,
        },
      },
    });

    let ledger = createEmptyLedger(challenge.session.id);
    for (const seatId of [hostPersonId, guestPersonId]) {
      const result = appendLedgerEntry(challenge.session, ledger, {
        playerId: seatId,
        entryType: 'buy-in',
        amount: 500,
        description: 'Equal stack',
        roundNumber: challenge.session.currentRound,
      });
      ledger = result.ledger;
    }
    challenge = { ...challenge, ledger };
    store.updateTable(table.id, challenge, configured.version);
    const before = store.getTable(table.id)!;

    await expect(
      tables.applyAction(table.id, host.id, 'endHoldemChallenge', {}, configured.version),
    ).rejects.toThrow(/chip-leader tie/i);

    const after = store.getTable(table.id)!;
    expect(after.version).toBe(before.version);
    expect(after.state.tableMeta.pokerConfig?.challengeStatus).toBe('active');
  });

  it('14. failed end challenge does not mutate state', async () => {
    const host = await seedHostUser(store);
    const table = await tables.createTable(host.id, 'Host');
    const configured = await configureHoldemTable(host.id, table.id, table.version);
    const practice = {
      ...configured.state,
      tableMeta: {
        ...configured.state.tableMeta,
        pokerConfig: createDefaultPokerTableConfig({ mode: 'practice' }),
      },
    };
    store.updateTable(table.id, practice, configured.version);
    const before = store.getTable(table.id)!;

    await expect(
      tables.applyAction(table.id, host.id, 'endHoldemChallenge', {}, configured.version),
    ).rejects.toThrow(/challenge/i);

    const after = store.getTable(table.id)!;
    expect(after.version).toBe(before.version);
  });
});
