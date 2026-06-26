import { describe, expect, it } from 'vitest';

import type { GameState } from '../../types';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { claimBoxSlot } from '../session/boxOps';
import {
  getCallerPersonIdForBox,
  getAssignedSlotForPerson,
  syncPlayerOrderAndAssignments,
} from '../session/playerAssignment';
import {
  hasNoRoundBoxOwnershipResidue,
  resetBlackjackRoundOwnership,
} from '../session/resetBlackjackRoundOwnership';
import { getCoBoxSlotsForPerson, getRunningBoxSlotsForPerson } from '../session/tableBoxDisplay';
import {
  canStartBlackjackDeal,
} from '../session/tableDealPermission';
import { addChipToBoxStake } from './stakes';
import { getEligibleDealBoxes } from './dealEligibility';
import { applyBlackjackActionToState, type BlackjackActorContext } from './applyBlackjackAction';
import { shuffleToStartOnState, resolveBankTurnAuto, startNextRoundOnState } from './gameState';
import { boxPlayerId, tableAfterStartPlaying } from './sanity/fixtures';

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

function ctx(state: GameState): BlackjackActorContext {
  return {
    personId: state.tableMeta.ownerPersonId ?? 'host',
    payload: {},
    resolveBankAuto: true,
  };
}

function readyToDeal(state: GameState): GameState {
  return shuffleToStartOnState(state);
}

function settleRound(state: GameState): GameState {
  let s = applyBlackjackActionToState(readyToDeal(state), 'dealCards', ctx(state));
  let guard = 0;
  while (s.blackjack?.status !== 'resolved' && guard < 80) {
    guard += 1;
    if (s.blackjack?.status === 'player-turns' && s.blackjack.activeHandKey) {
      const hand = s.blackjack.playerHands[s.blackjack.activeHandKey];
      if (hand?.actionStatus === 'acting') {
        s = applyBlackjackActionToState(s, 'stand', ctx(s));
        continue;
      }
    }
    s = resolveBankTurnAuto(s);
  }
  expect(s.blackjack?.status).toBe('resolved');
  expect(s.tableMeta.awaitingNextRound).toBe(true);
  return s;
}

function startBettingRound(state: GameState): GameState {
  return applyBlackjackActionToState(state, 'nextRound', ctx(state));
}

describe('blackjack round ownership reset', () => {
  it('round 1 → next round restores designated boxes and clears free-box temp owner', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    const box3 = boxPlayerId(state, 3)!;
    const box3Slot = state.tableMeta.boxSlots.find((s) => s.playerId === box3)!;
    expect(box3Slot.nativeAssignedPersonId).toBeNull();

    state = addChipToBoxStake(state, box3, 50, p1);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box2, 50, p2);
    expect(getCallerPersonIdForBox(state, box3)).toBe(p1);
    expect(getCallerPersonIdForBox(state, box1)).toBe(p2);
    expect(getRunningBoxSlotsForPerson(state, p1)).toContain(3);
    expect(getRunningBoxSlotsForPerson(state, p2)).toContain(1);

    const settled = settleRound(state);
    const betting = startBettingRound(settled);

    expect(getAssignedSlotForPerson(betting, p1)).toBe(1);
    expect(getAssignedSlotForPerson(betting, p2)).toBe(2);
    expect(
      betting.tableMeta.boxSlots.find((s) => s.playerId === box1)?.nativeAssignedPersonId,
    ).toBe(p1);
    expect(
      betting.tableMeta.boxSlots.find((s) => s.playerId === box2)?.nativeAssignedPersonId,
    ).toBe(p2);
    expect(
      betting.tableMeta.boxSlots.find((s) => s.playerId === box3)?.nativeAssignedPersonId,
    ).toBeNull();
    expect(getCallerPersonIdForBox(betting, box1)).toBeNull();
    expect(getCallerPersonIdForBox(betting, box2)).toBeNull();
    expect(getCallerPersonIdForBox(betting, box3)).toBeNull();
    expect(getRunningBoxSlotsForPerson(betting, p1)).toEqual([]);
    expect(getCoBoxSlotsForPerson(betting, p2)).toEqual([]);
    expect(hasNoRoundBoxOwnershipResidue(betting)).toBe(true);
    expect(betting.blackjack?.activeHandKey ?? null).toBeNull();
  });

  it('round 2: guest commands host native box when host does not bet; host can still deal', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;

    state = addChipToBoxStake(state, box1, 50, p2);

    let betting = startBettingRound(settleRound(state));
    betting = addChipToBoxStake(betting, box1, 50, p2);

    expect(getCallerPersonIdForBox(betting, box1)).toBe(p2);
    expect(canStartBlackjackDeal(betting, p1)).toBe(true);
    expect(canStartBlackjackDeal(betting, p2)).toBe(false);
    expect(getEligibleDealBoxes(betting)).toContain(box1);
  });

  it('free box: new first bettor commands after reset; prior owner has no stale permission', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    const slots = state.tableMeta.boxSlots.map((s) =>
      s.playerId === box3 ? { ...s, nativeAssignedPersonId: null, callerPersonId: null } : s,
    );
    state = { ...state, tableMeta: { ...state.tableMeta, boxSlots: slots } };

    state = addChipToBoxStake(state, box3, 50, p1);
    expect(getCallerPersonIdForBox(state, box3)).toBe(p1);

    let betting = startBettingRound(settleRound(state));
    betting = addChipToBoxStake(betting, box3, 50, p2);

    expect(getCallerPersonIdForBox(betting, box3)).toBe(p2);
    expect(getCallerPersonIdForBox(betting, box3)).not.toBe(p1);
  });

  it('canStartBlackjackDeal after reset uses only current stakes, not prior round callers', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, box1, 50, p2);

    const settled = settleRound(state);
    expect(settled.tableMeta.boxSlots.find((s) => s.playerId === box1)?.callerPersonId).toBeTruthy();

    let betting = startBettingRound(settled);
    expect(canStartBlackjackDeal(betting, p1)).toBe(false);

    betting = addChipToBoxStake(betting, box1, 50, p2);
    expect(canStartBlackjackDeal(betting, p1)).toBe(true);
    expect(getEligibleDealBoxes(betting)).toEqual([box1]);
  });

  it('invariant: resetBlackjackRoundOwnership leaves no temporary commander residue', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box1 = boxPlayerId(state, 1)!;
    const box3 = boxPlayerId(state, 3)!;
    state = addChipToBoxStake(state, box3, 50, p1);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        awaitingNextRound: true,
        bettingLocked: true,
        boxSlots: state.tableMeta.boxSlots.map((s) =>
          s.playerId === box1 ? { ...s, callerPersonId: p2 } : s,
        ),
      },
      blackjack: { ...state.blackjack!, isSettled: true, status: 'resolved' },
    };

    const betting = resetBlackjackRoundOwnership(startNextRoundOnState(state));

    expect(hasNoRoundBoxOwnershipResidue(betting)).toBe(true);
    for (const slot of betting.tableMeta.boxSlots) {
      expect(slot.callerPersonId).toBeNull();
    }
    expect(betting.tableMeta.boxStakes).toEqual({});
    expect(getCallerPersonIdForBox(betting, box1)).toBeNull();
    expect(getCallerPersonIdForBox(betting, box3)).toBeNull();
    void p2;
  });
});
