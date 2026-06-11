import type { GameState } from '../../types';
import type { BankBustSettlementMode } from '../../types/table';
import {
  getLedgerBalanceForBankrollOwner,
  listPersonBankrollOwnerIds,
} from '../session/bankroll';
import {
  bankShortName,
  formatBankHolderLabel,
  isChallengeTable,
  personShortName,
  resolveWinnerDisplayName,
} from './challengeBankDisplay';

export type ChallengeEndRanking = {
  playerId: string;
  name: string;
  endingChips: number;
  isBank: boolean;
  rank: number;
};

export type { BankBustSettlementMode };

/** Pre-game Challenge bank-bust settlement choice (default fractional). */
export function getConfiguredBankBustSettlementMode(state: GameState): BankBustSettlementMode {
  if (!isChallengeTable(state)) {
    return 'fractional';
  }
  return state.tableMeta.bankBustSettlementMode ?? 'fractional';
}

/** Rank all seated participants by ledger balance (highest first). */
export function buildChallengeEndRankings(state: GameState): ChallengeEndRanking[] {
  const bankId = state.session.bankPlayerId;
  const rows: Omit<ChallengeEndRanking, 'rank'>[] = [];

  for (const personId of listPersonBankrollOwnerIds(state)) {
    rows.push({
      playerId: personId,
      name: personShortName(state, personId),
      endingChips: getLedgerBalanceForBankrollOwner(state, personId),
      isBank: false,
    });
  }

  if (bankId && state.players[bankId]) {
    rows.push({
      playerId: bankId,
      name: isChallengeTable(state)
        ? `${formatBankHolderLabel(state, bankId)} (Bank)`
        : bankShortName(state, bankId),
      endingChips: getLedgerBalanceForBankrollOwner(state, bankId),
      isBank: true,
    });
  }

  rows.sort((a, b) => b.endingChips - a.endingChips);
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Non-bank players holding chips, highest balance first. */
export function listNonBankWithChips(state: GameState): ChallengeEndRanking[] {
  return buildChallengeEndRankings(state).filter((r) => !r.isBank && r.endingChips > 0);
}

/** Sole top non-bank chip holder, or null when tied for highest. */
export function resolveClearTopNonBankWinner(state: GameState): string | null {
  const nonBankWithChips = listNonBankWithChips(state);
  if (nonBankWithChips.length === 0) {
    return null;
  }
  const topChips = nonBankWithChips[0]!.endingChips;
  const atTop = nonBankWithChips.filter((r) => r.endingChips === topChips);
  return atTop.length === 1 ? atTop[0]!.playerId : null;
}

/**
 * True when bank bust should use ranked/fractional accounting (not a single winner-takes-all winner).
 */
export function isFractionalChallengeEnd(state: GameState, reason?: string | null): boolean {
  if (!isChallengeTable(state)) {
    return false;
  }
  if (reason !== 'bank-bust' && reason !== 'bank-empty') {
    return false;
  }

  const nonBankWithChips = listNonBankWithChips(state);
  if (nonBankWithChips.length === 0) {
    return false;
  }

  const configured = getConfiguredBankBustSettlementMode(state);
  if (configured === 'fractional') {
    return nonBankWithChips.length > 1;
  }

  return resolveClearTopNonBankWinner(state) === null;
}

/** Effective settlement mode stored on ended table / score ledger. */
export function resolveEffectiveSettlementMode(state: GameState): BankBustSettlementMode | undefined {
  const reason = state.tableMeta.gameEndReason;
  if (!isChallengeTable(state)) {
    return undefined;
  }
  if (reason !== 'bank-bust' && reason !== 'bank-empty') {
    return state.tableMeta.bankBustSettlementMode;
  }
  return isFractionalChallengeEnd(state, reason) ? 'fractional' : 'winner-takes-all';
}

export function buildFractionalEndMessage(state: GameState): string {
  const rankings = buildChallengeEndRankings(state);
  const bankId = state.session.bankPlayerId;
  const bankRow = bankId ? rankings.find((r) => r.playerId === bankId) : null;
  const bankLabel = bankRow?.name ?? 'Bank';

  const lines = [`${bankLabel} is bust.`];
  const withChips = rankings.filter((r) => r.endingChips > 0);
  if (withChips.length === 0) {
    return lines.join('\n');
  }

  lines.push('Final totals:');
  for (const row of withChips) {
    lines.push(`${row.rank}. ${row.name} — ${row.endingChips} chips`);
  }
  return lines.join('\n');
}

/** Challenge bank-bust summary — distinguishes winner-takes-all vs ranked/fractional. */
export function buildChallengeBankBustEndMessage(state: GameState): string {
  const reason = state.tableMeta.gameEndReason;
  const fractional = isFractionalChallengeEnd(state, reason);
  const configured = getConfiguredBankBustSettlementMode(state);
  const winnerId = state.tableMeta.winnerId;

  if (!fractional && configured === 'winner-takes-all' && winnerId) {
    return `Bank is bust.\n${resolveWinnerDisplayName(state, winnerId)} wins (winner takes all).`;
  }

  const ranked = buildFractionalEndMessage(state);
  if (fractional && configured === 'winner-takes-all') {
    return `${ranked}\n(Tie for top total — ranked settlement.)`;
  }
  return ranked;
}

/** Single clear winner when one holder owns all table chips. */
export function hasSingleClearWinner(state: GameState): boolean {
  const rankings = buildChallengeEndRankings(state);
  const withChips = rankings.filter((r) => r.endingChips > 0);
  if (withChips.length !== 1) {
    return false;
  }
  const total = rankings.reduce((sum, r) => sum + r.endingChips, 0);
  return withChips[0]!.endingChips >= total && total > 0;
}

/** Resolve bank-bust winner id for challenge tables from configured settlement mode. */
export function resolveBankBustWinnerId(state: GameState): string | null {
  const nonBankWithChips = listNonBankWithChips(state);
  if (nonBankWithChips.length === 0) {
    return null;
  }

  if (isChallengeTable(state) && getConfiguredBankBustSettlementMode(state) === 'winner-takes-all') {
    return resolveClearTopNonBankWinner(state);
  }

  const top = nonBankWithChips[0];
  return top && top.endingChips > 0 ? top.playerId : null;
}
