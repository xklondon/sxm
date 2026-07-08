import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import type { Rank } from '../../types/deck';
import { tableAfterStartPlaying, boxPlayerId, findCardId, actingRound, tableWithClaimedBox } from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { addChipToBoxStake } from './stakes';
import { createBlackjackShoe, shuffleBlackjackShoe } from './shoe';
import { blackjackHandKey } from './handKeys';
import { cardsFromIds, getBlackjackHandValue } from './hand';
import { doubleDownBlackjackPlayer } from './round';
import { bankrollContextFromState } from '../session/bankroll';
import { getBlackjackProtocolForState } from './protocolState';
import { applyBlackjackActionToState, type BlackjackActorContext } from './applyBlackjackAction';
import { doubleDownBlackjackOnState, hitBlackjackOnState, startBlackjackRound } from './gameState';
import {
  canDoubleBlackjackForState,
  resolveDoubleAvailabilityForHand,
} from './validation';
import { INSUFFICIENT_DOUBLE_REASON } from './handFunding';
import { applyCardVisibility, maxVisibilityForRound, nextSequentialRevealStep } from './dealing/cardRevealDisplay';
import { isNaturalInitialDeal } from './dealing/dealingModes';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { syncPlayerOrderAndAssignments } from '../session/playerAssignment';
import { confirmBoxStake } from './stakes';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { dealCardsButtonOnState } from './gameState';
import { shuffleTableForDeal } from './sanity/fixtures';
import { resolvePlayerHandActionOptions } from '../../components/blackjackActionContract';

const actor: BlackjackActorContext = { personId: 'host', payload: {}, resolveBankAuto: false };

function baseTable(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const boxId = boxPlayerId(state, 1)!;
  state = addChipToBoxStake(state, boxId, 50);
  state = startBlackjackRound(state);
  const deck = shuffleBlackjackShoe(createBlackjackShoe(6), 'double-action-seed');
  return { ...state, deck };
}

function playerTurn(
  state: GameState,
  ranks: [Rank, Rank],
  bet = 25,
): { state: GameState; handKey: string } {
  const boxId = boxPlayerId(state, 1)!;
  const deck = state.deck!;
  const handKey = blackjackHandKey(boxId, 0);
  const round = actingRound(state, boxId, [findCardId(deck, ranks[0]), findCardId(deck, ranks[1])], bet);
  return {
    handKey,
    state: {
      ...state,
      blackjack: {
        ...round,
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
      },
    },
  };
}

describe('double down action', () => {
  it('double on two-card hard 9 deals exactly one card and stands', () => {
    const { state, handKey } = playerTurn(baseTable(), ['5', '4']);
    const hand = state.blackjack!.playerHands[handKey]!;
    const beforeCards = hand.cardIds.filter(Boolean);
    expect(beforeCards).toHaveLength(2);
    expect(getBlackjackHandValue(cardsFromIds(state.deck!, beforeCards)).value).toBe(9);
    expect(canDoubleBlackjackForState(state, handKey)).toBe(true);

    const betBefore = hand.currentBet;
    const result = doubleDownBlackjackPlayer(
      state.session,
      state.players,
      state.ledger,
      state.deck!,
      state.blackjack!,
      handKey,
      bankrollContextFromState(state),
      state.blackjackSettings,
      getBlackjackProtocolForState(state),
    );
    const doubled = result.round.playerHands[handKey]!;
    expect(doubled.cardIds.filter(Boolean)).toHaveLength(3);
    expect(doubled.doubled).toBe(true);
    expect(doubled.currentBet).toBe(betBefore * 2);
    expect(doubled.actionStatus).toBe('stood');
    expect(result.round.activeHandKey).not.toBe(handKey);
  });

  it('rejects double after hit', () => {
    const { state, handKey } = playerTurn(baseTable(), ['5', '6']);
    const afterHit = hitBlackjackOnState(state, handKey);
    expect(canDoubleBlackjackForState(afterHit, handKey)).toBe(false);
  });

  it('online and offline double produce the same hand state', () => {
    const { state, handKey } = playerTurn(baseTable(), ['5', '4']);
    const offline = doubleDownBlackjackOnState(state);
    const online = applyBlackjackActionToState(state, 'double', actor);
    expect(online.blackjack!.playerHands[handKey]!.cardIds).toEqual(
      offline.blackjack!.playerHands[handKey]!.cardIds,
    );
    expect(online.blackjack!.playerHands[handKey]!.actionStatus).toBe(
      offline.blackjack!.playerHands[handKey]!.actionStatus,
    );
    expect(online.blackjack!.playerHands[handKey]!.doubled).toBe(true);
  });

  it('hard 11 two-card active hand enables double for caller', () => {
    const { state, handKey } = playerTurn(baseTable(), ['5', '6']);
    const cards = cardsFromIds(state.deck!, state.blackjack!.playerHands[handKey]!.cardIds);
    expect(getBlackjackHandValue(cards).value).toBe(11);
    expect(resolveDoubleAvailabilityForHand(state, handKey)).toEqual({
      canDouble: true,
      blockReason: null,
    });
  });

  it('hard 10 enables double', () => {
    const { state, handKey } = playerTurn(baseTable(), ['6', '4']);
    expect(canDoubleBlackjackForState(state, handKey)).toBe(true);
  });

  it('insufficient funds blocks double with clear reason', () => {
    const { state, handKey } = playerTurn(tableWithClaimedBox(1), ['5', '6'], 400);
    const availability = resolveDoubleAvailabilityForHand(state, handKey);
    expect(availability.canDouble).toBe(false);
    expect(availability.blockReason).toBe(INSUFFICIENT_DOUBLE_REASON);
  });

  it('co-staked hand doubles per contributor when all can fund', () => {
    let state = tableAfterStartPlaying(500);
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
      amount: 500,
      reason: 'initial-player',
      source: 'setup',
    });
    state = { ...state, tableMeta: { ...state.tableMeta, playerOrder: [host, guest] } };
    state = syncPlayerOrderAndAssignments(state);
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, boxId, 50, host);
    state = addChipToBoxStake(state, boxId, 50, guest);
    state = confirmBoxStake(state, boxId);
    state = startBlackjackRound(state);
    const deck = shuffleBlackjackShoe(createBlackjackShoe(6), 'co-double');
    state = { ...state, deck };
    const handKey = blackjackHandKey(boxId, 0);
    const round = actingRound(state, boxId, [findCardId(deck, '5'), findCardId(deck, '6')], 100);
    state = {
      ...state,
      blackjack: {
        ...round,
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
        playerHands: {
          [handKey]: {
            ...round.playerHands[handKey]!,
            stakerAmountsByPersonId: { [host]: 50, [guest]: 50 },
          },
        },
      },
    };
    expect(resolveDoubleAvailabilityForHand(state, handKey).canDouble).toBe(true);
    const hostBefore = derivePlayerBalanceFromLedger(host, state.ledger);
    const guestBefore = derivePlayerBalanceFromLedger(guest, state.ledger);
    const doubled = doubleDownBlackjackOnState(state);
    expect(derivePlayerBalanceFromLedger(host, doubled.ledger)).toBe(hostBefore - 50);
    expect(derivePlayerBalanceFromLedger(guest, doubled.ledger)).toBe(guestBefore - 50);
    expect(doubled.blackjack!.playerHands[handKey]!.currentBet).toBe(200);
  });

  it('co-staked hard 10 (8+2) enables double through deal path without hand snapshot override', () => {
    let state = tableAfterStartPlaying(500);
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
      amount: 500,
      reason: 'initial-player',
      source: 'setup',
    });
    state = { ...state, tableMeta: { ...state.tableMeta, playerOrder: [host, guest] } };
    state = syncPlayerOrderAndAssignments(state);
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, boxId, 50, host);
    state = addChipToBoxStake(state, boxId, 50, guest);
    state = confirmBoxStake(state, boxId);
    state = startBlackjackRound(state);
    state = dealCardsButtonOnState(shuffleTableForDeal(state));
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    const hand = state.blackjack!.playerHands[handKey]!;
    expect(hand.stakerAmountsByPersonId).toEqual({ [host]: 50, [guest]: 50 });
    state = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
        playerHands: {
          ...state.blackjack!.playerHands,
          [handKey]: {
            ...hand,
            cardIds: [findCardId(deck, '8'), findCardId(deck, '2')],
            actionStatus: 'acting',
          },
        },
      },
      tableMeta: { ...state.tableMeta, bettingLocked: true },
    };
    expect(resolveDoubleAvailabilityForHand(state, handKey)).toEqual({
      canDouble: true,
      blockReason: null,
    });
    const ui = resolvePlayerHandActionOptions(state, handKey, state.blackjackSettings, true);
    expect(ui.showDouble).toBe(true);
    expect(ui.canDouble).toBe(true);
  });

  it('co-staked hard 10 blocks double with funding reason when one staker cannot fund', () => {
    let state = tableAfterStartPlaying(500);
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
      amount: 50,
      reason: 'initial-player',
      source: 'setup',
    });
    state = { ...state, tableMeta: { ...state.tableMeta, playerOrder: [host, guest] } };
    state = syncPlayerOrderAndAssignments(state);
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = shuffleBlackjackShoe(createBlackjackShoe(6), 'co-double-block');
    state = {
      ...state,
      deck,
      tableMeta: { ...state.tableMeta, bettingLocked: true },
      blackjack: {
        ...actingRound(state, boxId, [findCardId(deck, '8'), findCardId(deck, '2')], 400),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
        playerHands: {
          [handKey]: {
            ...actingRound(state, boxId, [findCardId(deck, '8'), findCardId(deck, '2')], 400)
              .playerHands[handKey]!,
            stakerAmountsByPersonId: { [host]: 200, [guest]: 200 },
          },
        },
      },
    };
    const availability = resolveDoubleAvailabilityForHand(state, handKey);
    expect(availability.canDouble).toBe(false);
    expect(availability.blockReason).toBe(INSUFFICIENT_DOUBLE_REASON);
    const ui = resolvePlayerHandActionOptions(state, handKey, state.blackjackSettings, true);
    expect(ui.showDouble).toBe(true);
    expect(ui.canDouble).toBe(false);
    expect(ui.doubleBlockReason).toBe(INSUFFICIENT_DOUBLE_REASON);
  });

  it('offline double uses activeHandKey only', () => {
    const { state, handKey } = playerTurn(baseTable(), ['5', '6']);
    const doubled = doubleDownBlackjackOnState(state);
    expect(doubled.blackjack!.playerHands[handKey]!.doubled).toBe(true);
  });

  it('double reveal uses global interval and does not block next hand', () => {
    const { state, handKey } = playerTurn(baseTable(), ['5', '4']);
    const doubled = doubleDownBlackjackOnState(state);
    const target = maxVisibilityForRound(doubled.blackjack);
    const visible = { dealer: target.dealer, hands: { [handKey]: 2 } };
    const step = nextSequentialRevealStep(visible, target, doubled.blackjack, 'player-turns');
    expect(step?.hands[handKey]).toBe(3);
  });

  it('natural dealing keeps full authoritative hand while masking display', () => {
    const { state, handKey } = playerTurn(baseTable(), ['5', '4']);
    const withNatural = {
      ...state,
      blackjackFlowSettings: {
        ...state.blackjackFlowSettings,
        initialDealMode: 'natural' as const,
        dealSpeedPreset: 'fast' as const,
      },
    };
    expect(isNaturalInitialDeal(withNatural.blackjackFlowSettings.initialDealMode)).toBe(true);
    const authoritative = doubleDownBlackjackOnState(withNatural, handKey);
    const target = maxVisibilityForRound(authoritative.blackjack);
    const masked = applyCardVisibility(authoritative, {
      ...target,
      hands: { [handKey]: 2 },
    });
    expect(masked.blackjack!.playerHands[handKey]!.cardIds).toHaveLength(2);
    expect(authoritative.blackjack!.playerHands[handKey]!.cardIds).toHaveLength(3);
  });
});
