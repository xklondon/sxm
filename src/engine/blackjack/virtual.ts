import type { Player } from '../../types/player';
import type { BlackjackRound } from '../../types/blackjack';
import { getBlackjackHandValue, cardsFromIds } from './hand';
import type { Deck } from '../../types/deck';
import { orderedHandKeys } from './helpers';
import { parseBlackjackHandKey } from './handKeys';

/** Deterministic virtual player: hit under 16, stand on 16+. */
export function getVirtualBlackjackAction(
  round: BlackjackRound,
  handKey: string,
  deck: Deck,
): 'hit' | 'stand' {
  const hand = round.playerHands[handKey];
  if (!hand || hand.actionStatus !== 'acting') {
    return 'stand';
  }

  const cards = cardsFromIds(deck, hand.cardIds);
  const { value } = getBlackjackHandValue(cards);
  return value < 16 ? 'hit' : 'stand';
}

export function isVirtualPlayer(players: Record<string, Player>, playerId: string): boolean {
  return players[playerId]?.playerType === 'virtual';
}

export function findNextActingHand(
  session: import('../../types/session').GameSession,
  round: BlackjackRound,
  afterHandKey?: string,
): string | null {
  const keys = orderedHandKeys(session, round);
  const startIndex = afterHandKey ? keys.indexOf(afterHandKey) + 1 : 0;

  for (let i = startIndex; i < keys.length; i += 1) {
    const key = keys[i];
    if (round.playerHands[key]?.actionStatus === 'acting') {
      return key;
    }
  }
  return null;
}

export function activePlayerIdFromRound(round: BlackjackRound): string | null {
  if (!round.activeHandKey) {
    return null;
  }
  return parseBlackjackHandKey(round.activeHandKey).playerId;
}
