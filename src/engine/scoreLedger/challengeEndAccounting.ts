import type { GameState } from '../../types';
import {
  getLedgerBalanceForBankrollOwner,
  listPersonBankrollOwnerIds,
} from '../session/bankroll';
import {
  bankShortName,
  formatBankHolderLabel,
  isChallengeTable,
  personShortName,
} from './challengeBankDisplay';

export type ChallengeEndRanking = {
  playerId: string;
  name: string;
  endingChips: number;
  isBank: boolean;
  rank: number;
};

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

/** True when bank bust left chips with more than one non-bank player. */
export function isFractionalChallengeEnd(state: GameState, reason?: string | null): boolean {
  if (!isChallengeTable(state)) {
    return false;
  }
  if (reason !== 'bank-bust' && reason !== 'bank-empty') {
    return false;
  }
  const nonBankWithChips = buildChallengeEndRankings(state).filter(
    (r) => !r.isBank && r.endingChips > 0,
  );
  return nonBankWithChips.length > 1;
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
