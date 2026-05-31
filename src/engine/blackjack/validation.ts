import type { GameSession } from '../../types/session';
import { createEmptySession } from '../../types/session';
import type { GameState } from '../../types';
import type { Ledger } from '../../types/ledger';
import type { Deck } from '../../types/deck';
import type { BlackjackRound } from '../../types/blackjack';
import { createEmptyBlackjackRound, createBlackjackPlayerHand } from '../../types/blackjack';
import { getAvailableChipsForBankrollOwner, resolveBankrollOwnerIdForBox } from '../session/bankroll';
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
  const ownerId = resolveBankrollOwnerIdForBox(state, playerId);
  const ctx = buildActiveRulesHandContext(
    protocol,
    state.ledger,
    round,
    handKey,
    deck,
    ownerId,
    getAvailableChipsForBankrollOwner(state, ownerId),
  );
  return ctx ? { protocol, ctx, deck } : null;
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

export function canDoubleBlackjackForState(state: GameState, handKey: string): boolean {
  const built = rulesContextForHand(state, handKey);
  return built ? canDoubleUnderProtocol(built.protocol, built.ctx.hand, built.ctx) : false;
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
  return built
    ? canSplitUnderProtocol(built.protocol, built.ctx.hand, { ...built.ctx, deck: built.deck })
    : false;
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
