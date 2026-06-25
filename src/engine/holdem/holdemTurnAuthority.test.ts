import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import type { HoldemRound } from '../../types/holdem';
import { createNewBlackjackTable, createNewHoldemTable } from '../session/table';
import { applyHoldemTableStakeSetup } from '../session/holdemTableSetup';
import {
  assertHoldemHostAction,
  assertHoldemPlayerGameplayAction,
  assertHoldemTable,
  assertUpdateHoldemBlindsAuthorized,
  getHoldemPlayerIdForPerson,
} from './holdemTurnAuthority';

function practiceHoldemState(): GameState {
  return applyHoldemTableStakeSetup(createNewHoldemTable(), {
    stakeDescription: 'Practice',
    seatChips: 500,
    bankChips: 500,
    bankerMode: 'self',
    bankerName: 'Alex',
    controllerName: 'Alex',
    controllerEmail: 'alex@example.com',
    protocolId: 'texas-holdem',
    naturalDealing: false,
    dealSpeedPreset: 'normal',
    cardTimerPreset: 0,
    bankDrawAuto: true,
    tableMode: 'practice',
    smallBlind: 5,
    bigBlind: 10,
    virtualPlayerCount: 1,
  });
}

function activeRound(overrides: Partial<HoldemRound> = {}): HoldemRound {
  return {
    status: 'preflop',
    bettingStreet: 'preflop',
    smallBlind: 5,
    bigBlind: 10,
    communityCardIds: [],
    pot: 15,
    currentBet: 10,
    dealerButtonPlayerId: 'p1',
    smallBlindPlayerId: 'p1',
    bigBlindPlayerId: 'p2',
    activePlayerId: 'p1',
    playerStates: {},
    actionLog: [],
    winners: [],
    resultSummary: '',
    lastRaiseSize: 10,
    ...overrides,
  };
}

describe('holdemTurnAuthority', () => {
  it('rejects holdem authority checks on non-poker tables', () => {
    expect(() => assertHoldemTable(createNewBlackjackTable())).toThrow(/Texas Hold'em/i);
  });

  it('maps owner person id to seated holdem player id', () => {
    const state = practiceHoldemState();
    const ownerId = state.tableMeta.ownerPersonId!;
    const playerId = getHoldemPlayerIdForPerson(state, ownerId);
    expect(playerId).toBeTruthy();
    expect(state.session.playerIds).toContain(playerId);
  });

  it('host can start hand when no active betting street', () => {
    const state = practiceHoldemState();
    const ownerId = state.tableMeta.ownerPersonId!;
    expect(() =>
      assertHoldemHostAction(state, ownerId, { blockMidHandStart: true }),
    ).not.toThrow();
  });

  it('blocks start hand while betting is active', () => {
    const state = {
      ...practiceHoldemState(),
      holdem: activeRound(),
    };
    const ownerId = state.tableMeta.ownerPersonId!;
    expect(() =>
      assertHoldemHostAction(state, ownerId, { blockMidHandStart: true }),
    ).toThrow(/already in progress/i);
  });

  it('blocks shuffle mid-hand', () => {
    const state = {
      ...practiceHoldemState(),
      holdem: activeRound(),
    };
    const ownerId = state.tableMeta.ownerPersonId!;
    expect(() =>
      assertHoldemHostAction(state, ownerId, { blockMidHandShuffle: true }),
    ).toThrow(/Cannot shuffle during an active hand/i);
  });

  it('rejects unseated player gameplay actions', () => {
    const state = {
      ...practiceHoldemState(),
      holdem: activeRound(),
    };
    expect(() =>
      assertHoldemPlayerGameplayAction(state, 'not-a-member', {}),
    ).toThrow(/not seated/i);
  });

  it('rejects acting for another seat via payload', () => {
    const base = practiceHoldemState();
    const ownerId = base.tableMeta.ownerPersonId!;
    const ownerPlayerId = getHoldemPlayerIdForPerson(base, ownerId)!;
    const state = {
      ...base,
      holdem: activeRound({ activePlayerId: ownerPlayerId }),
    };
    const otherSeat = state.session.playerIds.find((id) => id !== ownerPlayerId);
    expect(() =>
      assertHoldemPlayerGameplayAction(state, ownerId, { actorSeatId: otherSeat }),
    ).toThrow(/Cannot act for another seat/i);
  });

  it('rejects out-of-turn player actions', () => {
    const state = practiceHoldemState();
    const ownerId = state.tableMeta.ownerPersonId!;
    const ownerPlayerId = getHoldemPlayerIdForPerson(state, ownerId)!;
    const otherPlayerId = state.session.playerIds.find((id) => id !== ownerPlayerId)!;
    const withRound = {
      ...state,
      holdem: activeRound({ activePlayerId: ownerPlayerId }),
    };
    expect(() =>
      assertHoldemPlayerGameplayAction(withRound, otherPlayerId, {}),
    ).toThrow(/Not your turn|not seated/i);
  });

  it('allows current actor to play when seated', () => {
    const state = practiceHoldemState();
    const ownerId = state.tableMeta.ownerPersonId!;
    const ownerPlayerId = getHoldemPlayerIdForPerson(state, ownerId)!;
    const withRound = {
      ...state,
      holdem: activeRound({ activePlayerId: ownerPlayerId }),
    };
    expect(
      assertHoldemPlayerGameplayAction(withRound, ownerId, {}),
    ).toBe(ownerPlayerId);
  });

  it('owner can update blinds before hand starts', () => {
    const state = practiceHoldemState();
    const ownerId = state.tableMeta.ownerPersonId!;
    expect(() =>
      assertUpdateHoldemBlindsAuthorized(state, ownerId, 10, 20),
    ).not.toThrow();
  });

  it('blocks blind update mid-hand', () => {
    const state = {
      ...practiceHoldemState(),
      holdem: activeRound(),
    };
    const ownerId = state.tableMeta.ownerPersonId!;
    expect(() =>
      assertUpdateHoldemBlindsAuthorized(state, ownerId, 10, 20),
    ).toThrow(/before a hand starts/i);
  });

  it('rejects invalid blind amounts', () => {
    const state = practiceHoldemState();
    const ownerId = state.tableMeta.ownerPersonId!;
    expect(() =>
      assertUpdateHoldemBlindsAuthorized(state, ownerId, 10, 10),
    ).toThrow(/Big blind must be greater/i);
    expect(() =>
      assertUpdateHoldemBlindsAuthorized(state, ownerId, 0, 10),
    ).toThrow(/Small blind must be a positive/i);
  });

  it('non-owner cannot update blinds', () => {
    const state = practiceHoldemState();
    expect(() =>
      assertUpdateHoldemBlindsAuthorized(state, 'guest-person', 10, 20),
    ).toThrow(/host/i);
  });
});
