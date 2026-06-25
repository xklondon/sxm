import type { GameState } from '../../../types';
import type { IouHandoffCreateRequestBody } from '../../../lib/iouHandoffPayload';
import { resolveEmailForPlayerId } from '../../../engine/scoreLedger/gameEndIou';
import { buildPokerChallengeIouGameId, iouHandoffStorageKey } from '../../../lib/iouHandoffPayload';
import {
  getHoldemChallengeParticipants,
  type HoldemChallengeParticipant,
} from '../../../engine/holdem/challengeParticipants';

export interface PokerWinnerTakesAllSettlement {
  winnerId: string;
  winnerSeatId: string;
  winnerName: string;
  totalChallengeValue: number;
  currency: string;
  /** @deprecated use participantCount */
  playerCount: number;
  participantCount: number;
  /** Stake per participant = totalChallengeValue / participantCount */
  perLoserAmount: number;
  stakePerParticipant: number;
  participants: HoldemChallengeParticipant[];
  losers: Array<{ playerId: string; displayName: string; email: string | null }>;
  canSendIous: boolean;
  blockingReason?: string;
}

export type PokerChallengeSettlementResult =
  | { ok: true; settlement: PokerWinnerTakesAllSettlement }
  | { ok: false; error: string; settlement?: PokerWinnerTakesAllSettlement | null };

function findWinnerParticipant(
  participants: HoldemChallengeParticipant[],
  winnerSeatOrPlayerId: string,
): HoldemChallengeParticipant | undefined {
  return participants.find(
    (participant) =>
      participant.seatId === winnerSeatOrPlayerId ||
      participant.playerId === winnerSeatOrPlayerId,
  );
}

export function validatePokerChallengeSettlement(
  state: GameState,
  winnerSeatOrPlayerId: string | null,
): PokerChallengeSettlementResult {
  const config = state.tableMeta.pokerConfig;
  if (!config || config.mode !== 'challenge') {
    return { ok: false, error: 'Not a Poker challenge table.' };
  }

  if (!winnerSeatOrPlayerId) {
    return { ok: false, error: 'No authoritative challenge winner — cannot settle IOUs.' };
  }

  const totalChallengeValue = config.totalChallengeValue ?? 0;
  if (totalChallengeValue <= 0) {
    return { ok: false, error: 'Challenge value must be greater than zero.' };
  }

  const participants = getHoldemChallengeParticipants(state);
  const participantCount = participants.length;
  if (participantCount < 2) {
    return {
      ok: false,
      error: 'Challenge needs at least two participants for IOU settlement.',
    };
  }

  const winnerParticipant = findWinnerParticipant(participants, winnerSeatOrPlayerId);
  if (!winnerParticipant) {
    return {
      ok: false,
      error: 'Challenge winner is not a seated challenge participant.',
    };
  }

  const winnerEmail =
    winnerParticipant.email ?? resolveEmailForPlayerId(state, winnerParticipant.playerId);
  if (!winnerEmail) {
    return {
      ok: false,
      error: `Missing email for winner (${winnerParticipant.displayName}).`,
    };
  }

  const stakePerParticipant = totalChallengeValue / participantCount;
  const losers = participants
    .filter((participant) => participant.playerId !== winnerParticipant.playerId)
    .map((participant) => ({
      playerId: participant.playerId,
      displayName: participant.displayName,
      email: participant.email ?? resolveEmailForPlayerId(state, participant.playerId),
    }));

  const missingEmailLosers = losers.filter((loser) => !loser.email);
  if (missingEmailLosers.length > 0) {
    const names = missingEmailLosers.map((loser) => loser.displayName).join(', ');
    const partial: PokerWinnerTakesAllSettlement = {
      winnerId: winnerParticipant.playerId,
      winnerSeatId: winnerParticipant.seatId,
      winnerName: winnerParticipant.displayName,
      totalChallengeValue,
      currency: config.currency ?? '$',
      playerCount: participantCount,
      participantCount,
      perLoserAmount: stakePerParticipant,
      stakePerParticipant,
      participants,
      losers,
      canSendIous: false,
      blockingReason: `Missing email for: ${names}`,
    };
    return {
      ok: false,
      error: `Missing email for: ${names}`,
      settlement: partial,
    };
  }

  const settlement: PokerWinnerTakesAllSettlement = {
    winnerId: winnerParticipant.playerId,
    winnerSeatId: winnerParticipant.seatId,
    winnerName: winnerParticipant.displayName,
    totalChallengeValue,
    currency: config.currency ?? '$',
    playerCount: participantCount,
    participantCount,
    perLoserAmount: stakePerParticipant,
    stakePerParticipant,
    participants,
    losers,
    canSendIous: true,
  };

  return { ok: true, settlement };
}

export function computePokerWinnerTakesAllSettlement(
  state: GameState,
  winnerSeatOrPlayerId: string,
): PokerWinnerTakesAllSettlement | null {
  const result = validatePokerChallengeSettlement(state, winnerSeatOrPlayerId);
  if (!result.ok) {
    return result.settlement ?? null;
  }
  return result.settlement;
}

export function buildPokerIouHandoffRequests(
  state: GameState,
  winnerSeatOrPlayerId: string,
  customMessage?: string,
): IouHandoffCreateRequestBody[] {
  const validation = validatePokerChallengeSettlement(state, winnerSeatOrPlayerId);
  if (!validation.ok || !validation.settlement?.canSendIous) {
    return [];
  }

  const settlement = validation.settlement;
  const winnerEmail =
    settlement.participants.find((p) => p.playerId === settlement.winnerId)?.email ??
    resolveEmailForPlayerId(state, settlement.winnerId);
  if (!winnerEmail) {
    return [];
  }

  const wagerDescription =
    state.tableMeta.pokerConfig?.wagerLabel ??
    state.tableMeta.agreement?.stakeDescription ??
    'Poker challenge';

  const handNumber = state.tableMeta.pokerConfig?.handNumber ?? 0;
  const message =
    customMessage?.trim() ||
    `Poker challenge result — ${settlement.currency}${settlement.stakePerParticipant.toFixed(2)} per participant (hand ${handNumber}).`;

  return settlement.losers
    .filter((loser) => loser.email)
    .map((loser) => ({
      tableId: state.session.id,
      sessionId: buildPokerChallengeIouGameId(state.session.id, handNumber),
      wagerDescription,
      debtorEmail: loser.email!,
      creditorEmail: winnerEmail,
      debtorName: loser.displayName,
      creditorName: settlement.winnerName,
      gameType: 'texas-holdem',
      title: `Poker challenge — ${wagerDescription}`,
      message,
      challengeHandNumber: handNumber,
      settlementAmount: settlement.stakePerParticipant,
    }));
}

export function pokerIouStorageKey(tableId: string, handNumber: number, loserEmail: string): string {
  return `${iouHandoffStorageKey(tableId, `${tableId}-hand-${handNumber}`)}-${loserEmail}`;
}

export function hasPokerIouBeenSubmitted(
  tableId: string,
  handNumber: number,
  loserEmail: string,
): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return Boolean(localStorage.getItem(pokerIouStorageKey(tableId, handNumber, loserEmail)));
}

export function markPokerIouSubmitted(
  tableId: string,
  handNumber: number,
  loserEmail: string,
  iouId: string,
): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(pokerIouStorageKey(tableId, handNumber, loserEmail), iouId);
}
