import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import { tableWithClaimedBox, boxPlayerId, findCardId, actingRound } from './sanity/fixtures';
import { createBlackjackShoe, shuffleBlackjackShoe } from './shoe';
import {
  dealCardsButtonOnState,
  doubleDownBlackjackOnState,
  hitBlackjackOnState,
  shuffleToStartOnState,
  startBlackjackRound,
  completeStepwiseInitialDealIfNeeded,
} from './gameState';
import { addChipToBoxStake } from './stakes';
import { canDoubleBlackjackForState } from './validation';
import { doubleDownBlackjackPlayer } from './round';
import { bankrollContextFromState } from '../session/bankroll';
import { getBlackjackProtocolForState } from './protocolState';
import { applyBlackjackActionToState } from './applyBlackjackAction';
import { setBlackjackProtocolOnState } from './protocolState';
import { LAS_VEGAS_PROTOCOL } from './protocols';
import { cardsFromIds, getBlackjackHandValue } from './hand';

function readyLasVegasDeal(): GameState {
  let state = setBlackjackProtocolOnState(tableWithClaimedBox(1), LAS_VEGAS_PROTOCOL.protocolId, 'Alice');
  const boxId = boxPlayerId(state, 1)!;
  state = startBlackjackRound(state);
  state = addChipToBoxStake(state, boxId, 50);
  state = shuffleToStartOnState({
    ...state,
    deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'lv-round-test'),
  });
  return state;
}

describe('Las Vegas protocol round', () => {
  it('double on hard 9/10/11 deals one card and stands', () => {
    for (const ranks of [['5', '4'], ['5', '5'], ['5', '6']] as const) {
      let state = readyLasVegasDeal();
      const boxId = boxPlayerId(state, 1)!;
      const deck = state.deck!;
      const handKey = `${boxId}:0`;
      state = {
        ...state,
        blackjack: actingRound(state, boxId, [findCardId(deck, ranks[0]), findCardId(deck, ranks[1])], 25),
      };
      expect(canDoubleBlackjackForState(state, handKey)).toBe(true);
      const next = doubleDownBlackjackOnState(state, handKey);
      const hand = next.blackjack!.playerHands[handKey]!;
      expect(hand.cardIds.filter(Boolean)).toHaveLength(3);
      expect(hand.actionStatus).toBe('stood');
      expect(hand.doubled).toBe(true);
    }
  });

  it('rejects double on hard 8 and 12', () => {
    let state = readyLasVegasDeal();
    const boxId = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    const handKey = `${boxId}:0`;
    state = {
      ...state,
      blackjack: actingRound(state, boxId, [findCardId(deck, '3'), findCardId(deck, '5')], 25),
    };
    expect(canDoubleBlackjackForState(state, handKey)).toBe(false);
    state = {
      ...state,
      blackjack: actingRound(state, boxId, [findCardId(deck, '10'), findCardId(deck, '2')], 25),
    };
    expect(canDoubleBlackjackForState(state, handKey)).toBe(false);
  });

  it('rejects double after hit', () => {
    let state = readyLasVegasDeal();
    const boxId = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    const handKey = `${boxId}:0`;
    state = {
      ...state,
      blackjack: actingRound(state, boxId, [findCardId(deck, '5'), findCardId(deck, '6')], 25),
    };
    const afterHit = hitBlackjackOnState(state, handKey);
    expect(canDoubleBlackjackForState(afterHit, handKey)).toBe(false);
  });

  it('online double matches offline engine', () => {
    let state = readyLasVegasDeal();
    const boxId = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    const handKey = `${boxId}:0`;
    state = {
      ...state,
      blackjack: actingRound(state, boxId, [findCardId(deck, '5'), findCardId(deck, '4')], 25),
    };
    const offline = doubleDownBlackjackOnState(state, handKey);
    const online = applyBlackjackActionToState(state, 'double', {
      personId: state.tableMeta.ownerPersonId!,
      payload: {},
      resolveBankAuto: false,
    });
    expect(online.blackjack!.playerHands[handKey]!.cardIds).toEqual(
      offline.blackjack!.playerHands[handKey]!.cardIds,
    );
  });

  it('initial deal via dealCards uses full authoritative deal (instant path)', () => {
    const state = readyLasVegasDeal();
    const dealt = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
    const hand = Object.values(dealt.blackjack!.playerHands)[0]!;
    expect(hand.cardIds.filter(Boolean).length).toBeGreaterThanOrEqual(2);
    expect(dealt.blackjack?.dealerCardIds.filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });

  it('doubleDownBlackjackPlayer draws exactly one card', () => {
    let state = readyLasVegasDeal();
    const boxId = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    const handKey = `${boxId}:0`;
    const round = actingRound(state, boxId, [findCardId(deck, '5'), findCardId(deck, '4')], 25);
    const result = doubleDownBlackjackPlayer(
      state.session,
      state.players,
      state.ledger,
      deck,
      round,
      handKey,
      bankrollContextFromState(state),
      state.blackjackSettings,
      getBlackjackProtocolForState(state),
    );
    const cards = cardsFromIds(result.deck, result.round.playerHands[handKey]!.cardIds);
    expect(cards).toHaveLength(3);
    expect(getBlackjackHandValue(cards).value).toBeGreaterThan(9);
  });
});
