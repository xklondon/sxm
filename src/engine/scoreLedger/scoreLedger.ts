import type { GameState } from '../../types';
import type { ScoreLedgerEntry, ScoreLedgerParticipantResult } from '../../types/scoreLedger';
import { resolveTableClothName } from '../../types/tableFeltSkin';
import { generateId } from '../utils/id';
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
    gameType: state.tableGame ?? 'blackjack',
    protocolId: state.blackjackProtocolId,
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
