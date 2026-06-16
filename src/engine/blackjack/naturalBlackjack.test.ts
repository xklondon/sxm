import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import { createBlackjackPlayerHand } from '../../types/blackjack';
import { tableAfterStartPlaying, boxPlayerId, findCardId, actingRound } from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { addChipToBoxStake, confirmBoxStake } from './stakes';
import { blackjackHandKey } from './handKeys';
import {
  resolveNaturalsAfterInitialDeal,
  takeEvenMoneyOnState,
  waitForBlackjackPayoutOnState,
  resolvePendingNaturalsAfterDealerPeek,
} from './naturalBlackjack';
import { shouldOfferEvenMoney } from './protocols/activeRules';
import { getCardById } from '../deck/deck';
import { cardsFromIds } from './hand';
import { getBlackjackProtocolForState } from './protocolState';

function naturalDealState(dealerRank: 'A' | 'K', secondBox = false): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const box1 = boxPlayerId(state, 1)!;
  const ownerId = state.tableMeta.ownerPersonId!;
  state = addChipToBoxStake(state, box1, 50, ownerId);
  state = confirmBoxStake(state, box1);
  if (secondBox) {
    state = claimBoxSlot(state, 2);
    const box2 = boxPlayerId(state, 2)!;
    state = addChipToBoxStake(state, box2, 50, ownerId);
    state = confirmBoxStake(state, box2);
  }
  const deck = state.deck!;
  const dealerUpId = findCardId(deck, dealerRank);
  const dealerHoleId =
    deck.cards.find((c) => c.rank === '7' && c.id !== dealerUpId)?.id ?? findCardId(deck, '7');
  const reserved = new Set([dealerUpId, dealerHoleId]);
  const aceIds = deck.cards.filter((c) => c.rank === 'A' && !reserved.has(c.id)).map((c) => c.id);
  const tenIds = deck.cards
    .filter((c) => (c.rank === 'K' || c.rank === '10' || c.rank === 'Q' || c.rank === 'J') && !reserved.has(c.id))
    .map((c) => c.id);
  const playerCards: Record<string, [string, string]> = {
    [box1]: [aceIds[0]!, tenIds[0]!],
  };
  if (secondBox && boxPlayerId(state, 2)) {
    playerCards[boxPlayerId(state, 2)!] = [aceIds[1] ?? aceIds[0]!, tenIds[1] ?? tenIds[0]!];
  }

  const hands: GameState['blackjack'] extends infer R ? R : never = {
    ...actingRound(state, box1, playerCards[box1]!, 50),
    status: 'player-turns',
    dealerCardIds: [dealerUpId, dealerHoleId],
    dealerHoleHidden: true,
    playerHands: {},
  };

  for (const [boxId, cardIds] of Object.entries(playerCards)) {
    const handKey = blackjackHandKey(boxId, 0);
    hands!.playerHands[handKey] = {
      ...createBlackjackPlayerHand(boxId, 0),
      cardIds,
      currentBet: 50,
      actionStatus: 'acting',
    };
  }

  return {
    ...state,
    tableMeta: { ...state.tableMeta, bettingLocked: true },
    blackjack: hands,
  };
}

describe('even money — player natural vs dealer Ace/10', () => {
  it('offers even money vs dealer Ace', () => {
    const state = resolveNaturalsAfterInitialDeal(naturalDealState('A'));
    const box1 = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(box1, 0);
    expect(state.blackjack?.evenMoneyOfferHandKey).toBe(handKey);
    expect(state.blackjack?.playerHands[handKey]?.naturalSettled).toBeFalsy();
  });

  it('offers even money vs dealer ten-value (K)', () => {
    const state = resolveNaturalsAfterInitialDeal(naturalDealState('K'));
    const box1 = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(box1, 0);
    expect(state.blackjack?.evenMoneyOfferHandKey).toBe(handKey);
  });

  it('shouldOfferEvenMoney is true for natural vs dealer 10 when insurance is offered', () => {
    const state = naturalDealState('K');
    const protocol = getBlackjackProtocolForState(state);
    const deck = state.deck!;
    const box1 = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(box1, 0);
    const cards = cardsFromIds(deck, state.blackjack!.playerHands[handKey]!.cardIds);
    const upRank = getCardById(deck, state.blackjack!.dealerCardIds[0]!)?.rank;
    expect(shouldOfferEvenMoney(protocol, cards, upRank)).toBe(true);
  });

  it('take even money pays 1:1 and resolves hand', () => {
    let state = resolveNaturalsAfterInitialDeal(naturalDealState('K'));
    const handKey = state.blackjack!.evenMoneyOfferHandKey!;
    const bet = state.blackjack!.playerHands[handKey]!.currentBet;
    const before = state.ledger.entries.length;
    state = takeEvenMoneyOnState(state, handKey);
    expect(state.blackjack?.playerHands[handKey]?.naturalSettled).toBe(true);
    expect(state.blackjack?.evenMoneyOfferHandKey).toBeNull();
    expect(state.ledger.entries.length).toBeGreaterThan(before);
    const winEntry = state.ledger.entries.find((e) => e.description.includes('Even money'));
    expect(winEntry?.amount).toBe(bet * 2);
  });

  it('play vs dealer resolves 3:2 when dealer does not have blackjack', () => {
    let state = resolveNaturalsAfterInitialDeal(naturalDealState('K'));
    const handKey = state.blackjack!.evenMoneyOfferHandKey!;
    state = waitForBlackjackPayoutOnState(state, handKey);
    expect(state.blackjack?.evenMoneyOfferHandKey).toBeNull();
    expect(state.blackjack?.playerHands[handKey]?.naturalSettled).toBeFalsy();
    state = resolvePendingNaturalsAfterDealerPeek(state);
    expect(state.blackjack?.playerHands[handKey]?.naturalSettled).toBe(true);
    expect(state.blackjack?.outcomes?.[handKey]).toBe('blackjack-win');
  });

  it('multi-box: offers even-money when multiple naturals face dealer 10', () => {
    const state = resolveNaturalsAfterInitialDeal(naturalDealState('K', true));
    expect(Object.keys(state.blackjack!.playerHands).length).toBe(2);
    expect(state.blackjack?.evenMoneyOfferHandKey).toBeTruthy();
    const naturals = Object.values(state.blackjack!.playerHands).filter(
      (h) => h.actionStatus === 'blackjack',
    );
    expect(naturals.length).toBe(2);
  });
});
