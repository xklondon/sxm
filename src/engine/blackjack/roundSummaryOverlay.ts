import type { GameState } from '../../types';
import type { BlackjackOutcome } from '../../types/blackjack';
import { boxLabelForPlayer } from '../session/boxOps';
import { resolveBankrollOwnerIdForBox } from '../session/bankroll';
import { cardsFromIds, getBlackjackHandValue } from './hand';
import { orderedHandKeys } from './helpers';

export interface RoundSummaryBoxEntry {
  boxLabel: string;
  playerName: string;
  handValue: number;
  cardIds: string[];
  cardLabels: string[];
  outcome: BlackjackOutcome;
  outcomeLabel: string;
  netChips: number;
  flavorEmoji: string;
  flavorLine: string;
}

export interface RoundSummaryOverlayModel {
  dealerTotal: number;
  dealerCardIds: string[];
  bankFlavorEmoji: string;
  bankFlavorLine: string;
  entries: RoundSummaryBoxEntry[];
}

function personLabel(state: GameState, boxPlayerId: string): string {
  const ownerId = resolveBankrollOwnerIdForBox(state, boxPlayerId);
  const person = state.players[ownerId];
  return person?.controllerName || person?.displayName || boxLabelForPlayer(state, boxPlayerId);
}

export function outcomeDisplayLabel(outcome: BlackjackOutcome): string {
  switch (outcome) {
    case 'win':
      return 'Win';
    case 'loss':
      return 'Lose';
    case 'blackjack-win':
      return 'Blackjack';
    case 'push':
      return 'Push';
    case 'blackjack-push':
      return 'Push';
    default:
      return outcome;
  }
}

export function netChipsForOutcome(
  outcome: BlackjackOutcome,
  bet: number,
  blackjackPayout: number,
): number {
  switch (outcome) {
    case 'win':
      return bet;
    case 'blackjack-win':
      return Math.floor(bet * blackjackPayout);
    case 'loss':
      return -bet;
    case 'push':
    case 'blackjack-push':
      return 0;
    default:
      return 0;
  }
}

export function roundSummaryFlavor(
  outcome: BlackjackOutcome,
  netChips: number,
): { emoji: string; line: string } {
  if (outcome === 'blackjack-win') {
    return { emoji: '💰', line: 'Money raining!' };
  }
  if (outcome === 'win' && netChips >= 25) {
    return { emoji: '💸', line: 'Big win energy.' };
  }
  if (outcome === 'win') {
    return { emoji: '✨', line: 'Winner winner.' };
  }
  if (outcome === 'loss') {
    return { emoji: '😬', line: 'Ouch.' };
  }
  if (outcome === 'push' || outcome === 'blackjack-push') {
    return { emoji: '🤝', line: 'Push — breathe.' };
  }
  return { emoji: '🎲', line: 'Round noted.' };
}

function bankFlavor(dealerTotal: number, entries: RoundSummaryBoxEntry[]): { emoji: string; line: string } {
  const netTotal = entries.reduce((sum, entry) => sum + entry.netChips, 0);
  if (netTotal >= 40) {
    return { emoji: '🌧️', line: 'Table took a beating.' };
  }
  if (netTotal <= -40) {
    return { emoji: '🏦', line: 'Bank had a good round.' };
  }
  if (dealerTotal >= 21) {
    return { emoji: '🃏', line: `Bank finished on ${dealerTotal}.` };
  }
  return { emoji: '🏁', line: 'Round in the books.' };
}

/** Structured round summary for the post-round overlay. */
export function buildRoundSummaryOverlayModel(state: GameState): RoundSummaryOverlayModel | null {
  const round = state.blackjack;
  if (!round || !state.deck || !round.isSettled) {
    return null;
  }

  const dealerCards = cardsFromIds(state.deck, round.dealerCardIds.filter(Boolean));
  const dealerVal = getBlackjackHandValue(dealerCards);
  const entries: RoundSummaryBoxEntry[] = [];

  for (const handKey of orderedHandKeys(state.session, round)) {
    const hand = round.playerHands[handKey];
    const outcome = round.outcomes[handKey];
    if (!hand || hand.currentBet <= 0 || !outcome) {
      continue;
    }
    const playerCards = cardsFromIds(state.deck, hand.cardIds.filter(Boolean));
    const playerTotal = getBlackjackHandValue(playerCards);
    const netChips = netChipsForOutcome(outcome, hand.currentBet, state.blackjackSettings.blackjackPayout);
    const flavor = roundSummaryFlavor(outcome, netChips);
    entries.push({
      boxLabel: boxLabelForPlayer(state, hand.playerId),
      playerName: personLabel(state, hand.playerId),
      handValue: playerTotal.value,
      cardIds: hand.cardIds.filter(Boolean),
      cardLabels: playerCards.map((card) => `${card.rank}${card.suit}`),
      outcome,
      outcomeLabel: outcomeDisplayLabel(outcome),
      netChips,
      flavorEmoji: flavor.emoji,
      flavorLine: flavor.line,
    });
  }

  if (entries.length === 0) {
    return null;
  }

  const bank = bankFlavor(dealerVal.value, entries);
  return {
    dealerTotal: dealerVal.value,
    dealerCardIds: round.dealerCardIds.filter(Boolean),
    bankFlavorEmoji: bank.emoji,
    bankFlavorLine: bank.line,
    entries,
  };
}
