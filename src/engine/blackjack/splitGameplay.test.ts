import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import type { Deck, Rank } from '../../types/deck';
import { tableAfterStartPlaying, boxPlayerId, findCardId, actingRound } from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { addChipToBoxStake } from './stakes';
import { createBlackjackShoe, shuffleBlackjackShoe } from './shoe';
import { blackjackHandKey, listHandKeysForPlayer } from './handKeys';
import {
  splitBlackjackOnState,
  standBlackjackOnState,
  doubleDownBlackjackOnState,
  startBlackjackRound,
  resolveBankTurnAuto,
} from './gameState';
import { canDoubleBlackjackForState, canSplitBlackjackForState } from './validation';
import { getBlackjackProtocolPhase } from './protocol';
import { setPersonPlayFlow } from './playFlow';
import { getCallerPersonIdForBox } from '../session/playerAssignment';

function deckWithNextDrawRanks(deck: Deck, ranks: Rank[]): Deck {
  const usedIds = new Set<string>();
  const indices = ranks.map((rank) => {
    const card = deck.cards.find((c) => c.rank === rank && !usedIds.has(c.id));
    if (!card) {
      throw new Error(`Card not found for draw order: ${rank}`);
    }
    usedIds.add(card.id);
    return deck.cards.findIndex((c) => c.id === card.id);
  });
  const used = new Set(indices);
  return {
    ...deck,
    drawOrder: [...deck.drawOrder.filter((i) => !used.has(i)), ...indices.slice().reverse()],
  };
}

function sixPairTable(splitDrawRanks: Rank[] = ['6', '3']): {
  state: GameState;
  handKey: string;
  boxId: string;
} {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const boxId = boxPlayerId(state, 1)!;
  state = addChipToBoxStake(state, boxId, 50);
  state = startBlackjackRound(state);
  let deck = shuffleBlackjackShoe(createBlackjackShoe(6), 'split-gameplay-six');
  deck = deckWithNextDrawRanks(deck, splitDrawRanks);
  state = { ...state, deck };
  const sixA = findCardId(deck, '6', 'spades');
  const sixB = deck.cards.find((c) => c.rank === '6' && c.id !== sixA)!.id;
  const handKey = blackjackHandKey(boxId, 0);
  const round = actingRound(state, boxId, [sixA, sixB], 25);
  return {
    boxId,
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

describe('split gameplay model', () => {
  it('6+6 split creates two hands with one original 6 each plus one dealt card', () => {
    const { state, handKey, boxId } = sixPairTable(['6', '3']);
    const split = splitBlackjackOnState(state, handKey);
    const keys = listHandKeysForPlayer(split.blackjack!.playerHands, boxId).sort();
    expect(keys).toHaveLength(2);
    for (const key of keys) {
      const hand = split.blackjack!.playerHands[key]!;
      expect(hand.cardIds.filter(Boolean)).toHaveLength(2);
      expect(hand.cardIds[0]).toBeTruthy();
    }
    const deck = split.deck!;
    const ranks = keys.map((key) =>
      split.blackjack!.playerHands[key]!.cardIds.map((id) => deck.cards.find((c) => c.id === id)!.rank),
    );
    expect(ranks.flat().filter((r) => r === '6')).toHaveLength(3);
  });

  it('each split hand keeps the same wager as the original hand', () => {
    const { state, handKey, boxId } = sixPairTable(['2', '2']);
    const originalBet = state.blackjack!.playerHands[handKey]!.currentBet;
    const split = splitBlackjackOnState(state, handKey);
    for (const key of listHandKeysForPlayer(split.blackjack!.playerHands, boxId)) {
      expect(split.blackjack!.playerHands[key]!.currentBet).toBe(originalBet);
    }
  });

  it('active hand advances from first split hand to second after stand', () => {
    let { state, handKey, boxId } = sixPairTable(['2', '2']);
    const ownerId = getCallerPersonIdForBox(state, boxId)!;
    state = setPersonPlayFlow(state, ownerId, 'manual');
    const split = splitBlackjackOnState(state, handKey);
    const keys = listHandKeysForPlayer(split.blackjack!.playerHands, boxId);
    expect(split.blackjack!.activeHandKey).toBe(handKey);
    const afterStand = standBlackjackOnState(split, handKey);
    const secondKey = keys.find((k) => k !== handKey)!;
    expect(afterStand.blackjack!.activeHandKey).toBe(secondKey);
    expect(afterStand.blackjack!.playerHands[handKey]!.actionStatus).toBe('stood');
    expect(afterStand.blackjack!.playerHands[secondKey]!.actionStatus).toBe('acting');
  });

  it('offers split again when first split hand receives another pair and rules allow', () => {
    const { state, handKey } = sixPairTable(['6', '3']);
    const split = splitBlackjackOnState(state, handKey);
    expect(canSplitBlackjackForState(split, handKey)).toBe(true);
    const resplit = splitBlackjackOnState(split, handKey);
    expect(listHandKeysForPlayer(resplit.blackjack!.playerHands, split.blackjack!.playerHands[handKey]!.playerId)).toHaveLength(3);
  });

  it('6+3 split hand offers double when totals 9/10/11 and rules allow', () => {
    const { state, handKey } = sixPairTable(['6', '3']);
    let current = splitBlackjackOnState(state, handKey);
    const keys = listHandKeysForPlayer(current.blackjack!.playerHands, current.blackjack!.playerHands[handKey]!.playerId);
    const secondKey = keys.find((k) => k !== handKey)!;
    current = standBlackjackOnState(current, handKey);
    expect(current.blackjack!.activeHandKey).toBe(secondKey);
    expect(canDoubleBlackjackForState(current, secondKey)).toBe(true);
    expect(canSplitBlackjackForState(current, secondKey)).toBe(false);
  });

  it('settlement resolves all split hands without crash', () => {
    let { state, handKey, boxId } = sixPairTable(['2', '2']);
    const ownerId = getCallerPersonIdForBox(state, boxId)!;
    state = setPersonPlayFlow(state, ownerId, 'manual');
    let current = splitBlackjackOnState(state, handKey);
    const keys = listHandKeysForPlayer(current.blackjack!.playerHands, boxId);
    for (const key of keys) {
      if (current.blackjack!.activeHandKey === key) {
        current = standBlackjackOnState(current, key);
      }
    }
    current = {
      ...current,
      blackjack: {
        ...current.blackjack!,
        status: 'bank-turn',
        dealerHoleHidden: false,
      },
    };
    const settled = resolveBankTurnAuto(current);
    expect(settled.blackjack?.status).toBe('resolved');
    for (const key of keys) {
      expect(settled.blackjack!.outcomes[key]).toBeTruthy();
    }
    expect(getBlackjackProtocolPhase(settled)).toBe('round-complete');
  });

  it('routes player actions by handKey not boxId alone', () => {
    const { state, handKey, boxId } = sixPairTable(['2', '3']);
    let current = splitBlackjackOnState(state, handKey);
    const keys = listHandKeysForPlayer(current.blackjack!.playerHands, boxId);
    expect(keys.every((k) => k.includes(':'))).toBe(true);
    expect(current.blackjack!.activeHandKey).toBe(handKey);
    const secondKey = keys.find((k) => k !== handKey)!;
    current = standBlackjackOnState(current, handKey);
    expect(current.blackjack!.activeHandKey).toBe(secondKey);
    const doubled = doubleDownBlackjackOnState(current, secondKey);
    expect(doubled.blackjack!.playerHands[secondKey]!.doubled).toBe(true);
    expect(doubled.blackjack!.playerHands[secondKey]!.cardIds).toHaveLength(3);
    expect(doubled.blackjack!.playerHands[handKey]!.cardIds).toHaveLength(2);
  });
});
