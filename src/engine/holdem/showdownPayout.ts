import type { Deck } from '../../types/deck';
import type { HoldemRound } from '../../types/holdem';
import type { Player } from '../../types/player';
import type { GameSession } from '../../types/session';
import type { Ledger } from '../../types/ledger';
import { getCardById } from '../deck/deck';
import { cardsFromIds } from '../blackjack/hand';
import {
  compareHoldemHands,
  evaluateBestHoldemHand,
  type RankedHoldemHand,
} from './handEvaluator';
import { getActivePlayers, getHoldemPlayerOrder } from './helpers';
import { payPotToWinner } from './ledgerEntries';
import { buildHoldemSidePots } from './sidePots';
import {
  calculateSidePotPayouts,
  chipsForSidePotWinner,
  type HoldemRankedWinner,
  type SidePotPayout,
} from './sidePotPayout';
import { applyUncalledBetReturnsToHand } from './uncalledBetReturn';
import { appendActionLog, syncHoldemPot } from './helpers';

export type HoldemPayoutResult = {
  session: GameSession;
  ledger: Ledger;
  round: HoldemRound;
  payouts: SidePotPayout[];
  rankedWinners: HoldemRankedWinner[];
  bestHand: RankedHoldemHand | null;
  winnerIds: string[];
  resultSummary: string;
  payoutSummary: string[];
};

function rankPlayersFromHands(
  hands: { seatId: string; hand: RankedHoldemHand }[],
): HoldemRankedWinner[] {
  const sorted = [...hands].sort((a, b) => compareHoldemHands(b.hand, a.hand));
  const ranked: HoldemRankedWinner[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && compareHoldemHands(sorted[i].hand, sorted[i - 1].hand) !== 0) {
      currentRank = i + 1;
    }
    ranked.push({ seatId: sorted[i].seatId, rank: currentRank });
  }
  return ranked;
}

export function evaluateShowdownHands(
  round: HoldemRound,
  deck: Deck,
): { seatId: string; hand: RankedHoldemHand }[] {
  const community = round.communityCardIds
    .map((id) => getCardById(deck, id))
    .filter(Boolean) as import('../../types/deck').Card[];

  return getActivePlayers(round).map((seatId) => {
    const hole = cardsFromIds(deck, round.playerStates[seatId].holeCardIds);
    return { seatId, hand: evaluateBestHoldemHand(hole, community) };
  });
}

function payCalculatedPayouts(
  session: GameSession,
  ledger: Ledger,
  payouts: SidePotPayout[],
  players: Record<string, Player>,
  handLabel: string | null,
): {
  session: GameSession;
  ledger: Ledger;
  totalByWinner: Map<string, number>;
  payoutSummary: string[];
} {
  let nextSession = session;
  let nextLedger = ledger;
  const totalByWinner = new Map<string, number>();
  const payoutSummary: string[] = [];

  for (const payout of payouts) {
    for (let i = 0; i < payout.winnerSeatIds.length; i += 1) {
      const seatId = payout.winnerSeatIds[i]!;
      const chips = chipsForSidePotWinner(payout, i);
      if (chips <= 0) {
        continue;
      }
      const name = players[seatId]?.displayName ?? seatId;
      const label = handLabel ? ` (${handLabel})` : '';
      const paid = payPotToWinner(
        nextSession,
        nextLedger,
        seatId,
        chips,
        `${payout.potId}: ${name} wins ${chips}${label}`,
      );
      nextSession = paid.session;
      nextLedger = paid.ledger;
      totalByWinner.set(seatId, (totalByWinner.get(seatId) ?? 0) + chips);
      payoutSummary.push(`${payout.potId}: ${name} +${chips}`);
    }
  }

  return { session: nextSession, ledger: nextLedger, totalByWinner, payoutSummary };
}

function buildResultSummary(
  winnerIds: string[],
  totalByWinner: Map<string, number>,
  players: Record<string, Player>,
  bestHand: RankedHoldemHand | null,
  reason: string,
): string {
  const parts = winnerIds.map((id) => {
    const name = players[id]?.displayName ?? id;
    const amount = totalByWinner.get(id) ?? 0;
    return `${name} +${amount}`;
  });
  const handPart = bestHand ? ` (${bestHand.label})` : '';
  return `${parts.join(', ')}${handPart} — ${reason}`;
}

export function executeHoldemPayout(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  round: HoldemRound,
  contestingSeatIds: string[],
  opts: {
    reason: string;
    rankedHands?: { seatId: string; hand: RankedHoldemHand }[];
  },
): HoldemPayoutResult {
  const prepared = applyUncalledBetReturnsToHand(session, ledger, round, contestingSeatIds);
  let nextRound = prepared.round;
  const seatOrder = getHoldemPlayerOrder(session);

  let rankedWinners: HoldemRankedWinner[];
  let bestHand: RankedHoldemHand | null = null;

  if (opts.rankedHands && opts.rankedHands.length > 0) {
    rankedWinners = rankPlayersFromHands(opts.rankedHands);
    bestHand = opts.rankedHands.sort((a, b) => compareHoldemHands(b.hand, a.hand))[0]?.hand ?? null;
  } else {
    rankedWinners = contestingSeatIds.map((seatId) => ({ seatId, rank: 1 }));
  }

  const sidePots = buildHoldemSidePots(
    Object.entries(nextRound.playerStates).map(([seatId, ps]) => ({
      seatId,
      amount: ps.playerTotalCommitted,
      isFolded: ps.actionStatus === 'folded',
    })),
  );

  const payouts = calculateSidePotPayouts({
    sidePots,
    rankedWinners,
    seatOrder,
  });

  const paid = payCalculatedPayouts(
    prepared.session,
    prepared.ledger,
    payouts,
    players,
    bestHand?.label ?? null,
  );

  const winnerIds = [...new Set(payouts.flatMap((p) => p.winnerSeatIds))];
  const resultSummary = buildResultSummary(
    winnerIds,
    paid.totalByWinner,
    players,
    bestHand,
    opts.reason,
  );

  nextRound = appendActionLog(
    {
      ...nextRound,
      status: 'resolved',
      activePlayerId: null,
      winners: winnerIds,
      resultSummary,
      winningHandLabel: bestHand?.label,
      payoutSummary: paid.payoutSummary,
      sidePotPayouts: payouts.map((p) => ({
        potId: p.potId,
        amount: p.amount,
        winnerSeatIds: p.winnerSeatIds,
      })),
    },
    `Hand settled — ${resultSummary}`,
  );

  return {
    session: { ...paid.session, status: 'round-complete' },
    ledger: paid.ledger,
    round: syncHoldemPot(nextRound),
    payouts,
    rankedWinners,
    bestHand,
    winnerIds,
    resultSummary,
    payoutSummary: paid.payoutSummary,
  };
}
