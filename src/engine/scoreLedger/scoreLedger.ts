import type { GameState } from '../../types';
import type { ScoreLedgerEntry, ScoreLedgerParticipantResult } from '../../types/scoreLedger';
import { resolveTableClothName } from '../../types/tableFeltSkin';
import { generateId } from '../utils/id';
import { isZilchTable } from '../session/zilchTableKind';
import { getZilchWinnerId } from '../dice/zilch/zilchSelectors';
import {
  appendScoreLedgerEntry,
  loadScoreLedgerEntries,
  saveScoreLedgerEntries,
} from '../../storage/scoreLedgerStorage';
import {
  getLedgerBalanceForBankrollOwner,
  listPersonBankrollOwnerIds,
} from '../session/bankroll';
import { log } from '../../utils/logger';
import { resolveEmailForPlayerId } from './gameEndIou';
import {
  bankShortName,
  formatBankHolderLabel,
  isChallengeTable,
  personShortName,
  resolveLedgerWinnerPersonId,
  resolveWinnerDisplayName,
} from './challengeBankDisplay';
import {
  buildChallengeBankBustEndMessage,
  buildChallengeEndRankings,
  buildGameEndChipTotalsMessage,
  hasSingleClearWinner,
  isFractionalChallengeEnd,
  resolveEffectiveSettlementMode,
} from './challengeEndAccounting';

/** True when the bank seat is a bot (virtual) — i.e. not a human-vs-human game. */
export function isBotBankGame(state: GameState): boolean {
  const bankId = state.session.bankPlayerId;
  const bank = bankId ? state.players[bankId] : null;
  return bank?.playerType === 'virtual';
}

export function resolveTableModeFromState(state: GameState): 'practice' | 'challenge' {
  if (state.tableMeta.tableMode) {
    return state.tableMeta.tableMode;
  }
  return isBotBankGame(state) ? 'practice' : 'challenge';
}

/** Personal ledger offer when the table game has fully ended (practice or challenge). */
export function canAddGameToPersonalLedger(state: GameState): boolean {
  return state.tableMeta.gameStatus === 'ended';
}

function buildParticipantResults(state: GameState, winnerId: string | null): ScoreLedgerParticipantResult[] {
  const seatStart = state.tableMeta.startingChipsEachSeat;
  const bankStart = state.tableMeta.startingChipsBank;
  const fractional = isFractionalChallengeEnd(state, state.tableMeta.gameEndReason);
  const rankings = buildChallengeEndRankings(state);
  const topNonBank = rankings.find((r) => !r.isBank && r.endingChips > 0);
  const results: ScoreLedgerParticipantResult[] = [];

  for (const personId of listPersonBankrollOwnerIds(state)) {
    const ending = getLedgerBalanceForBankrollOwner(state, personId);
    const rankRow = rankings.find((r) => r.playerId === personId);
    let outcome: ScoreLedgerParticipantResult['outcome'] = 'participant';
    if (winnerId === personId && !fractional) {
      outcome = 'winner';
    } else if (ending <= 0) {
      outcome = 'loser';
    } else if (fractional && topNonBank?.playerId === personId) {
      outcome = 'winner';
    }
    results.push({
      email: resolveEmailForPlayerId(state, personId) ?? '',
      name: personShortName(state, personId),
      personId,
      startingChips: seatStart,
      endingChips: ending,
      outcome,
      rank: rankRow?.rank,
    });
  }

  const bankId = state.session.bankPlayerId;
  if (bankId) {
    const ending = getLedgerBalanceForBankrollOwner(state, bankId);
    const rankRow = rankings.find((r) => r.playerId === bankId);
    let outcome: ScoreLedgerParticipantResult['outcome'] = 'participant';
    if (winnerId === bankId && !fractional) {
      outcome = 'winner';
    } else if (ending <= 0) {
      outcome = 'loser';
    }
    results.push({
      email:
        state.players[bankId]?.playerType === 'real'
          ? resolveEmailForPlayerId(state, bankId) ?? ''
          : '',
      name: isChallengeTable(state)
        ? `${formatBankHolderLabel(state, bankId)} (Bank)`
        : bankShortName(state, bankId),
      personId: state.players[bankId]?.playerType === 'real' ? bankId : null,
      startingChips: bankStart,
      endingChips: ending,
      outcome,
      rank: rankRow?.rank,
    });
  }

  return results.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
}

/** Build wager-level game-over message and optional score ledger entry. */
export function buildGameOverSummary(state: GameState): {
  message: string;
  entry: ScoreLedgerEntry | null;
} {
  if (state.tableMeta.gameStatus !== 'ended') {
    return { message: '', entry: null };
  }

  if (isZilchTable(state) && state.zilch) {
    return buildZilchGameOverSummary(state);
  }

  const winnerId = state.tableMeta.winnerId;
  const bankId = state.session.bankPlayerId;
  const wager = state.tableMeta.agreement?.stakeDescription?.trim() || 'the agreed wager';
  const bankIsBust = Boolean(bankId && getLedgerBalanceForBankrollOwner(state, bankId) <= 0);
  const fractional = isFractionalChallengeEnd(state, state.tableMeta.gameEndReason);
  const roundCount = Math.max(1, state.session.currentRound || 1);

  if (!winnerId && bankIsBust) {
    const message = isChallengeTable(state)
      ? buildChallengeBankBustEndMessage(state)
      : 'GAME OVER\nBank is bust.';
    const participants = buildParticipantResults(state, null);
    return {
      message,
      entry: participants.length
        ? buildLedgerEntryFromParts(state, {
            winnerId: null,
            winnerName: 'Bank is bust',
            loserId: bankId,
            loserName: bankId && isChallengeTable(state)
              ? `${formatBankHolderLabel(state, bankId)} (Bank)`
              : 'Bank',
            owedDescription: `Fractional settlement — ${wager}`,
            participants,
            roundCount,
            wager,
          })
        : null,
    };
  }

  if (!winnerId) {
    if (
      isChallengeTable(state) &&
      isFractionalChallengeEnd(state, state.tableMeta.gameEndReason)
    ) {
      const message = buildChallengeBankBustEndMessage(state);
      const participants = buildParticipantResults(state, null);
      return {
        message,
        entry: participants.length
          ? buildLedgerEntryFromParts(state, {
              winnerId: null,
              winnerName: 'Fractional result',
              loserId: bankId,
              loserName:
                bankId && isChallengeTable(state)
                  ? `${formatBankHolderLabel(state, bankId)} (Bank)`
                  : 'Bank',
              owedDescription: `Fractional settlement — ${wager}`,
              participants,
              roundCount,
              wager,
            })
          : null,
      };
    }
    return { message: 'Game over.', entry: null };
  }

  const winnerIsBank = Boolean(bankId && winnerId === bankId);
  const winnerName = fractional
    ? hasSingleClearWinner(state)
      ? resolveWinnerDisplayName(state, winnerId)
      : 'Fractional result'
    : resolveWinnerDisplayName(state, winnerId);
  const gameOverCommandMessage = `Game Over, congrats ${resolveWinnerDisplayName(state, winnerId)}, you won in ${roundCount} rounds.`;

  let loserId: string | null = null;
  let loserName = '—';

  if (winnerIsBank) {
    const persons = listPersonBankrollOwnerIds(state);
    const topPerson = persons[0];
    if (topPerson) {
      loserId = topPerson;
      loserName = personShortName(state, topPerson);
    } else if (state.tableMeta.ownerPersonId) {
      loserId = state.tableMeta.ownerPersonId;
      loserName = personShortName(state, loserId);
    }
  } else if (bankId) {
    loserId = bankId;
    loserName = isChallengeTable(state)
      ? `${formatBankHolderLabel(state, bankId)} (Bank)`
      : bankShortName(state, bankId);
  }

  const owedDescription = fractional
    ? `Fractional settlement — ${wager}`
    : `${loserName} owes ${winnerName}: ${wager}`;
  let message = gameOverCommandMessage;
  if (bankIsBust) {
    message = isChallengeTable(state)
      ? buildChallengeBankBustEndMessage(state)
      : 'GAME OVER\nBank is bust.';
  } else {
    const chipTotals = buildGameEndChipTotalsMessage(state);
    if (chipTotals) {
      message = `${message}\n\n${chipTotals}`;
    }
  }

  const participants = buildParticipantResults(state, winnerId).map((p) => ({
    ...p,
    email: p.personId ? resolveEmailForPlayerId(state, p.personId) ?? p.email : p.email,
  }));

  const entry = buildLedgerEntryFromParts(state, {
    winnerId: fractional && !hasSingleClearWinner(state) ? null : winnerId,
    winnerName,
    loserId,
    loserName,
    owedDescription,
    participants,
    roundCount,
    wager,
  });

  return { message, entry };
}

function buildZilchGameOverSummary(state: GameState): {
  message: string;
  entry: ScoreLedgerEntry | null;
} {
  const zilch = state.zilch!;
  const winnerId = state.tableMeta.winnerId ?? zilch.winnerPlayerId ?? getZilchWinnerId(zilch);
  const wager = state.tableMeta.agreement?.stakeDescription?.trim() || 'the agreed wager';
  const winnerName = winnerId ? resolveWinnerDisplayName(state, winnerId) : '—';
  const loserId =
    zilch.players.map((p) => p.playerId).find((id) => id !== winnerId) ??
    state.session.bankPlayerId ??
    null;
  const loserName = loserId ? personShortName(state, loserId) : '—';
  const modeLabel =
    zilch.mode === 'fixed_rounds'
      ? `${zilch.roundLimit ?? '?'} rounds`
      : `target ${zilch.targetPoints ?? '?'} points`;
  const scoreLine = Object.entries(zilch.totalScoresByPlayerId)
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => `${state.players[id]?.displayName ?? id}: ${score}`)
    .join(' · ');
  const participants: ScoreLedgerParticipantResult[] = zilch.players
    .map((p) => ({
      email: resolveEmailForPlayerId(state, p.playerId) ?? '',
      name: personShortName(state, p.playerId),
      personId: p.playerId,
      startingChips: 0,
      endingChips: zilch.totalScoresByPlayerId[p.playerId] ?? 0,
      outcome: (p.playerId === winnerId ? 'winner' : 'loser') as ScoreLedgerParticipantResult['outcome'],
      rank:
        Object.entries(zilch.totalScoresByPlayerId)
          .sort((a, b) => b[1] - a[1])
          .findIndex(([id]) => id === p.playerId) + 1,
    }))
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  const message = `Zilch — ${winnerName} wins (${modeLabel}). ${scoreLine}`;
  const entry = buildLedgerEntryFromParts(state, {
    winnerId,
    winnerName,
    loserId,
    loserName,
    owedDescription: `${loserName} owes ${winnerName}: ${wager}`,
    participants,
    roundCount: zilch.currentRound,
    wager,
    gameType: 'zilch',
    gameLabel: 'Zilch',
    protocolId: 'zilch',
    zilchMode: zilch.mode,
    finalScores: { ...zilch.totalScoresByPlayerId },
  });
  return { message, entry };
}

function buildLedgerEntryFromParts(
  state: GameState,
  parts: {
    winnerId: string | null;
    winnerName: string;
    loserId: string | null;
    loserName: string;
    owedDescription: string;
    participants: ScoreLedgerParticipantResult[];
    roundCount: number;
    wager: string;
    gameType?: string;
    gameLabel?: string;
    protocolId?: string;
    zilchMode?: string;
    finalScores?: Record<string, number>;
  },
): ScoreLedgerEntry {
  const bankId = state.session.bankPlayerId;
  const winnerIsBank = Boolean(bankId && parts.winnerId === bankId);
  const playersInvolved = [
    ...new Set([
      parts.winnerName,
      parts.loserName,
      ...listPersonBankrollOwnerIds(state).map((id) => personShortName(state, id)),
      bankId ? bankShortName(state, bankId) : null,
    ].filter(Boolean) as string[]),
  ];
  const participantEmails = [
    ...new Set([
      ...(state.tableMeta.setupInvitedEmails ?? []).map((e) => e.trim().toLowerCase()),
      state.tableMeta.owner?.ownerEmail?.trim().toLowerCase() ?? '',
      ...parts.participants.map((p) => p.email).filter(Boolean),
    ].filter(Boolean)),
  ];

  return {
    id: generateId(),
    tableId: state.session.id,
    tableName: resolveTableClothName(state.tableMeta),
    roundCount: parts.roundCount,
    wagerDescription: parts.wager,
    winnerPersonId: parts.winnerId ? resolveLedgerWinnerPersonId(state, parts.winnerId) : null,
    winnerName: parts.winnerName,
    loserPersonId: winnerIsBank ? parts.loserId : bankId && !winnerIsBank ? parts.loserId : null,
    loserName: parts.loserName,
    owedDescription: parts.owedDescription,
    playersInvolved,
    gameType: parts.gameType ?? (isZilchTable(state) ? 'zilch' : (state.tableGame ?? 'blackjack')),
    gameLabel: parts.gameLabel ?? (isZilchTable(state) ? 'Zilch' : undefined),
    protocolId: parts.protocolId ?? (isZilchTable(state) ? 'zilch' : state.blackjackProtocolId),
    zilchMode: parts.zilchMode,
    finalScores: parts.finalScores,
    mode: resolveTableModeFromState(state),
    settlementMode: resolveEffectiveSettlementMode(state),
    bankName: bankId
      ? isChallengeTable(state)
        ? formatBankHolderLabel(state, bankId)
        : bankShortName(state, bankId)
      : undefined,
    participantEmails,
    participants: parts.participants,
    createdAt: state.tableMeta.endedAt ?? new Date().toISOString(),
    status: 'open',
  };
}
export function recordScoreLedgerForGameEnd(state: GameState): ScoreLedgerEntry | null {
  return addGameToPersonalLedger(state);
}

export interface AddGameToPersonalLedgerOptions {
  savedByEmail?: string;
}

/** Add a fully completed game to the personal (score) ledger — idempotent per table session. */
export function addGameToPersonalLedger(
  state: GameState,
  options?: AddGameToPersonalLedgerOptions,
): ScoreLedgerEntry | null {
  if (state.tableMeta.gameStatus !== 'ended') {
    throw new Error('Game must be fully completed before adding to personal ledger');
  }
  if (!canAddGameToPersonalLedger(state)) {
    return null;
  }
  const { entry } = buildGameOverSummary(state);
  if (!entry) {
    return null;
  }
  const saverEmail = options?.savedByEmail?.trim().toLowerCase() ?? '';
  const existing = loadScoreLedgerEntries().find(
    (e) => e.tableId === entry.tableId && e.status !== 'cancelled',
  );
  if (existing) {
    if (saverEmail && !existing.savedByEmails?.includes(saverEmail)) {
      const next = {
        ...existing,
        savedByEmails: [...(existing.savedByEmails ?? []), saverEmail],
      };
      saveScoreLedgerEntries(
        loadScoreLedgerEntries().map((e) => (e.id === next.id ? next : e)),
      );
      return next;
    }
    return existing;
  }
  const toSave: ScoreLedgerEntry = saverEmail
    ? { ...entry, savedByEmails: [saverEmail] }
    : entry;
  appendScoreLedgerEntry(toSave);
  log.info('scoreLedgerGameEndRecorded', { entryId: toSave.id });
  return toSave;
}

export function hasPersonalLedgerEntryForTable(tableId: string): boolean {
  return loadScoreLedgerEntries().some((e) => e.tableId === tableId && e.status === 'open');
}
