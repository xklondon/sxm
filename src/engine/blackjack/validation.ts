import type { GameSession } from '../../types/session';
import { createEmptySession } from '../../types/session';
import type { GameState } from '../../types';
import type { Ledger } from '../../types/ledger';
import type { Deck } from '../../types/deck';
import type { BlackjackRound } from '../../types/blackjack';
import { createEmptyBlackjackRound, createBlackjackPlayerHand } from '../../types/blackjack';
import type { BlackjackSettings } from './settings';
import { DEFAULT_BLACKJACK_SETTINGS } from './settings';
import { runBlackjackRulesAudit } from './rules';
import { blackjackHandKey, parseBlackjackHandKey } from './handKeys';
import { getBettingPlayerIds, hasAnyConfirmedBets } from './helpers';
import { getBlackjackProtocolForState } from './protocolState';
import {
  buildActiveRulesHandContext,
  canDoubleUnderProtocol,
  canHitUnderProtocol,
  canSplitUnderProtocol,
  canStandUnderProtocol,
} from './protocols/activeRules';
import {
  resolveFundableActionParticipants,
  resolveHandFundingParticipants,
  resolveProportionalFundingCapacity,
  INSUFFICIENT_DOUBLE_REASON,
  INSUFFICIENT_SPLIT_REASON,
} from './handFunding';

export function canPlaceBlackjackBet(round: BlackjackRound): boolean {
  return round.status === 'betting';
}

export function canDrawBankCard(round: BlackjackRound): boolean {
  return round.status === 'bank-turn';
}

export function canCompleteBanking(round: BlackjackRound): boolean {
  return round.status === 'banking';
}

export function canDealNextInitialCard(round: BlackjackRound): boolean {
  return round.status === 'initial-deal';
}

export function canDealInitialBlackjack(
  session: GameSession,
  round: BlackjackRound,
): boolean {
  return round.status === 'betting' && hasAnyConfirmedBets(session, round);
}

function rulesContextForHand(state: GameState, handKey: string) {
  const round = state.blackjack;
  const deck = state.deck;
  if (!round || !deck) {
    return null;
  }
  const protocol = getBlackjackProtocolForState(state);
  const { playerId } = parseBlackjackHandKey(handKey);
  const hand = round.playerHands[handKey];
  if (!hand) {
    return null;
  }
  const participants = resolveHandFundingParticipants(state, hand, playerId);
  const fundingPersonId = participants[0]?.personId ?? playerId;
  const availableForDouble = resolveProportionalFundingCapacity(participants, hand.currentBet);
  const ctx = buildActiveRulesHandContext(
    protocol,
    state.ledger,
    round,
    handKey,
    deck,
    fundingPersonId,
    availableForDouble,
  );
  return ctx ? { protocol, ctx, deck, participants } : null;
}

/** Block reason when double is rule-legal but stakers cannot fund the additional bet. */
export function getDoubleFundingBlockReason(state: GameState, handKey: string): string | null {
  const built = rulesContextForHand(state, handKey);
  if (!built) {
    return 'Hand not ready.';
  }
  const { hand } = built.ctx;
  const { playerId } = parseBlackjackHandKey(handKey);
  const resolution = resolveFundableActionParticipants(state, hand, playerId, 'double');
  if (!resolution.canFundAll) {
    return INSUFFICIENT_DOUBLE_REASON;
  }
  if (!canDoubleUnderProtocol(built.protocol, hand, built.ctx)) {
    return null;
  }
  return null;
}

export function getSplitFundingBlockReason(state: GameState, handKey: string): string | null {
  const built = rulesContextForHand(state, handKey);
  if (!built) {
    return 'Hand not ready.';
  }
  const { hand } = built.ctx;
  const { playerId } = parseBlackjackHandKey(handKey);
  const resolution = resolveFundableActionParticipants(state, hand, playerId, 'split');
  if (!resolution.canFundAll) {
    return INSUFFICIENT_SPLIT_REASON;
  }
  if (!canSplitUnderProtocol(built.protocol, hand, { ...built.ctx, deck: built.deck })) {
    return null;
  }
  return null;
}

export function canHitBlackjack(round: BlackjackRound, handKey: string): boolean {
  if (round.evenMoneyOfferHandKey || round.insuranceOfferPending) {
    return false;
  }
  if (round.status !== 'player-turns' || round.activeHandKey !== handKey) {
    return false;
  }
  const hand = round.playerHands[handKey];
  return hand?.actionStatus === 'acting' && !hand.doubled && !hand.naturalSettled;
}

export function canStandBlackjack(round: BlackjackRound, handKey: string): boolean {
  if (round.insuranceOfferPending) {
    return false;
  }
  if (round.status !== 'player-turns' || round.activeHandKey !== handKey) {
    return false;
  }
  return round.playerHands[handKey]?.actionStatus === 'acting';
}

export function canDoubleBlackjack(
  _ledger: Ledger,
  _round: BlackjackRound,
  handKey: string,
  _settings?: BlackjackSettings,
  deck?: Deck,
  _bankrollOwnerId?: string,
  state?: GameState,
): boolean {
  if (!state || !deck) {
    return false;
  }
  const built = rulesContextForHand(state, handKey);
  return built ? canDoubleUnderProtocol(built.protocol, built.ctx.hand, built.ctx) : false;
}

/** Canonical double availability — UI and command copy must use this only. */
export interface DoubleAvailability {
  canDouble: boolean;
  blockReason: string | null;
}

export function resolveDoubleAvailabilityForHand(
  state: GameState,
  handKey: string,
): DoubleAvailability {
  const round = state.blackjack;
  if (!round || !state.deck) {
    return { canDouble: false, blockReason: 'Hand not ready.' };
  }
  if (!state.blackjackSettings.allowDoubleDown) {
    return { canDouble: false, blockReason: 'Double down is disabled for this table.' };
  }
  if (round.status !== 'player-turns' || round.activeHandKey !== handKey) {
    return { canDouble: false, blockReason: 'Not the active hand.' };
  }
  const hand = round.playerHands[handKey];
  if (!hand || hand.actionStatus !== 'acting' || hand.doubled) {
    return { canDouble: false, blockReason: 'Double not allowed for this hand.' };
  }
  const built = rulesContextForHand(state, handKey);
  if (!built) {
    return { canDouble: false, blockReason: 'Hand not ready.' };
  }
  const { playerId } = parseBlackjackHandKey(handKey);
  const funding = resolveFundableActionParticipants(state, hand, playerId, 'double');
  if (!canDoubleUnderProtocol(built.protocol, hand, built.ctx)) {
    const fundingReason = getDoubleFundingBlockReason(state, handKey);
    if (fundingReason) {
      return { canDouble: false, blockReason: fundingReason };
    }
    if (hand.cardIds.length !== 2) {
      return { canDouble: false, blockReason: 'Double only on the first two cards.' };
    }
    return { canDouble: false, blockReason: 'Double not allowed on this hand total.' };
  }
  if (!funding.canFundAll) {
    return { canDouble: false, blockReason: INSUFFICIENT_DOUBLE_REASON };
  }
  return { canDouble: true, blockReason: null };
}

export function canDoubleBlackjackForState(state: GameState, handKey: string): boolean {
  return resolveDoubleAvailabilityForHand(state, handKey).canDouble;
}

export function canSplitBlackjack(
  _ledger: Ledger,
  deck: Deck,
  _round: BlackjackRound,
  handKey: string,
  _settings?: BlackjackSettings,
  _bankrollOwnerId?: string,
  state?: GameState,
): boolean {
  if (!state) {
    return false;
  }
  const built = rulesContextForHand(state, handKey);
  return built
    ? canSplitUnderProtocol(built.protocol, built.ctx.hand, { ...built.ctx, deck })
    : false;
}

export function canSplitBlackjackForState(state: GameState, handKey: string): boolean {
  const built = rulesContextForHand(state, handKey);
  if (!built || !canSplitUnderProtocol(built.protocol, built.ctx.hand, { ...built.ctx, deck: built.deck })) {
    return false;
  }
  const { playerId } = parseBlackjackHandKey(handKey);
  return resolveFundableActionParticipants(state, built.ctx.hand, playerId, 'split').canFundAll;
}

/** Split/Double legality as if the hand were still acting — for auto-stop hold retrospection. */
export function getPlayerOptionalActionGateIfActing(
  state: GameState,
  handKey: string,
): { canSplit: boolean; canDouble: boolean } {
  const built = rulesContextForHand(state, handKey);
  if (!built) {
    return { canSplit: false, canDouble: false };
  }
  return {
    canSplit: canSplitBlackjackForState(state, handKey),
    canDouble: canDoubleBlackjackForState(state, handKey),
  };
}

export function canHitBlackjackForState(state: GameState, handKey: string): boolean {
  if (!state.blackjack || !canHitBlackjack(state.blackjack, handKey)) {
    return false;
  }
  const built = rulesContextForHand(state, handKey);
  return built ? canHitUnderProtocol(built.protocol, built.ctx.hand, built.ctx) : false;
}

export function canStandBlackjackForState(state: GameState, handKey: string): boolean {
  if (!state.blackjack || !canStandBlackjack(state.blackjack, handKey)) {
    return false;
  }
  const built = rulesContextForHand(state, handKey);
  return built ? canStandUnderProtocol(built.protocol, built.ctx.hand, built.ctx) : false;
}

export interface BlackjackCheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export function runBlackjackEngineChecks(): { passed: boolean; results: BlackjackCheckResult[] } {
  const results: BlackjackCheckResult[] = [];

  results.push({
    name: 'getBettingPlayerIds excludes bank and sorts RTL',
    passed:
      getBettingPlayerIds({
        ...createEmptySession('blackjack'),
        playerIds: ['a', 'b', 'c'],
        bankPlayerId: 'b',
        boxSlotNumbers: { a: 2, c: 1 },
      }).join(',') === 'c,a',
  });

  results.push({
    name: 'cannot bet after deal starts',
    passed: !canPlaceBlackjackBet({ status: 'player-turns' } as BlackjackRound),
  });

  results.push({
    name: 'primary hand key format',
    passed: blackjackHandKey('p1', 0) === 'p1:0',
  });

  const rulesAudit = runBlackjackRulesAudit(DEFAULT_BLACKJACK_SETTINGS);
  results.push({
    name: 'Las Vegas rules audit',
    passed: rulesAudit.passed,
    detail: rulesAudit.results.filter((r) => !r.passed).map((r) => r.name).join(', ') || undefined,
  });

  results.push({
    name: 'cannot deal before all bets placed',
    passed: !canDealInitialBlackjack(
      { bankPlayerId: 'd', playerIds: ['a', 'd'] } as GameSession,
      {
        ...createEmptyBlackjackRound(),
        playerHands: {
          'a:0': {
            ...createBlackjackPlayerHand('a', 0),
            currentBet: 0,
          },
        },
      },
    ),
  });

  const passed = results.every((r) => r.passed);
  return { passed, results };
}
