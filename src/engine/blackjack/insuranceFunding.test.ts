import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import type { BlackjackRound } from '../../types/blackjack';
import { createBlackjackPlayerHand, createEmptyBlackjackRound } from '../../types/blackjack';
import {
  applyInsuranceAdvanceOnState,
  declineInsuranceOnState,
  takeInsuranceOnState,
} from './gameState';
import {
  allInsuranceDecisionsResolved,
  applyAutoSkippedInsuranceStakers,
  getPendingInsuranceBoxIdsForPerson,
  getStakerInsuranceDecision,
} from './insurance';
import {
  INSUFFICIENT_DOUBLE_REASON,
  INSUFFICIENT_SPLIT_REASON,
} from './handFunding';
import {
  canDoubleBlackjackForState,
  canSplitBlackjackForState,
  getDoubleFundingBlockReason,
  getSplitFundingBlockReason,
} from './validation';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { doubleDownBlackjackOnState, splitBlackjackOnState } from './gameState';
import { blackjackHandKey } from './handKeys';
import { LAS_VEGAS_PROTOCOL } from './protocols';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
  tableWithClaimedBox,
} from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { addChipToBoxStake, confirmBoxStake } from './stakes';
import { syncCallersForDeal } from '../session/playerAssignment';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { allocateChipsToBankrollOwner } from '../session/allocation';

function insuranceRound(
  state: GameState,
  hands: Array<{ boxId: string; bet: number; stakerAmountsByPersonId?: Record<string, number> }>,
): BlackjackRound {
  const aceId = findCardId(state.deck!, 'A');
  const playerHands: BlackjackRound['playerHands'] = {};
  for (const hand of hands) {
    const handKey = blackjackHandKey(hand.boxId, 0);
    playerHands[handKey] = {
      ...createBlackjackPlayerHand(hand.boxId, 0),
      cardIds: [findCardId(state.deck!, '9'), findCardId(state.deck!, '8')],
      currentBet: hand.bet,
      actionStatus: 'acting',
      stakerAmountsByPersonId: hand.stakerAmountsByPersonId,
    };
  }
  return {
    ...createEmptyBlackjackRound(),
    status: 'player-turns',
    insuranceOfferPending: true,
    dealerCardIds: [aceId, findCardId(state.deck!, '10')],
    dealerHoleHidden: true,
    activeHandKey: null,
    activePlayerId: null,
    playerHands,
  };
}

function twoPlayerSeated(startingChips = 500) {
  let state = tableAfterStartPlaying(startingChips);
  const host = state.tableMeta.ownerPersonId!;
  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'K',
    controllerName: 'K',
    role: 'person',
    startingChips: 0,
  });
  state = mergeSessionUpdate(state, guestSpl);
  const guest = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
  state = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: guest,
    amount: startingChips,
    reason: 'initial-player',
    source: 'setup',
  });
  state = {
    ...state,
    tableMeta: { ...state.tableMeta, playerOrder: [host, guest] },
  };
  return { state, host, guest };
}

describe('insurance funding eligibility', () => {
  it('three funded boxes: each stake owner decides; phase completes', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 2);
    state = claimBoxSlot(state, 3);
    const host = state.tableMeta.ownerPersonId!;
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    const box3 = boxPlayerId(state, 3)!;
    for (const box of [box1, box2, box3]) {
      state = addChipToBoxStake(state, box, 50, host);
      state = confirmBoxStake(state, box);
    }
    state = syncCallersForDeal(state, [box1, box2, box3]);
    state = {
      ...state,
      blackjack: insuranceRound(state, [
        { boxId: box1, bet: 50, stakerAmountsByPersonId: { [host]: 50 } },
        { boxId: box2, bet: 50, stakerAmountsByPersonId: { [host]: 50 } },
        { boxId: box3, bet: 50, stakerAmountsByPersonId: { [host]: 50 } },
      ]),
    };
    state = takeInsuranceOnState(state, box1, host);
    state = takeInsuranceOnState(state, box2, host);
    state = declineInsuranceOnState(state, box3, host);
    expect(state.blackjack?.insuranceOfferPending).toBe(false);
  });

  it('mixed funded/unfunded boxes: unfunded auto-skipped; funded boxes continue', () => {
    let { state, host, guest } = twoPlayerSeated(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 2);
    state = claimBoxSlot(state, 3);
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    const box3 = boxPlayerId(state, 3)!;
    state = addChipToBoxStake(state, box1, 50, host);
    state = addChipToBoxStake(state, box2, 500, guest);
    state = addChipToBoxStake(state, box3, 50, host);
    for (const box of [box1, box2, box3]) {
      state = confirmBoxStake(state, box);
    }
    state = syncCallersForDeal(state, [box1, box2, box3]);
    state = {
      ...state,
      ledger: { ...state.ledger, entries: [] },
      blackjack: insuranceRound(state, [
        { boxId: box1, bet: 50, stakerAmountsByPersonId: { [host]: 50 } },
        { boxId: box2, bet: 500, stakerAmountsByPersonId: { [guest]: 500 } },
        { boxId: box3, bet: 50, stakerAmountsByPersonId: { [host]: 50 } },
      ]),
    };
    state = allocateChipsToBankrollOwner(state, {
      bankrollOwnerId: host,
      amount: 500,
      reason: 'top-up',
      source: 'setup',
    });
    state = {
      ...state,
      blackjack: applyAutoSkippedInsuranceStakers(state, state.blackjack!, LAS_VEGAS_PROTOCOL),
    };
    expect(getStakerInsuranceDecision(state.blackjack!, box2, guest)).toBe('skipped');
    state = takeInsuranceOnState(state, box1, host);
    state = declineInsuranceOnState(state, box3, host);
    expect(state.blackjack?.insuranceOfferPending).toBe(false);
  });

  it('co-staked box: fundable staker decides; unfunded staker skipped', () => {
    let { state, host, guest } = twoPlayerSeated(500);
    const box1 = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, box1, 50, host);
    state = addChipToBoxStake(state, box1, 50, guest);
    state = confirmBoxStake(state, box1);
    state = syncCallersForDeal(state, [box1]);
    state = {
      ...state,
      ledger: { ...state.ledger, entries: [] },
      blackjack: insuranceRound(state, [
        { boxId: box1, bet: 100, stakerAmountsByPersonId: { [host]: 50, [guest]: 50 } },
      ]),
    };
    state = allocateChipsToBankrollOwner(state, {
      bankrollOwnerId: host,
      amount: 500,
      reason: 'top-up',
      source: 'setup',
    });
    state = {
      ...state,
      blackjack: applyAutoSkippedInsuranceStakers(state, state.blackjack!, LAS_VEGAS_PROTOCOL),
    };
    expect(getStakerInsuranceDecision(state.blackjack!, box1, guest)).toBe('skipped');
    state = takeInsuranceOnState(state, box1, host);
    expect(state.blackjack?.insuranceStakerBets?.[box1]?.[host]).toBe(25);
    expect(state.blackjack?.insuranceOfferPending).toBe(false);
  });

  it('no fundable stakers auto-completes insurance phase', () => {
    let state = tableWithClaimedBox(1);
    const box1 = boxPlayerId(state, 1)!;
    const host = state.tableMeta.ownerPersonId!;
    state = {
      ...state,
      ledger: { ...state.ledger, entries: [] },
      blackjack: insuranceRound(state, [
        { boxId: box1, bet: 50, stakerAmountsByPersonId: { [host]: 50 } },
      ]),
    };
    const advanced = applyInsuranceAdvanceOnState(state);
    expect(advanced.blackjack?.insuranceOfferPending).toBe(false);
  });

  it('native owner not charged unless in stakerAmountsByPersonId', () => {
    let { state, host, guest } = twoPlayerSeated(500);
    const box1 = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, box1, 100, guest);
    state = confirmBoxStake(state, box1);
    state = syncCallersForDeal(state, [box1]);
    state = {
      ...state,
      blackjack: insuranceRound(state, [
        { boxId: box1, bet: 100, stakerAmountsByPersonId: { [guest]: 100 } },
      ]),
    };
    const hostBefore = derivePlayerBalanceFromLedger(host, state.ledger);
    const guestBefore = derivePlayerBalanceFromLedger(guest, state.ledger);
    state = takeInsuranceOnState(state, box1, guest);
    expect(derivePlayerBalanceFromLedger(host, state.ledger)).toBe(hostBefore);
    expect(derivePlayerBalanceFromLedger(guest, state.ledger)).toBeLessThan(guestBefore);
  });

  it('insuranceOfferPending clears when no actionable fundable decisions remain', () => {
    let state = tableWithClaimedBox(1);
    const box1 = boxPlayerId(state, 1)!;
    const host = state.tableMeta.ownerPersonId!;
    state = {
      ...state,
      ledger: { ...state.ledger, entries: [] },
      blackjack: insuranceRound(state, [
        { boxId: box1, bet: 50, stakerAmountsByPersonId: { [host]: 50 } },
      ]),
    };
    expect(allInsuranceDecisionsResolved(state, state.blackjack!, LAS_VEGAS_PROTOCOL)).toBe(false);
    const advanced = applyInsuranceAdvanceOnState(state);
    expect(advanced.blackjack?.insuranceOfferPending).toBe(false);
    expect(getPendingInsuranceBoxIdsForPerson(advanced, advanced.blackjack!, host, LAS_VEGAS_PROTOCOL)).toEqual([]);
  });
});

describe('double/split funding eligibility', () => {
  it('hard 9 with funded staker: double enabled', () => {
    const { state, guest } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(box1, 0);
    const playing = {
      ...state,
      blackjack: {
        ...actingRound(state, box1, [findCardId(state.deck!, '5'), findCardId(state.deck!, '4')], 100),
        status: 'player-turns' as const,
        activeHandKey: handKey,
        playerHands: {
          [handKey]: {
            ...actingRound(state, box1, [findCardId(state.deck!, '5'), findCardId(state.deck!, '4')], 100)
              .playerHands[handKey]!,
            stakerAmountsByPersonId: { [guest]: 100 },
          },
        },
      },
    };
    expect(canDoubleBlackjackForState(playing, handKey)).toBe(true);
    expect(getDoubleFundingBlockReason(playing, handKey)).toBeNull();
  });

  it('hard 9 with unfunded staker: double disabled', () => {
    const { state, host, guest } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(box1, 0);
    const playing = {
      ...state,
      ledger: { ...state.ledger, entries: [] },
      blackjack: {
        ...actingRound(state, box1, [findCardId(state.deck!, '5'), findCardId(state.deck!, '4')], 100),
        status: 'player-turns' as const,
        activeHandKey: handKey,
        playerHands: {
          [handKey]: {
            ...actingRound(state, box1, [findCardId(state.deck!, '5'), findCardId(state.deck!, '4')], 100)
              .playerHands[handKey]!,
            stakerAmountsByPersonId: { [guest]: 100 },
          },
        },
      },
    };
    expect(canDoubleBlackjackForState(playing, handKey)).toBe(false);
    expect(getDoubleFundingBlockReason(playing, handKey)).toBe(INSUFFICIENT_DOUBLE_REASON);
    void host;
  });

  it('cross-box double charges guest staker not native host', () => {
    const { state, host, guest } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(box1, 0);
    const playing = {
      ...state,
      blackjack: {
        ...actingRound(state, box1, [findCardId(state.deck!, '5'), findCardId(state.deck!, '4')], 100),
        status: 'player-turns' as const,
        activeHandKey: handKey,
        playerHands: {
          [handKey]: {
            ...actingRound(state, box1, [findCardId(state.deck!, '5'), findCardId(state.deck!, '4')], 100)
              .playerHands[handKey]!,
            stakerAmountsByPersonId: { [guest]: 100 },
          },
        },
      },
    };
    const hostBefore = derivePlayerBalanceFromLedger(host, playing.ledger);
    const guestBefore = derivePlayerBalanceFromLedger(guest, playing.ledger);
    const doubled = doubleDownBlackjackOnState(playing, handKey);
    expect(derivePlayerBalanceFromLedger(guest, doubled.ledger)).toBe(guestBefore - 100);
    expect(derivePlayerBalanceFromLedger(host, doubled.ledger)).toBe(hostBefore);
  });

  it('pair with funded stakers: split enabled', () => {
    const { state, guest } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const eightA = findCardId(state.deck!, '8', 'spades');
    const eightB = state.deck!.cards.find((c) => c.rank === '8' && c.id !== eightA)!.id;
    const handKey = blackjackHandKey(box1, 0);
    const playing = {
      ...state,
      blackjack: {
        ...actingRound(state, box1, [eightA, eightB], 100),
        status: 'player-turns' as const,
        activeHandKey: handKey,
        playerHands: {
          [handKey]: {
            ...actingRound(state, box1, [eightA, eightB], 100).playerHands[handKey]!,
            stakerAmountsByPersonId: { [guest]: 100 },
          },
        },
      },
    };
    expect(canSplitBlackjackForState(playing, handKey)).toBe(true);
    expect(getSplitFundingBlockReason(playing, handKey)).toBeNull();
  });

  it('pair with unfunded co-staker: split disabled', () => {
    const { state, host, guest } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const eightA = findCardId(state.deck!, '8', 'spades');
    const eightB = state.deck!.cards.find((c) => c.rank === '8' && c.id !== eightA)!.id;
    const handKey = blackjackHandKey(box1, 0);
    const playing = {
      ...state,
      ledger: { ...state.ledger, entries: [] },
      blackjack: {
        ...actingRound(state, box1, [eightA, eightB], 100),
        status: 'player-turns' as const,
        activeHandKey: handKey,
        playerHands: {
          [handKey]: {
            ...actingRound(state, box1, [eightA, eightB], 100).playerHands[handKey]!,
            stakerAmountsByPersonId: { [host]: 50, [guest]: 50 },
          },
        },
      },
    };
    const hostBefore = derivePlayerBalanceFromLedger(host, playing.ledger);
    const playingFunded = allocateChipsToBankrollOwner(playing, {
      bankrollOwnerId: host,
      amount: 500,
      reason: 'top-up',
      source: 'setup',
    });
    expect(canSplitBlackjackForState(playingFunded, handKey)).toBe(false);
    expect(getSplitFundingBlockReason(playingFunded, handKey)).toBe(INSUFFICIENT_SPLIT_REASON);
  });

  it('cross-box split charges guest staker not native host', () => {
    const { state, host, guest } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const eightA = findCardId(state.deck!, '8', 'spades');
    const eightB = state.deck!.cards.find((c) => c.rank === '8' && c.id !== eightA)!.id;
    const handKey = blackjackHandKey(box1, 0);
    const playing = {
      ...state,
      blackjack: {
        ...actingRound(state, box1, [eightA, eightB], 100),
        status: 'player-turns' as const,
        activeHandKey: handKey,
        playerHands: {
          [handKey]: {
            ...actingRound(state, box1, [eightA, eightB], 100).playerHands[handKey]!,
            stakerAmountsByPersonId: { [guest]: 100 },
          },
        },
      },
    };
    const hostBefore = derivePlayerBalanceFromLedger(host, playing.ledger);
    const guestBefore = derivePlayerBalanceFromLedger(guest, playing.ledger);
    const split = splitBlackjackOnState(playing, handKey);
    expect(derivePlayerBalanceFromLedger(guest, split.ledger)).toBe(guestBefore - 100);
    expect(derivePlayerBalanceFromLedger(host, split.ledger)).toBe(hostBefore);
  });
});
