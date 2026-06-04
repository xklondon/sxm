import type { Card, Rank } from '../../../types/deck';
import type { Ledger } from '../../../types/ledger';
import type { GameSession } from '../../../types/session';
import type { BlackjackPlayerHand, BlackjackRound } from '../../../types/blackjack';
import { parseBlackjackHandKey } from '../handKeys';
import { handKeysWithConfirmedBets } from '../helpers';
import { derivePlayerBalanceFromLedger } from '../../ledger/ledger';
import { getCardById } from '../../deck/deck';
import { getBlackjackHandValue } from '../hand';
import { ranksMatchForSplit } from '../helpers';
import type { BlackjackProtocol } from './types';
import type { DealerDrawDecision } from '../dealerDraw';
import { evaluateDealerDraw } from '../dealerDraw';
import type { BlackjackSettings } from '../settings';

export type ProtocolPlayerAction = 'hit' | 'stand' | 'double' | 'split' | 'insurance' | 'even-money';

export interface ActiveRulesHandContext {
  handKey: string;
  hand: BlackjackPlayerHand;
  cards: Card[];
  round: BlackjackRound;
  splitCountForPlayer: number;
  availableChips: number;
  ledgerBalance: number;
  isActiveTurn: boolean;
  insuranceOfferPending: boolean;
}

export interface BetValidationResult {
  valid: boolean;
  reason?: string;
}

export interface DealerPeekPolicy {
  peekOnAce: boolean;
  peekOnTen: boolean;
  description: string;
}

const TEN_VALUE_RANKS: Rank[] = ['10', 'J', 'Q', 'K'];

export function dealerUpRankCanHaveBlackjack(upRank: Rank | undefined): boolean {
  if (!upRank) {
    return false;
  }
  return upRank === 'A' || TEN_VALUE_RANKS.includes(upRank);
}

export function getBlackjackPayout(protocol: BlackjackProtocol): number {
  return protocol.payouts.blackjackMultiplier;
}

export function getInsuranceRules(protocol: BlackjackProtocol): BlackjackProtocol['insurance'] {
  return protocol.insurance;
}

export function getDealerPeekPolicy(protocol: BlackjackProtocol): DealerPeekPolicy {
  return {
    peekOnAce: protocol.dealer.peekOnAce,
    peekOnTen: protocol.dealer.peekOnTen,
    description: protocol.dealer.description,
  };
}

export function getDealerDrawDecision(
  protocol: BlackjackProtocol,
  dealerCards: Card[],
  settings?: BlackjackSettings,
): DealerDrawDecision {
  return evaluateDealerDraw(dealerCards, settings, protocol);
}

export function isBetValidUnderProtocol(
  protocol: BlackjackProtocol,
  betAmount: number,
  minBet: number,
): BetValidationResult {
  if (betAmount <= 0) {
    return { valid: false, reason: 'Bet must be greater than zero' };
  }
  if (betAmount < minBet) {
    return { valid: false, reason: `Minimum bet is ${minBet}` };
  }
  if (betAmount % minBet !== 0) {
    return { valid: false, reason: `Bet must be a multiple of ${minBet}` };
  }
  if (betAmount > protocol.defaultMaxBet) {
    return { valid: false, reason: `Maximum bet is ${protocol.defaultMaxBet}` };
  }
  return { valid: true };
}

export function formatMinBetMultipleMessage(minBet: number): string {
  return `Bet must be a multiple of ${minBet}.`;
}

function hardTotalAllowedForDouble(
  protocol: BlackjackProtocol,
  cards: Card[],
): boolean {
  const { value, isSoft } = getBlackjackHandValue(cards);
  if (protocol.double.allowedHardTotals === 'any') {
    return !isSoft || value <= 21;
  }
  return protocol.double.allowedHardTotals.includes(value);
}

export function canDoubleUnderProtocol(
  protocol: BlackjackProtocol,
  hand: BlackjackPlayerHand,
  context: Pick<
    ActiveRulesHandContext,
    'cards' | 'round' | 'isActiveTurn' | 'insuranceOfferPending' | 'availableChips' | 'ledgerBalance'
  >,
): boolean {
  if (!protocol.double.allowed) {
    return false;
  }
  if (context.insuranceOfferPending || !context.isActiveTurn) {
    return false;
  }
  if (hand.actionStatus !== 'acting' || hand.doubled) {
    return false;
  }
  if (protocol.double.firstTwoCardsOnly && hand.cardIds.length !== 2) {
    return false;
  }
  if (hand.fromSplit && !protocol.double.allowedAfterSplit) {
    return false;
  }
  if (!hardTotalAllowedForDouble(protocol, context.cards)) {
    return false;
  }
  return context.availableChips >= hand.currentBet && context.ledgerBalance >= hand.currentBet;
}

export function canSplitUnderProtocol(
  protocol: BlackjackProtocol,
  hand: BlackjackPlayerHand,
  context: Pick<
    ActiveRulesHandContext,
    'cards' | 'round' | 'isActiveTurn' | 'insuranceOfferPending' | 'availableChips' | 'ledgerBalance' | 'splitCountForPlayer'
  > & { deck: import('../../../types/deck').Deck },
): boolean {
  if (!protocol.split.allowed) {
    return false;
  }
  if (context.insuranceOfferPending || !context.isActiveTurn) {
    return false;
  }
  if (hand.actionStatus !== 'acting' || hand.doubled || hand.cardIds.length !== 2) {
    return false;
  }
  if (context.splitCountForPlayer >= protocol.split.maxSplitsPerRound) {
    return false;
  }
  const c0 = getCardById(context.deck, hand.cardIds[0]!);
  const c1 = getCardById(context.deck, hand.cardIds[1]!);
  if (!c0 || !c1) {
    return false;
  }
  if (protocol.split.sameRankOnly && !ranksMatchForSplit(c0.rank, c1.rank)) {
    return false;
  }
  return context.availableChips >= hand.currentBet && context.ledgerBalance >= hand.currentBet;
}

export function canHitUnderProtocol(
  protocol: BlackjackProtocol,
  hand: BlackjackPlayerHand,
  context: Pick<ActiveRulesHandContext, 'isActiveTurn' | 'insuranceOfferPending'>,
): boolean {
  if (context.insuranceOfferPending || !context.isActiveTurn) {
    return false;
  }
  if (hand.naturalSettled || hand.actionStatus === 'blackjack' || hand.actionStatus === 'done') {
    return false;
  }
  if (hand.actionStatus !== 'acting' || hand.doubled) {
    return false;
  }
  return protocol.supportedActions.includes('hit');
}

export function canStandUnderProtocol(
  protocol: BlackjackProtocol,
  hand: BlackjackPlayerHand,
  context: Pick<ActiveRulesHandContext, 'isActiveTurn' | 'insuranceOfferPending'>,
): boolean {
  if (context.insuranceOfferPending || !context.isActiveTurn) {
    return false;
  }
  return hand.actionStatus === 'acting' && protocol.supportedActions.includes('stand');
}

/** Even-money (1:1 now) when player has natural and dealer up can have blackjack. */
export function shouldOfferEvenMoney(
  protocol: BlackjackProtocol,
  playerCards: Card[],
  dealerUpRank: Rank | undefined,
): boolean {
  const { isBlackjack } = getBlackjackHandValue(playerCards);
  if (!isBlackjack) {
    return false;
  }
  if (!dealerUpRankCanHaveBlackjack(dealerUpRank)) {
    return false;
  }
  return protocol.insurance.offered && (protocol.dealer.peekOnAce || protocol.dealer.peekOnTen);
}

/** Pay natural immediately when dealer up-card cannot make dealer blackjack. */
export function shouldPayNaturalImmediately(
  _protocol: BlackjackProtocol,
  playerCards: Card[],
  dealerUpRank: Rank | undefined,
): boolean {
  const { isBlackjack } = getBlackjackHandValue(playerCards);
  if (!isBlackjack) {
    return false;
  }
  return !dealerUpRankCanHaveBlackjack(dealerUpRank);
}

/** Hand may take insurance when dealer shows Ace (skip busted/natural-resolved). */
export function isHandEligibleForInsuranceOffer(
  protocol: BlackjackProtocol,
  hand: BlackjackPlayerHand,
): boolean {
  if (!protocol.insurance.offered) {
    return false;
  }
  if (hand.currentBet <= 0) {
    return false;
  }
  if (hand.bustSettled || hand.naturalSettled) {
    return false;
  }
  if (hand.actionStatus === 'busted' || hand.actionStatus === 'done') {
    return false;
  }
  if (hand.actionStatus === 'blackjack') {
    return false;
  }
  return true;
}

export function getInsuranceEligiblePlayerIds(
  session: GameSession,
  round: BlackjackRound,
  protocol: BlackjackProtocol,
): string[] {
  const ids = new Set<string>();
  for (const handKey of handKeysWithConfirmedBets(session, round)) {
    const hand = round.playerHands[handKey];
    if (!hand || !isHandEligibleForInsuranceOffer(protocol, hand)) {
      continue;
    }
    ids.add(parseBlackjackHandKey(handKey).playerId);
  }
  return [...ids];
}

/** True when every insurance-eligible box has accepted or declined. */
export function allInsuranceDecisionsResolved(
  session: GameSession,
  round: BlackjackRound,
  protocol: BlackjackProtocol,
): boolean {
  if (!round.insuranceOfferPending) {
    return true;
  }
  const eligible = getInsuranceEligiblePlayerIds(session, round, protocol);
  if (eligible.length === 0) {
    return true;
  }
  return eligible.every((playerId) => {
    const declined = round.insuranceDeclined?.[playerId];
    const bet = round.insuranceBets?.[playerId] ?? 0;
    return Boolean(declined) || bet > 0;
  });
}

export function shouldOfferInsuranceUnderProtocol(
  protocol: BlackjackProtocol,
  dealerShowsAceUp: boolean,
): boolean {
  return Boolean(protocol.insurance.offered && dealerShowsAceUp);
}

export function getAllowedActionsForHand(
  protocol: BlackjackProtocol,
  context: ActiveRulesHandContext & { deck: import('../../../types/deck').Deck },
): ProtocolPlayerAction[] {
  const actions: ProtocolPlayerAction[] = [];

  if (context.insuranceOfferPending && protocol.insurance.offered) {
    return ['insurance'];
  }

  if (context.round.evenMoneyOfferHandKey === context.handKey) {
    return ['even-money', 'stand'];
  }

  if (canHitUnderProtocol(protocol, context.hand, context)) {
    actions.push('hit');
  }
  if (canStandUnderProtocol(protocol, context.hand, context)) {
    actions.push('stand');
  }
  if (canDoubleUnderProtocol(protocol, context.hand, context)) {
    actions.push('double');
  }
  if (canSplitUnderProtocol(protocol, context.hand, context)) {
    actions.push('split');
  }

  return actions;
}

export function buildActiveRulesHandContext(
  _protocol: BlackjackProtocol,
  ledger: Ledger,
  round: BlackjackRound,
  handKey: string,
  deck: import('../../../types/deck').Deck,
  bankrollOwnerId: string,
  availableChips: number,
): ActiveRulesHandContext | null {
  const hand = round.playerHands[handKey];
  if (!hand) {
    return null;
  }
  const cards = hand.cardIds
    .map((id) => getCardById(deck, id))
    .filter((c): c is Card => c !== undefined);
  const { playerId } = hand;
  return {
    handKey,
    hand,
    cards,
    round,
    splitCountForPlayer: round.splitCounts?.[playerId] ?? 0,
    availableChips,
    ledgerBalance: derivePlayerBalanceFromLedger(bankrollOwnerId, ledger),
    isActiveTurn: round.status === 'player-turns' && round.activeHandKey === handKey,
    insuranceOfferPending: Boolean(round.insuranceOfferPending),
  };
}
