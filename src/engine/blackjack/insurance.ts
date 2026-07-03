import type { GameState } from '../../types';
import type { Deck } from '../../types/deck';
import type { Ledger } from '../../types/ledger';
import type { GameSession } from '../../types/session';
import type { Player } from '../../types/player';
import type { BlackjackRound, BlackjackPlayerHand } from '../../types/blackjack';
import type { BlackjackProtocol } from './protocols/types';
import { getCallerPersonIdForBox } from '../session/playerAssignment';
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
  resolveFundableActionParticipants,
  INSUFFICIENT_INSURANCE_REASON,
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
    insuranceStakerDecisions: { ...(round.insuranceStakerDecisions ?? {}) },
    insuranceStakerSkipReasons: { ...(round.insuranceStakerSkipReasons ?? {}) },
    insuranceStakerBets: { ...(round.insuranceStakerBets ?? {}) },
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

function getHandForInsuranceBox(
  session: GameSession,
  round: BlackjackRound,
  boxId: string,
): BlackjackPlayerHand | undefined {
  const handKey = getInsuranceHandKeyForBox(session, round, boxId);
  return handKey ? round.playerHands[handKey] : undefined;
}

export function getStakerInsuranceDecision(
  round: BlackjackRound,
  boxId: string,
  stakerPersonId: string,
): 'accepted' | 'declined' | 'skipped' | undefined {
  return round.insuranceStakerDecisions?.[boxId]?.[stakerPersonId];
}

function setStakerInsuranceDecision(
  round: BlackjackRound,
  boxId: string,
  stakerPersonId: string,
  status: 'accepted' | 'declined' | 'skipped',
  options?: { reason?: string; amount?: number },
): BlackjackRound {
  let next: BlackjackRound = {
    ...round,
    insuranceStakerDecisions: {
      ...(round.insuranceStakerDecisions ?? {}),
      [boxId]: {
        ...(round.insuranceStakerDecisions?.[boxId] ?? {}),
        [stakerPersonId]: status,
      },
    },
  };
  if (options?.reason) {
    next = {
      ...next,
      insuranceStakerSkipReasons: {
        ...(next.insuranceStakerSkipReasons ?? {}),
        [boxId]: {
          ...(next.insuranceStakerSkipReasons?.[boxId] ?? {}),
          [stakerPersonId]: options.reason,
        },
      },
    };
  }
  if (options?.amount && options.amount > 0) {
    next = {
      ...next,
      insuranceStakerBets: {
        ...(next.insuranceStakerBets ?? {}),
        [boxId]: {
          ...(next.insuranceStakerBets?.[boxId] ?? {}),
          [stakerPersonId]: options.amount,
        },
      },
    };
  }
  return syncInsuranceBoxLegacyFields(next, boxId);
}

function syncInsuranceBoxLegacyFields(round: BlackjackRound, boxId: string): BlackjackRound {
  const stakerBets = round.insuranceStakerBets?.[boxId] ?? {};
  const totalBet = Object.values(stakerBets).reduce((sum, n) => sum + n, 0);
  const decisions = round.insuranceStakerDecisions?.[boxId] ?? {};
  const stakerIds = Object.keys(decisions);
  const allResolved =
    stakerIds.length > 0 &&
    stakerIds.every((personId) => decisions[personId] !== undefined);
  const anyAccepted = Object.values(decisions).some((d) => d === 'accepted');

  let next: BlackjackRound = {
    ...round,
    insuranceBets: {
      ...(round.insuranceBets ?? {}),
      [boxId]: totalBet,
    },
  };

  if (allResolved && !anyAccepted && totalBet <= 0) {
    next = {
      ...next,
      insuranceDeclined: {
        ...(next.insuranceDeclined ?? {}),
        [boxId]: true,
      },
    };
    const skipReasons = next.insuranceStakerSkipReasons?.[boxId];
    if (skipReasons && Object.keys(skipReasons).length > 0) {
      next = {
        ...next,
        insuranceSkipReasons: {
          ...(next.insuranceSkipReasons ?? {}),
          [boxId]: Object.values(skipReasons)[0]!,
        },
      };
    }
  } else if (anyAccepted || totalBet > 0) {
    next = {
      ...next,
      insuranceDeclined: {
        ...(next.insuranceDeclined ?? {}),
        [boxId]: false,
      },
    };
  }

  return next;
}

/** Mark unfunded stakers skipped; auto-complete boxes with zero fundable stakers. */
export function applyAutoSkippedInsuranceStakers(
  state: GameState,
  round: BlackjackRound,
  protocol?: BlackjackProtocol,
): BlackjackRound {
  const resolvedProtocol = protocol ?? getBlackjackProtocolOrDefault();
  if (!round.insuranceOfferPending) {
    return round;
  }
  let next = round;
  const eligible = getInsuranceEligibleBoxIds(state.session, round, resolvedProtocol);
  for (const boxId of eligible) {
    const hand = getHandForInsuranceBox(state.session, round, boxId);
    if (!hand || !isHandEligibleForInsuranceOffer(resolvedProtocol, hand)) {
      continue;
    }
    const resolution = resolveFundableActionParticipants(state, hand, boxId, 'insurance');
    for (const skipped of resolution.skipped) {
      if (getStakerInsuranceDecision(next, boxId, skipped.personId)) {
        continue;
      }
      next = setStakerInsuranceDecision(next, boxId, skipped.personId, 'skipped', {
        reason: skipped.reason,
      });
    }
    if (!resolution.hasAnyFundable) {
      for (const participant of resolution.skipped) {
        if (!getStakerInsuranceDecision(next, boxId, participant.personId)) {
          next = setStakerInsuranceDecision(next, boxId, participant.personId, 'skipped', {
            reason: participant.reason,
          });
        }
      }
    }
  }
  return next;
}

export function isInsuranceStakerDecisionPending(
  state: GameState,
  round: BlackjackRound,
  boxId: string,
  stakerPersonId: string,
  protocol?: BlackjackProtocol,
): boolean {
  if (!round.insuranceOfferPending) {
    return false;
  }
  if (getStakerInsuranceDecision(round, boxId, stakerPersonId)) {
    return false;
  }
  const hand = getHandForInsuranceBox(state.session, round, boxId);
  if (!hand) {
    return false;
  }
  const resolvedProtocol = protocol ?? getBlackjackProtocolOrDefault();
  if (!isHandEligibleForInsuranceOffer(resolvedProtocol, hand)) {
    return false;
  }
  const resolution = resolveFundableActionParticipants(state, hand, boxId, 'insurance');
  return resolution.fundable.some((p) => p.personId === stakerPersonId);
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

/** True when this staker must still accept or decline their fundable insurance share. */
export function canPersonDecideInsuranceForBox(
  state: GameState,
  boxPlayerId: string,
  personId: string,
): boolean {
  const round = state.blackjack;
  if (!round?.insuranceOfferPending) {
    return false;
  }
  if (!isBoxExposureAttributedToPerson(state, boxPlayerId, personId)) {
    return false;
  }
  const protocol = getBlackjackProtocolOrDefault();
  return isInsuranceStakerDecisionPending(state, round, boxPlayerId, personId, protocol);
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
  stakerPersonId?: string,
): string | null {
  const hand = getHandForInsuranceBox(state.session, round, boxId);
  if (!hand) {
    return 'No active hand for insurance.';
  }
  const maxBet = insuranceBetMax(hand.currentBet);
  if (maxBet <= 0) {
    return 'Bet too small for insurance.';
  }
  const resolution = resolveFundableActionParticipants(state, hand, boxId, 'insurance');
  if (stakerPersonId) {
    const fundable = resolution.fundable.find((p) => p.personId === stakerPersonId);
    if (fundable) {
      return null;
    }
    const skipped = resolution.skipped.find((p) => p.personId === stakerPersonId);
    return skipped?.reason ?? INSUFFICIENT_INSURANCE_REASON;
  }
  return resolution.hasAnyFundable ? null : INSUFFICIENT_INSURANCE_REASON;
}

export function canAffordInsuranceForBox(
  state: GameState,
  round: BlackjackRound,
  boxId: string,
  stakerPersonId?: string,
): boolean {
  return getInsuranceFundingBlockReason(state, round, boxId, stakerPersonId) === null;
}

/** Box insurance complete when every staker is accepted, declined, or skipped. */
export function isInsuranceBoxDecisionResolved(
  state: GameState,
  round: BlackjackRound,
  protocol: BlackjackProtocol,
  boxId: string,
): boolean {
  if (!round.insuranceOfferPending) {
    return true;
  }
  const hand = getHandForInsuranceBox(state.session, round, boxId);
  if (!hand || !isHandEligibleForInsuranceOffer(protocol, hand)) {
    return true;
  }
  return allStakersInsuranceResolved(state, round, boxId, protocol);
}

function allStakersInsuranceResolved(
  state: GameState,
  round: BlackjackRound,
  boxId: string,
  _protocol: BlackjackProtocol,
): boolean {
  const hand = getHandForInsuranceBox(state.session, round, boxId);
  if (!hand) {
    return true;
  }
  if (round.insuranceDeclined?.[boxId] && !round.insuranceStakerDecisions?.[boxId]) {
    return true;
  }
  const resolution = resolveFundableActionParticipants(state, hand, boxId, 'insurance');
  const stakerIds = [
    ...resolution.fundable.map((p) => p.personId),
    ...resolution.skipped.map((p) => p.personId),
  ];
  if (stakerIds.length === 0) {
    return true;
  }
  return stakerIds.every((personId) => Boolean(getStakerInsuranceDecision(round, boxId, personId)));
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

/** Insurance offer for one staker on one box. */
export function getInsuranceOfferForBox(
  state: GameState,
  round: BlackjackRound,
  boxId: string,
  protocol?: BlackjackProtocol,
  stakerPersonId?: string,
): {
  handKey: string;
  maxBet: number;
  canAfford: boolean;
  blockReason: string | null;
  stakerPersonId: string | null;
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
  const resolution = resolveFundableActionParticipants(state, hand, boxId, 'insurance');
  const targetPersonId =
    stakerPersonId ??
    resolution.fundable.find(
      (p) => isInsuranceStakerDecisionPending(state, round, boxId, p.personId, resolvedProtocol),
    )?.personId ??
    null;
  if (!targetPersonId) {
    return null;
  }
  const fundable = resolution.fundable.find((p) => p.personId === targetPersonId);
  if (!fundable) {
    return {
      handKey,
      maxBet: 0,
      canAfford: false,
      blockReason: getInsuranceFundingBlockReason(state, round, boxId, targetPersonId),
      stakerPersonId: targetPersonId,
    };
  }
  if (getStakerInsuranceDecision(round, boxId, targetPersonId)) {
    return null;
  }
  return {
    handKey,
    maxBet: fundable.requiredAmount,
    canAfford: true,
    blockReason: null,
    stakerPersonId: targetPersonId,
  };
}

export function takeInsuranceBet(
  state: GameState,
  boxId: string,
  bankrollCtx: BankrollContext,
  protocol?: BlackjackProtocol,
  stakerPersonId?: string,
): {
  session: GameSession;
  players: Record<string, Player>;
  ledger: Ledger;
  round: BlackjackRound;
} {
  const round = state.blackjack;
  if (!round?.insuranceOfferPending) {
    throw new Error('Insurance is not offered');
  }
  const handKey = getInsuranceHandKeyForBox(state.session, round, boxId);
  const hand = handKey ? round.playerHands[handKey] : undefined;
  if (!hand || !isHandEligibleForInsuranceOffer(protocol ?? getBlackjackProtocolOrDefault(), hand)) {
    throw new Error('No active hand for insurance');
  }

  const resolution = resolveFundableActionParticipants(state, hand, boxId, 'insurance');
  const payerId =
    stakerPersonId ??
    (resolution.fundable.length === 1 ? resolution.fundable[0]!.personId : null);
  if (!payerId) {
    throw new Error('Insurance staker required');
  }
  const fundable = resolution.fundable.find((p) => p.personId === payerId);
  if (!fundable) {
    throw new Error(getInsuranceFundingBlockReason(state, round, boxId, payerId) ?? 'Not enough chips for insurance');
  }

  const betResult = appendBoxLedgerEntryForStaker(
    state.session,
    state.ledger,
    bankrollCtx,
    boxId,
    payerId,
    'bet-placed',
    -fundable.requiredAmount,
    `Insurance: ${fundable.requiredAmount} chips (2:1 if dealer blackjack)`,
    state.session.currentRound,
  );

  let nextRound = setStakerInsuranceDecision(round, boxId, payerId, 'accepted', {
    amount: fundable.requiredAmount,
  });

  return {
    session: betResult.session,
    players: state.players,
    ledger: betResult.ledger,
    round: nextRound,
  };
}

export function declineInsurance(
  round: BlackjackRound,
  playerId: string,
  skipReason?: string,
  stakerPersonId?: string,
): BlackjackRound {
  const boxId = playerId;
  const payerId = stakerPersonId ?? playerId;
  let next = setStakerInsuranceDecision(round, boxId, payerId, skipReason ? 'skipped' : 'declined', {
    reason: skipReason,
  });
  if (skipReason) {
    next = {
      ...next,
      insuranceSkipReasons: {
        ...(next.insuranceSkipReasons ?? {}),
        [boxId]: skipReason,
      },
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
  let workingRound = applyAutoSkippedInsuranceStakers(state, round, protocol);
  if (!allInsuranceDecisionsResolved({ ...state, blackjack: workingRound }, workingRound, protocol)) {
    return { session, players, round: workingRound, closed: false };
  }
  const closed = closeInsuranceOffer(session, players, workingRound);
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
