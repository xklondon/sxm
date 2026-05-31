import type { GameSession } from '../../types/session';
import type { BlackjackRound } from '../../types/blackjack';
import { handKeysWithConfirmedBets } from './helpers';
import { parseBlackjackHandKey } from './handKeys';

export type DealRevealTarget =
  | { type: 'box'; handKey: string; playerId: string; cardIndex: number; cardId: string }
  | { type: 'dealer'; cardIndex: number; cardId: string; faceDown?: boolean };

/** Standard round-robin initial deal order for UI reveal. */
export function buildInitialDealSequence(
  session: GameSession,
  round: BlackjackRound,
): DealRevealTarget[] {
  const handKeys = handKeysWithConfirmedBets(session, round);
  const steps: DealRevealTarget[] = [];

  for (const handKey of handKeys) {
    const hand = round.playerHands[handKey];
    const cardId = hand?.cardIds[0];
    if (cardId) {
      steps.push({
        type: 'box',
        handKey,
        playerId: parseBlackjackHandKey(handKey).playerId,
        cardIndex: 0,
        cardId,
      });
    }
  }

  if (round.dealerCardIds[0]) {
    steps.push({
      type: 'dealer',
      cardIndex: 0,
      cardId: round.dealerCardIds[0],
    });
  }

  for (const handKey of handKeys) {
    const hand = round.playerHands[handKey];
    const cardId = hand?.cardIds[1];
    if (cardId) {
      steps.push({
        type: 'box',
        handKey,
        playerId: parseBlackjackHandKey(handKey).playerId,
        cardIndex: 1,
        cardId,
      });
    }
  }

  if (round.dealerCardIds[1]) {
    steps.push({
      type: 'dealer',
      cardIndex: 1,
      cardId: round.dealerCardIds[1],
      faceDown: round.dealerHoleHidden,
    });
  }

  return steps;
}
