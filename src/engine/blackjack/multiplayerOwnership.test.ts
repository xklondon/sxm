import { describe, expect, it } from 'vitest';

import type { GameState } from '../../types';
import type { BlackjackRound } from '../../types/blackjack';
import { createBlackjackPlayerHand } from '../../types/blackjack';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { addChipToBoxStake } from './stakes';
import { startNextRoundOnState } from './gameState';
import {
  canDoubleUnderProtocol,
  buildActiveRulesHandContext,
} from './protocols/activeRules';
import { LAS_VEGAS_PROTOCOL } from './protocols';
import { hitBlackjackOnState } from './gameState';
import { canDoubleBlackjackForState } from './validation';
import { blackjackHandKey } from './handKeys';
import {
  getCallerPersonIdForBox,
  getAssignedSlotForPerson,
  isCallerForBox,
  ensureBoxPositionForPerson,
} from '../session/playerAssignment';
import { getAvailableChipsForBankrollOwner } from '../session/bankroll';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { claimBoxSlot } from '../session/boxOps';
import { getActionableHandForView } from '../../components/blackjackViewPhase';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
  tableWithClaimedBox,
} from './sanity/fixtures';

function unassignedBoxWithStake(
  state: GameState,
  slotNumber: number,
  bettorId: string,
  amount: 1 | 2 | 5 | 10 | 50,
): GameState {
  let next = claimBoxSlot(state, slotNumber);
  const boxId = boxPlayerId(next, slotNumber)!;
  const slots = next.tableMeta.boxSlots.map((s) =>
    s.slotNumber === slotNumber
      ? { ...s, nativeAssignedPersonId: null, callerPersonId: null }
      : s,
  );
  next = { ...next, tableMeta: { ...next.tableMeta, boxSlots: slots } };
  return addChipToBoxStake(next, boxId, amount, bettorId);
}

describe('multiplayer box ownership', () => {
  it('assigned box: native owner is decision owner even when another player bets', () => {
    let state = tableAfterStartPlaying(500);
    const ownerId = state.tableMeta.ownerPersonId!;
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1)!;

    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Bob',
      controllerName: 'Bob',
      role: 'person',
      startingChips: 500,
    });
    state = mergeSessionUpdate(state, guestSpl);
    const bobId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
    state = allocateChipsToBankrollOwner(state, {
      bankrollOwnerId: bobId,
      amount: 500,
      reason: 'initial-player',
      source: 'setup',
    });

    state = addChipToBoxStake(state, boxId, 10, bobId);
    expect(getCallerPersonIdForBox(state, boxId)).toBe(ownerId);
    expect(isCallerForBox(state, boxId, bobId)).toBe(false);
    expect(isCallerForBox(state, boxId, ownerId)).toBe(true);
  });

  it('unassigned box: first bettor becomes decision owner', () => {
    let state = tableAfterStartPlaying(500);
    const aliceId = state.tableMeta.ownerPersonId!;
    state = unassignedBoxWithStake(state, 3, aliceId, 10);
    const boxId = boxPlayerId(state, 3)!;
    expect(getCallerPersonIdForBox(state, boxId)).toBe(aliceId);
  });

  it('unassigned box: second bettor cannot steal decision ownership', () => {
    let state = tableAfterStartPlaying(500);
    const aliceId = state.tableMeta.ownerPersonId!;
    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Bob',
      controllerName: 'Bob',
      role: 'person',
      startingChips: 500,
    });
    state = mergeSessionUpdate(state, guestSpl);
    const bobId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
    state = allocateChipsToBankrollOwner(state, {
      bankrollOwnerId: bobId,
      amount: 500,
      reason: 'initial-player',
      source: 'setup',
    });

    state = unassignedBoxWithStake(state, 3, aliceId, 10);
    const boxId = boxPlayerId(state, 3)!;
    state = addChipToBoxStake(state, boxId, 5, bobId);

    expect(getCallerPersonIdForBox(state, boxId)).toBe(aliceId);
    expect(state.tableMeta.boxStakes[boxId]?.callerPersonId).toBe(aliceId);
  });

  it('unassigned box: decision owner resets at next betting round', () => {
    let state = tableAfterStartPlaying(500);
    const aliceId = state.tableMeta.ownerPersonId!;
    state = unassignedBoxWithStake(state, 3, aliceId, 10);
    const boxId = boxPlayerId(state, 3)!;

    const lockedCaller = 'prior-caller-id';
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        awaitingNextRound: true,
        boxSlots: state.tableMeta.boxSlots.map((s) =>
          s.playerId === boxId ? { ...s, callerPersonId: lockedCaller } : s,
        ),
      },
      blackjack: { ...state.blackjack!, isSettled: true, status: 'resolved' },
    };

    const next = startNextRoundOnState(state);
    expect(getCallerPersonIdForBox(next, boxId)).toBeNull();
    expect(next.tableMeta.boxSlots.find((s) => s.playerId === boxId)?.callerPersonId).toBeNull();
  });

  it('assigned box: non-owner cannot get actionable hand during player turns', () => {
    let state = tableAfterStartPlaying(500);
    const ownerId = state.tableMeta.ownerPersonId!;
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1)!;

    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Bob',
      controllerName: 'Bob',
      role: 'person',
      startingChips: 500,
    });
    state = mergeSessionUpdate(state, guestSpl);
    const bobId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;

    const deck = state.deck!;
    const round = actingRound(state, boxId, [findCardId(deck, '6'), findCardId(deck, '5')], 25);
    state = { ...state, blackjack: round };

    expect(getActionableHandForView(state, ownerId, true)).not.toBeNull();
    expect(getActionableHandForView(state, bobId, true)).toBeNull();
  });

  it('invite join assigns next free box slot', () => {
    let state = tableAfterStartPlaying(500);
    const ownerId = state.tableMeta.ownerPersonId!;
    state = claimBoxSlot(state, 1);

    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Guest',
      controllerName: 'Guest',
      role: 'person',
      startingChips: 500,
    });
    state = mergeSessionUpdate(state, guestSpl);
    const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        playerOrder: [ownerId, guestId],
      },
    };

    const freeSlot = state.tableMeta.boxSlots.find((s) => !s.playerId)!;
    state = ensureBoxPositionForPerson(state, freeSlot.slotNumber, guestId);

    expect(getAssignedSlotForPerson(state, guestId)).toBeNull();
    expect(
      state.tableMeta.boxSlots.find((s) => s.slotNumber === freeSlot.slotNumber)?.nativeAssignedPersonId,
    ).toBe(guestId);
  });
});

describe('Las Vegas double totals', () => {
  it('allows double on first two-card total 9/10/11', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    const five = findCardId(deck, '5');
    const four = findCardId(deck, '4');
    state = {
      ...state,
      blackjack: actingRound(state, boxId, [five, four], 25),
    };
    expect(canDoubleBlackjackForState(state, blackjackHandKey(boxId, 0))).toBe(true);
  });

  it('rejects double on first two-card total 8', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    const four = findCardId(deck, '4');
    state = {
      ...state,
      blackjack: actingRound(state, boxId, [four, four], 25),
    };
    expect(canDoubleBlackjackForState(state, blackjackHandKey(boxId, 0))).toBe(false);
  });

  it('rejects double after hit', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    const five = findCardId(deck, '5');
    const six = findCardId(deck, '6');
    const handKey = blackjackHandKey(boxId, 0);
    state = {
      ...state,
      blackjack: actingRound(state, boxId, [five, six], 25),
    };
    state = hitBlackjackOnState(state, handKey);
    expect(canDoubleBlackjackForState(state, handKey)).toBe(false);
  });

  it('allows double after split only when split hand is two cards totaling 9/10/11', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    const five = findCardId(deck, '5');
    const six = findCardId(deck, '6');
    const ownerId = state.tableMeta.ownerPersonId!;
    const handKey = blackjackHandKey(boxId, 0);
    const splitHandKey = blackjackHandKey(boxId, 1);

    const round: BlackjackRound = {
      ...actingRound(state, boxId, [five, six], 25),
      playerHands: {
        [handKey]: {
          ...createBlackjackPlayerHand(boxId, 0),
          cardIds: [five, six],
          currentBet: 25,
          actionStatus: 'acting',
          fromSplit: true,
        },
        [splitHandKey]: {
          ...createBlackjackPlayerHand(boxId, 1),
          cardIds: [five, six],
          currentBet: 25,
          actionStatus: 'acting',
          fromSplit: true,
        },
      },
      activeHandKey: handKey,
    };

    const ctx = buildActiveRulesHandContext(
      LAS_VEGAS_PROTOCOL,
      state.ledger,
      round,
      handKey,
      deck,
      ownerId,
      getAvailableChipsForBankrollOwner(state, ownerId),
    );
    const hand = round.playerHands[handKey]!;
    expect(ctx).not.toBeNull();
    expect(canDoubleUnderProtocol(LAS_VEGAS_PROTOCOL, hand, ctx!)).toBe(true);

    const badRound: BlackjackRound = {
      ...round,
      playerHands: {
        ...round.playerHands,
        [handKey]: {
          ...hand,
          cardIds: [findCardId(deck, '4'), findCardId(deck, '4')],
        },
      },
    };
    const badCtx = buildActiveRulesHandContext(
      LAS_VEGAS_PROTOCOL,
      state.ledger,
      badRound,
      handKey,
      deck,
      ownerId,
      getAvailableChipsForBankrollOwner(state, ownerId),
    );
    expect(
      canDoubleUnderProtocol(LAS_VEGAS_PROTOCOL, badRound.playerHands[handKey]!, badCtx!),
    ).toBe(false);
  });
});
