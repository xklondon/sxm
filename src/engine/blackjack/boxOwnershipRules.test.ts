import { describe, expect, it } from 'vitest';
import {
  getCallerPersonIdForBox,
  getAssignedSlotForPerson,
  syncPlayerOrderAndAssignments,
  ensureBoxPositionForPerson,
} from '../session/playerAssignment';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { claimBoxSlot } from '../session/boxOps';
import { addChipToBoxStake } from './stakes';
import { startNextRoundOnState } from './gameState';
import { getActionableHandForView } from '../../components/blackjackViewPhase';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
} from './sanity/fixtures';
import { finalizeInviteJoinAtTable } from '../session/inviteJoin';

function twoPlayerSeated() {
  let state = tableAfterStartPlaying(500);
  const p1 = state.tableMeta.ownerPersonId!;
  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'P2',
    controllerName: 'P2',
    role: 'person',
    startingChips: 500,
  });
  state = mergeSessionUpdate(state, guestSpl);
  const p2 = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
  state = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: p2,
    amount: 500,
    reason: 'initial-player',
    source: 'setup',
  });
  state = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      playerOrder: [p1, p2],
    },
  };
  state = syncPlayerOrderAndAssignments(state);
  return { state, p1, p2 };
}

describe('box ownership / allocation rules', () => {
  it('P1 owns Box 1 and P2 owns Box 2 after join sync', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    expect(getAssignedSlotForPerson(state, p1)).toBe(1);
    expect(getAssignedSlotForPerson(state, p2)).toBe(2);
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    expect(getCallerPersonIdForBox(state, box1)).toBe(p1);
    expect(getCallerPersonIdForBox(state, box2)).toBe(p2);
  });

  it('P1 betting on Box 2 does not take caller from P2', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box2 = boxPlayerId(state, 2)!;
    const next = addChipToBoxStake(state, box2, 10, p1);
    expect(getCallerPersonIdForBox(next, box2)).toBe(p2);
    expect(getActionableHandForView(
      {
        ...next,
        blackjack: actingRound(next, box2, [findCardId(next.deck!, '6'), findCardId(next.deck!, '7')], 10),
      },
      p1,
      true,
    )).toBeNull();
    expect(getActionableHandForView(
      {
        ...next,
        blackjack: actingRound(next, box2, [findCardId(next.deck!, '6'), findCardId(next.deck!, '7')], 10),
      },
      p2,
      true,
    )).not.toBeNull();
  });

  it('first bettor on free Box 3 becomes caller; second bettor does not', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    const slots = state.tableMeta.boxSlots.map((s) =>
      s.playerId === box3 ? { ...s, nativeAssignedPersonId: null } : s,
    );
    state = { ...state, tableMeta: { ...state.tableMeta, boxSlots: slots } };
    let next = addChipToBoxStake(state, box3, 10, p1);
    expect(getCallerPersonIdForBox(next, box3)).toBe(p1);
    next = addChipToBoxStake(next, box3, 5, p2);
    expect(getCallerPersonIdForBox(next, box3)).toBe(p1);
  });

  it('next betting round clears free-box caller on slot and stake', () => {
    let { state, p1 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    const slots = state.tableMeta.boxSlots.map((s) =>
      s.playerId === box3 ? { ...s, nativeAssignedPersonId: null, callerPersonId: 'stale' } : s,
    );
    state = addChipToBoxStake(
      { ...state, tableMeta: { ...state.tableMeta, boxSlots: slots } },
      box3,
      10,
      p1,
    );
    state = {
      ...state,
      tableMeta: { ...state.tableMeta, awaitingNextRound: true },
      blackjack: { ...state.blackjack!, isSettled: true, status: 'resolved' },
    };
    const next = startNextRoundOnState(state);
    expect(next.tableMeta.boxStakes[box3]).toBeUndefined();
    expect(next.tableMeta.boxSlots.find((s) => s.playerId === box3)?.callerPersonId).toBeNull();
    expect(getCallerPersonIdForBox(next, box3)).toBeNull();
  });

  it('new joiner assigned Box 3 wins caller over prior-round first bettor', () => {
    let { state, p1 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    const slots = state.tableMeta.boxSlots.map((s) =>
      s.playerId === box3
        ? { ...s, nativeAssignedPersonId: null, callerPersonId: null }
        : s,
    );
    state = addChipToBoxStake(
      { ...state, tableMeta: { ...state.tableMeta, boxSlots: slots } },
      box3,
      10,
      p1,
    );
    expect(getCallerPersonIdForBox(state, box3)).toBe(p1);

    const p3Spl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'P3',
      controllerName: 'P3',
      role: 'person',
      startingChips: 0,
    });
    state = mergeSessionUpdate(state, p3Spl);
    const p3 = p3Spl.session.playerIds[p3Spl.session.playerIds.length - 1]!;
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        playerOrder: [...(state.tableMeta.playerOrder ?? []), p3],
      },
    };
    state = syncPlayerOrderAndAssignments(state);
    state = ensureBoxPositionForPerson(state, 3, p3);
    expect(getCallerPersonIdForBox(state, box3)).toBe(p3);
  });

  it('invite join assigns natural box via player order', () => {
    let state = tableAfterStartPlaying(500);
    const ownerId = state.tableMeta.ownerPersonId!;
    state = claimBoxSlot(state, 1);
    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Guest',
      controllerName: 'Guest',
      role: 'person',
      startingChips: 0,
    });
    const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
    state = mergeSessionUpdate(state, guestSpl);
    const joined = finalizeInviteJoinAtTable(state, guestId, 'Guest');
    expect(getAssignedSlotForPerson(joined.state, guestId)).toBe(2);
    const box2 = boxPlayerId(joined.state, 2)!;
    expect(getCallerPersonIdForBox(joined.state, box2)).toBe(guestId);
    void ownerId;
  });
});
