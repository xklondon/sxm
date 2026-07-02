import type { GameState } from '../../types';
import type { Deck } from '../../types/deck';
import type { Ledger } from '../../types/ledger';
import type { GameSession } from '../../types/session';
import type { Player } from '../../types/player';
import type { BlackjackRound } from '../../types/blackjack';
import type { BlackjackProtocol } from './protocols/types';
import { getCallerPersonIdForBox, isSinglePlayerTable } from '../session/playerAssignment';
import {
  getStakeContributorPersonIds,
  isBoxExposureAttributedToPerson,
} from '../session/playerCommittedExposure';
import { getCardById } from '../deck/deck';
import type { BlackjackSettings } from './settings';
import { insuranceBetMax, insuranceWinPayout } from './rules';
import { getBlackjackHandValue, cardsFromIds } from './hand';
import { handKeysWithConfirmedBets, syncPlayerBetsFromRound, syncActivePlayerId } from './helpers';
import { parseBlackjackHandKey } from './handKeys';
import { findNextActingHand } from './virtual';
import type { BankrollContext } from '../session/bankroll';
import { appendBoxLedgerEntryForStaker } from '../session/boxLedger';
import { appendBankLedgerEntry } from './bankLedger';
import {
  getProportionalFundingBlockReason,
  resolveHandFundingParticipants,
  applyProportionalStakerDebits,
} from './handFunding';
import { resolveHandStakerAmounts, splitAmountByStakerShares } from './stakeSettlement';
import {
  getInsuranceEligibleBoxIds,
  getInsuranceEligiblePlayerIds,
  isHandEligibleForInsuranceOffer,
  shouldOfferInsuranceUnderProtocol,
} from './protocols/activeRules';
import { getBlackjackProtocolOrDefault } from './protocols';
import { canOfferInsuranceAfterInitialDeal } from './initialDealGuards';

export function dealerShowsAce(deck: Deck, round: BlackjackRound): boolean {
  const upId = round.dealerCardIds[0];
  if (!upId) {
    return false;
  }
  const card = getCardById(deck, upId);
  return card?.rank === 'A';
}

export function shouldOfferInsurance(
  round: BlackjackRound,
  deck: Deck,
  settings: BlackjackSettings,
  protocol?: BlackjackProtocol,
): boolean {
  if (protocol) {
    return shouldOfferInsuranceUnderProtocol(protocol, dealerShowsAce(deck, round));
  }
  return Boolean(settings.allowInsurance && dealerShowsAce(deck, round));
}

export function activateInsuranceOfferIfNeeded(
  round: BlackjackRound,
  deck: Deck,
  settings: BlackjackSettings,
  session?: GameSession,
  protocol?: BlackjackProtocol,
): BlackjackRound {
  const resolvedProtocol = protocol ?? getBlackjackProtocolOrDefault();
  if (session && !canOfferInsuranceAfterInitialDeal(session, round)) {
    return { ...round, insuranceOfferPending: false };
  }
  if (!shouldOfferInsurance(round, deck, settings, resolvedProtocol)) {
    return { ...round, insuranceOfferPending: false };
  }
  if (session) {
    const eligible = getInsuranceEligibleBoxIds(session, round, resolvedProtocol);
    if (eligible.length === 0) {
      return { ...round, insuranceOfferPending: false };
    }
  }
  return {
    ...round,
    insuranceOfferPending: true,
    insuranceBets: { ...(round.insuranceBets ?? {}) },
    insuranceDeclined: { ...(round.insuranceDeclined ?? {}) },
  };
}

export function getInsuranceHandKeyForBox(
  session: GameSession,
  round: BlackjackRound,
  boxId: string,
): string | null {
  return (
    handKeysWithConfirmedBets(session, round).find(
      (handKey) => parseBlackjackHandKey(handKey).playerId === boxId,
    ) ?? null
  );
}

/**
 * Person who may accept/decline insurance on this box and pays from their bankroll.
 * Sole staker owns the decision; shared boxes fall back to the box caller.
 */
export function getInsuranceDecisionPersonIdForBox(
  state: GameState,
  boxPlayerId: string,
): string | null {
  const contributors = getStakeContributorPersonIds(state, boxPlayerId);
  if (contributors.length === 1) {
    return contributors[0]!;
  }
  if (contributors.length > 1) {
    return getCallerPersonIdForBox(state, boxPlayerId);
  }
  return getCallerPersonIdForBox(state, boxPlayerId);
}

/** True when this seated person must decide insurance for the box. */
export function canPersonDecideInsuranceForBox(
  state: GameState,
  boxPlayerId: string,
  personId: string,
): boolean {
  if (!isBoxExposureAttributedToPerson(state, boxPlayerId, personId)) {
    return false;
  }
  if (isSinglePlayerTable(state)) {
    return true;
  }
  return getInsuranceDecisionPersonIdForBox(state, boxPlayerId) === personId;
}

/** Pending eligible boxes this person must still accept or decline. */
export function getPendingInsuranceBoxIdsForPerson(
  state: GameState,
  round: BlackjackRound,
  personId: string,
  protocol?: BlackjackProtocol,
): string[] {
  const resolvedProtocol = protocol ?? getBlackjackProtocolOrDefault();
  const eligible = getInsuranceEligibleBoxIds(state.session, round, resolvedProtocol);
  return eligible.filter(
    (boxId) =>
      !isInsuranceBoxDecisionResolved(state, round, resolvedProtocol, boxId) &&
      canPersonDecideInsuranceForBox(state, boxId, personId),
  );
}

export function getInsuranceFundingBlockReason(
  state: GameState,
  round: BlackjackRound,
  boxId: string,
): string | null {
  const handKey = getInsuranceHandKeyForBox(state.session, round, boxId);
  const hand = handKey ? round.playerHands[handKey] : undefined;
  if (!hand) {
    return 'No active hand for insurance.';
  }
  const maxBet = insuranceBetMax(hand.currentBet);
  if (maxBet <= 0) {
    return 'Bet too small for insurance.';
  }
  const participants = resolveHandFundingParticipants(state, hand, boxId);
  return getProportionalFundingBlockReason(participants, maxBet);
}

export function canAffordInsuranceForBox(
  state: GameState,
  round: BlackjackRound,
  boxId: string,
): boolean {
  return getInsuranceFundingBlockReason(state, round, boxId) === null;
}

/** Box insurance complete: taken, declined, ineligible, no caller, or unfunded (auto-skip). */
export function isInsuranceBoxDecisionResolved(
  state: GameState,
  round: BlackjackRound,
  protocol: BlackjackProtocol,
  boxId: string,
): boolean {
  if (!round.insuranceOfferPending) {
    return true;
  }
  const handKey = getInsuranceHandKeyForBox(state.session, round, boxId);
  const hand = handKey ? round.playerHands[handKey] : undefined;
  if (!hand || !isHandEligibleForInsuranceOffer(protocol, hand)) {
    return true;
  }
  if (round.insuranceDeclined?.[boxId]) {
    return true;
  }
  if ((round.insuranceBets?.[boxId] ?? 0) > 0) {
    return true;
  }
  if (round.insuranceSkipReasons?.[boxId]) {
    return true;
  }
  const decisionPersonId = getInsuranceDecisionPersonIdForBox(state, boxId);
  if (!decisionPersonId) {
    return true;
  }
  return false;
}

export function allInsuranceDecisionsResolved(
  state: GameState,
  round: BlackjackRound,
  protocol?: BlackjackProtocol,
): boolean {
  const resolvedProtocol = protocol ?? getBlackjackProtocolOrDefault();
  if (!round.insuranceOfferPending) {
    return true;
  }
  const eligible = getInsuranceEligibleBoxIds(state.session, round, resolvedProtocol);
  if (eligible.length === 0) {
    return true;
  }
  return eligible.every((boxId) =>
    isInsuranceBoxDecisionResolved(state, round, resolvedProtocol, boxId),
  );
}

export function allInsuranceResolved(
  state: GameState,
  round: BlackjackRound,
  protocol?: BlackjackProtocol,
): boolean {
  return allInsuranceDecisionsResolved(state, round, protocol);
}

export { getInsuranceEligibleBoxIds, getInsuranceEligiblePlayerIds, isHandEligibleForInsuranceOffer };

/** Insurance offer for one box (boxId = player id on the hand). */
export function getInsuranceOfferForBox(
  state: GameState,
  round: BlackjackRound,
  boxId: string,
  protocol?: BlackjackProtocol,
): {
  handKey: string;
  maxBet: number;
  canAfford: boolean;
  blockReason: string | null;
} | null {
  if (!round.insuranceOfferPending) {
    return null;
  }
  const resolvedProtocol = protocol ?? getBlackjackProtocolOrDefault();
  const handKey = getInsuranceHandKeyForBox(state.session, round, boxId);
  if (!handKey) {
    return null;
  }
  const hand = round.playerHands[handKey];
  if (!hand || !isHandEligibleForInsuranceOffer(resolvedProtocol, hand)) {
    return null;
  }
  const maxBet = insuranceBetMax(hand.currentBet);
  if (maxBet <= 0) {
    return null;
  }
  if (!getInsuranceDecisionPersonIdForBox(state, boxId)) {
    return null;
  }
  return {
    handKey,
    maxBet,
    canAfford: canAffordInsuranceForBox(state, round, boxId),
    blockReason: getInsuranceFundingBlockReason(state, round, boxId),
  };
}

export function takeInsuranceBet(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  round: BlackjackRound,
  playerId: string,
  bankrollCtx: BankrollContext,
  protocol?: BlackjackProtocol,
  _bankrollOwnerIdOverride?: string,
): {
  session: GameSession;
  players: Record<string, Player>;
  ledger: Ledger;
  round: BlackjackRound;
} {
  if (!round.insuranceOfferPending) {
    throw new Error('Insurance is not offered');
  }
  const boxId = playerId;
  const handKey = getInsuranceHandKeyForBox(session, round, boxId);
  const hand = handKey ? round.playerHands[handKey] : undefined;
  if (!hand || !isHandEligibleForInsuranceOffer(protocol ?? getBlackjackProtocolOrDefault(), hand)) {
    throw new Error('No active hand for insurance');
  }

  const maxBet = insuranceBetMax(hand.currentBet);
  if (maxBet <= 0) {
    throw new Error('Bet too small for insurance');
  }
  const stakerAmounts = resolveHandStakerAmounts(hand, bankrollCtx, boxId);
  const fundingState = {
    session,
    players,
    ledger,
    tableMeta: {
      ownerPersonId: bankrollCtx.ownerPersonId ?? null,
      bankerSetup: bankrollCtx.bankerSetup ?? { mode: 'bot', playerId: null, displayName: '' },
      boxStakes: {},
      boxSlots: [],
      bettingLocked: true,
    },
    blackjack: round,
  } as unknown as GameState;
  const fundBlock = getInsuranceFundingBlockReason(fundingState, round, boxId);
  if (fundBlock) {
    throw new Error(fundBlock);
  }

  const betResult = applyProportionalStakerDebits(
    session,
    ledger,
    bankrollCtx,
    boxId,
    stakerAmounts,
    maxBet,
    'bet-placed',
    `Insurance: ${maxBet} chips (2:1 if dealer blackjack)`,
    session.currentRound,
  );

  const nextRound: BlackjackRound = {
    ...round,
    insuranceBets: {
      ...(round.insuranceBets ?? {}),
      [playerId]: maxBet,
    },
    insuranceDeclined: {
      ...(round.insuranceDeclined ?? {}),
      [playerId]: false,
    },
  };

  return {
    session: betResult.session,
    players,
    ledger: betResult.ledger,
    round: nextRound,
  };
}

export function declineInsurance(
  round: BlackjackRound,
  playerId: string,
  skipReason?: string,
): BlackjackRound {
  const next: BlackjackRound = {
    ...round,
    insuranceDeclined: {
      ...(round.insuranceDeclined ?? {}),
      [playerId]: true,
    },
  };
  if (skipReason) {
    next.insuranceSkipReasons = {
      ...(round.insuranceSkipReasons ?? {}),
      [playerId]: skipReason,
    };
  }
  return next;
}

export function closeInsuranceOffer(
  session: GameSession,
  players: Record<string, Player>,
  round: BlackjackRound,
): {
  session: GameSession;
  players: Record<string, Player>;
  round: BlackjackRound;
} {
  const firstActingHand = findNextActingHand(session, round);
  const nextRound = syncActivePlayerId({
    ...round,
    insuranceOfferPending: false,
    activeHandKey: firstActingHand,
    status: firstActingHand ? 'player-turns' : 'bank-turn',
    dealerHoleHidden: firstActingHand !== null,
  });
  return {
    session,
    players: syncPlayerBetsFromRound(players, nextRound),
    round: nextRound,
  };
}

/** Close insurance when all eligible boxes decided (or none eligible). Returns closed=true when advanced. */
export function advanceInsurancePhaseIfComplete(
  state: GameState,
  round: BlackjackRound = state.blackjack!,
  protocol: BlackjackProtocol = getBlackjackProtocolOrDefault(),
): {
  session: GameSession;
  players: Record<string, Player>;
  round: BlackjackRound;
  closed: boolean;
} {
  const { session, players } = state;
  if (!round.insuranceOfferPending) {
    return { session, players, round, closed: false };
  }
  const resolvedProtocol = protocol;
  if (!allInsuranceDecisionsResolved(state, round, resolvedProtocol)) {
    return { session, players, round, closed: false };
  }
  const closed = closeInsuranceOffer(session, players, round);
  return { ...closed, closed: true };
}

export function getInsuranceOfferForPlayer(
  state: GameState,
  round: BlackjackRound,
  boxId: string,
  protocol?: BlackjackProtocol,
): ReturnType<typeof getInsuranceOfferForBox> {
  return getInsuranceOfferForBox(state, round, boxId, protocol);
}

/** Pay or lose insurance bets when dealer blackjack is known. */
export function settleInsuranceBets(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: BlackjackRound,
  bankrollCtx: BankrollContext,
): {
  session: GameSession;
  players: Record<string, Player>;
  ledger: Ledger;
} {
  const dealerCards = cardsFromIds(deck, round.dealerCardIds.filter(Boolean));
  const dealerBj = getBlackjackHandValue(dealerCards).isBlackjack;
  let nextSession = session;
  let nextLedger = ledger;
  const bankId = session.bankPlayerId;

  for (const [playerId, insBet] of Object.entries(round.insuranceBets ?? {})) {
    if (insBet <= 0) {
      continue;
    }
    const handKey = getInsuranceHandKeyForBox(session, round, playerId);
    const hand = handKey ? round.playerHands[handKey] : undefined;
    const stakerAmounts = hand
      ? resolveHandStakerAmounts(hand, bankrollCtx, playerId)
      : { [playerId]: insBet };
    if (dealerBj) {
      const payout = insuranceWinPayout(insBet);
      const shares = splitAmountByStakerShares(payout, stakerAmounts);
      for (const [stakerId, share] of Object.entries(shares)) {
        if (share <= 0) {
          continue;
        }
        const result = appendBoxLedgerEntryForStaker(
          nextSession,
          nextLedger,
          bankrollCtx,
          playerId,
          stakerId,
          'win-paid',
          share,
          `Insurance wins 2:1 (+${share} chips)`,
          session.currentRound,
        );
        nextSession = result.session;
        nextLedger = result.ledger;
      }
      if (bankId) {
        const winnings = payout - insBet;
        const bankResult = appendBankLedgerEntry(
          nextSession,
          nextLedger,
          bankId,
          -winnings,
          `Insurance payout ${winnings} chips`,
          session.currentRound,
        );
        nextSession = bankResult.session;
        nextLedger = bankResult.ledger;
      }
    } else if (bankId) {
      const bankResult = appendBankLedgerEntry(
        nextSession,
        nextLedger,
        bankId,
        insBet,
        `Insurance lost — house collected ${insBet} chips`,
        session.currentRound,
      );
      nextSession = bankResult.session;
      nextLedger = bankResult.ledger;
    }
  }

  return { session: nextSession, players, ledger: nextLedger };
}
