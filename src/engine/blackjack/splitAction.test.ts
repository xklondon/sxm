import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import type { Deck, Rank } from '../../types/deck';
import { tableAfterStartPlaying, boxPlayerId, findCardId, actingRound } from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { addChipToBoxStake } from './stakes';
import { createBlackjackShoe, shuffleBlackjackShoe } from './shoe';
import { blackjackHandKey, listHandKeysForPlayer } from './handKeys';
import { splitBlackjackPlayer } from './round';
import { bankrollContextFromState } from '../session/bankroll';
import { getBlackjackProtocolForState } from './protocolState';
import { applyBlackjackActionToState, type BlackjackActorContext } from './applyBlackjackAction';
import { splitBlackjackOnState, standBlackjackOnState, startBlackjackRound } from './gameState';
import { getCallerPersonIdForBox } from '../session/playerAssignment';
import { setPersonPlayFlow } from './playFlow';

const actor: BlackjackActorContext = { personId: 'host', payload: {}, resolveBankAuto: false };

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

function pairTable(options?: { splitDrawRanks?: Rank[] }): { state: GameState; handKey: string; boxId: string } {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const boxId = boxPlayerId(state, 1)!;
  state = addChipToBoxStake(state, boxId, 50);
  state = startBlackjackRound(state);
  let deck = shuffleBlackjackShoe(createBlackjackShoe(6), 'split-action-seed');
  if (options?.splitDrawRanks?.length) {
    deck = deckWithNextDrawRanks(deck, options.splitDrawRanks);
  }
  state = { ...state, deck };
  const eightA = findCardId(deck, '8', 'spades');
  const eightB = deck.cards.find((c) => c.rank === '8' && c.id !== eightA)!.id;
  const handKey = blackjackHandKey(boxId, 0);
  const round = actingRound(state, boxId, [eightA, eightB], 25);
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

describe('split action', () => {
  it('creates two hands with one card each plus a dealt card', () => {
    const { state, handKey, boxId } = pairTable();
    const ownerId = getCallerPersonIdForBox(state, boxId)!;
    const result = splitBlackjackPlayer(
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
    const keys = listHandKeysForPlayer(result.round.playerHands, boxId);
    expect(keys).toHaveLength(2);
    expect(result.round.playerHands[keys[0]!]!.cardIds.filter(Boolean)).toHaveLength(2);
    expect(result.round.playerHands[keys[1]!]!.cardIds.filter(Boolean)).toHaveLength(2);
    expect(result.round.activeHandKey).toBe(keys[0]);
    expect(getCallerPersonIdForBox({ ...state, blackjack: result.round }, boxId)).toBe(ownerId);
  });

  it('advances from first split hand to second after stand', () => {
    let { state, handKey, boxId } = pairTable({ splitDrawRanks: ['2', '2'] });
    const ownerId = getCallerPersonIdForBox(state, boxId)!;
    state = setPersonPlayFlow(state, ownerId, 'manual');
    const split = splitBlackjackOnState(state, handKey);
    const keys = listHandKeysForPlayer(split.blackjack!.playerHands, boxId);
    expect(keys).toHaveLength(2);
    expect(split.blackjack!.playerHands[handKey]!.actionStatus).toBe('acting');
    const afterFirstStand = standBlackjackOnState(split, handKey);
    expect(afterFirstStand.blackjack!.playerHands[handKey]!.actionStatus).toBe('stood');
    const secondKey = keys.find((k) => k !== handKey)!;
    expect(afterFirstStand.blackjack!.activeHandKey).toBe(secondKey);
  });

  it('online and offline split produce the same hand layout', () => {
    const { state, handKey } = pairTable();
    const ownerId = state.tableMeta.ownerPersonId!;
    const offline = splitBlackjackOnState(state, handKey);
    const online = applyBlackjackActionToState(state, 'split', {
      ...actor,
      personId: ownerId,
    });
    const offlineKeys = Object.keys(offline.blackjack!.playerHands).sort();
    const onlineKeys = Object.keys(online.blackjack!.playerHands).sort();
    expect(onlineKeys).toEqual(offlineKeys);
    for (const key of offlineKeys) {
      expect(online.blackjack!.playerHands[key]!.cardIds).toEqual(
        offline.blackjack!.playerHands[key]!.cardIds,
      );
    }
  });

  it('split copies stakerAmountsByPersonId onto both hands', () => {
    const { state, handKey } = pairTable();
    const snapshot = { [state.tableMeta.ownerPersonId!]: 25 };
    const playing = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        playerHands: {
          ...state.blackjack!.playerHands,
          [handKey]: {
            ...state.blackjack!.playerHands[handKey]!,
            stakerAmountsByPersonId: snapshot,
          },
        },
      },
    };
    const split = splitBlackjackOnState(playing, handKey);
    const keys = listHandKeysForPlayer(split.blackjack!.playerHands, playing.blackjack!.playerHands[handKey]!.playerId);
    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(split.blackjack!.playerHands[key]!.stakerAmountsByPersonId).toEqual(snapshot);
    }
  });
});
