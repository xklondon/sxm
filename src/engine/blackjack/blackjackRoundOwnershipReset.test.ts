import { describe, expect, it } from 'vitest';

import type { GameState } from '../../types';
import { createEmptyBlackjackRound, createBlackjackPlayerHand } from '../../types/blackjack';
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
  getBlackjackDealBlockReason,
} from '../session/tableDealPermission';
import { addChipToBoxStake } from './stakes';
import { getEligibleDealBoxes } from './dealEligibility';
import { getBlackjackProtocolPhase } from './protocol';
import { applyBlackjackActionToState, type BlackjackActorContext } from './applyBlackjackAction';
import { blackjackHandKey, listHandKeysForPlayer } from './handKeys';
import { startNextRoundOnState } from './gameState';
import {
  blackjackTestActorContext,
  boxPlayerId,
  settleBlackjackRoundForTest,
  tableAfterStartPlaying,
} from './sanity/fixtures';

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
  return blackjackTestActorContext(state);
}

function settleRound(state: GameState): GameState {
  const s = settleBlackjackRoundForTest(state);
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

    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        awaitingNextRound: true,
        bettingLocked: true,
        boxSlots: state.tableMeta.boxSlots.map((s) => {
          if (s.playerId === box1) return { ...s, callerPersonId: p2 };
          if (s.playerId === box3) return { ...s, callerPersonId: p1 };
          return s;
        }),
      },
      blackjack: { ...state.blackjack!, isSettled: true, status: 'resolved' },
    };
    const betting = startBettingRound(state);

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
    expect(settled.tableMeta.boxSlots.find((s) => s.playerId === box1)?.callerPersonId).toBeNull();

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

  it('round 2 mixed ownership: host dealCards accepts and deals all staked boxes', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    const box3 = boxPlayerId(state, 3)!;

    state = addChipToBoxStake(state, box3, 50, p1);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box2, 50, p2);
    let betting = startBettingRound(settleRound(state));

    betting = addChipToBoxStake(betting, box1, 50, p2);
    betting = addChipToBoxStake(betting, box2, 50, p1);
    betting = addChipToBoxStake(betting, box3, 50, p2);

    expect(getCallerPersonIdForBox(betting, box1)).toBe(p2);
    expect(getCallerPersonIdForBox(betting, box2)).toBe(p1);
    expect(getCallerPersonIdForBox(betting, box3)).toBe(p2);
    expect(getRunningBoxSlotsForPerson(betting, p2)).toEqual(expect.arrayContaining([1, 3]));
    expect(getRunningBoxSlotsForPerson(betting, p1)).toContain(2);

    expect(canStartBlackjackDeal(betting, p1)).toBe(true);
    expect(getBlackjackDealBlockReason(betting, p1)).toBeNull();
    expect(getEligibleDealBoxes(betting).sort()).toEqual([box1, box2, box3].sort());

    const beforeStatus = betting.blackjack?.status;
    const dealt = applyBlackjackActionToState(betting, 'dealCards', ctx(betting));
    expect(beforeStatus).toBe('betting');
    expect(dealt.blackjack?.status).not.toBe('betting');
    expect(['initial-deal', 'player-turns', 'insurance']).toContain(dealt.blackjack?.status ?? '');
    expect(dealt.tableMeta.bettingLocked).toBe(true);
    for (const boxId of [box1, box2, box3]) {
      expect(dealt.blackjack?.playerHands[blackjackHandKey(boxId, 0)]?.currentBet ?? 0).toBeGreaterThan(0);
    }
  });

  it('invariant: enabled canStartBlackjackDeal must not no-op on dealCards action', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box1 = boxPlayerId(state, 1)!;
    const box3 = boxPlayerId(state, 3)!;
    state = addChipToBoxStake(state, box3, 50, p1);
    state = addChipToBoxStake(state, box1, 50, p2);
    let betting = startBettingRound(settleRound(state));
    betting = addChipToBoxStake(betting, box1, 50, p2);
    betting = addChipToBoxStake(betting, box3, 50, p1);

    expect(canStartBlackjackDeal(betting, p1)).toBe(true);
    expect(() => applyBlackjackActionToState(betting, 'dealCards', ctx(betting))).not.toThrow();
    const dealt = applyBlackjackActionToState(betting, 'dealCards', ctx(betting));
    expect(dealt.blackjack?.status).not.toBe('betting');
    void p2;
  });

  it('createEmptyBlackjackRound clears insurance, even-money, and split residue fields', () => {
    const round = createEmptyBlackjackRound();
    expect(round.insuranceOfferPending).toBe(false);
    expect(round.insuranceStakerDecisions).toEqual({});
    expect(round.insuranceStakerSkipReasons).toEqual({});
    expect(round.insuranceStakerBets).toEqual({});
    expect(round.evenMoneyOfferHandKey).toBeNull();
    expect(round.evenMoneyPendingHandKeys).toEqual([]);
    expect(round.activeHandKey).toBeNull();
    expect(round.splitCounts).toEqual({});
  });

  it('startNextRoundOnState clears split, insurance, and even-money residue', () => {
    let { state, p1 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const splitKey = blackjackHandKey(box1, 1);
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        awaitingNextRound: true,
        bettingLocked: true,
      },
      blackjack: {
        ...createEmptyBlackjackRound(),
        status: 'resolved',
        isSettled: true,
        insuranceOfferPending: true,
        insuranceStakerDecisions: { [box1]: { [p1]: 'accepted' } },
        evenMoneyOfferHandKey: splitKey,
        evenMoneyPendingHandKeys: [splitKey],
        splitCounts: { [box1]: 1 },
        activeHandKey: splitKey,
        playerHands: {
          [blackjackHandKey(box1, 0)]: createBlackjackPlayerHand(box1, 0, true),
          [splitKey]: createBlackjackPlayerHand(box1, 1, true),
        },
      },
    };
    const next = startNextRoundOnState(state);
    expect(next.tableMeta.awaitingNextRound).toBe(false);
    expect(next.tableMeta.bettingLocked).toBe(false);
    expect(next.blackjack?.insuranceOfferPending).toBe(false);
    expect(next.blackjack?.insuranceStakerDecisions).toEqual({});
    expect(next.blackjack?.evenMoneyOfferHandKey).toBeNull();
    expect(next.blackjack?.evenMoneyPendingHandKeys).toEqual([]);
    expect(next.blackjack?.activeHandKey).toBeNull();
    expect(next.blackjack?.splitCounts).toEqual({});
    expect(listHandKeysForPlayer(next.blackjack!.playerHands, box1)).toHaveLength(1);
    expect(getBlackjackProtocolPhase(next)).toBe('betting');
  });
});
