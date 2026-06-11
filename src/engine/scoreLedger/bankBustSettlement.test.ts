import { describe, expect, it } from 'vitest';
import type { LedgerEntry } from '../../types/ledger';
import type { GameState } from '../../types';
import type { BankBustSettlementMode } from '../../types/table';
import { tableAfterStartPlaying } from '../blackjack/sanity/fixtures';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { finalizeInviteJoinAtTable } from '../session/inviteJoin';
import { applyTableStakeSetup } from '../session/tableSetup';
import { applyTableGameEndIfNeeded, evaluateTableGameEnd } from '../session/tableGameEnd';
import {
  getConfiguredBankBustSettlementMode,
  isFractionalChallengeEnd,
  resolveClearTopNonBankWinner,
  resolveEffectiveSettlementMode,
} from './challengeEndAccounting';
import { buildGameOverSummary } from './scoreLedger';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function appendTestLedgerEntry(
  state: ReturnType<typeof tableAfterStartPlaying>,
  entry: Omit<LedgerEntry, 'id' | 'timestamp'>,
) {
  return {
    ...state,
    ledger: {
      ...state.ledger,
      entries: [
        ...state.ledger.entries,
        {
          ...entry,
          id: `test-${entry.playerId}-${entry.balanceAfter}`,
          timestamp: new Date().toISOString(),
        },
      ],
    },
  };
}

function challengeTableWithGuest() {
  let state = tableAfterStartPlaying(500);

  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'Carol',
    controllerName: 'Carol',
    role: 'person',
    startingChips: 0,
  });
  state = mergeSessionUpdate(state, guestSpl);
  const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
  state = finalizeInviteJoinAtTable(state, guestId, 'Carol').state;

  state = applyTableStakeSetup(state, {
    stakeDescription: '€20',
    tableName: 'Challenge',
    seatChips: 500,
    bankChips: 500,
    bankerMode: 'other',
    bankerName: 'Bob',
    controllerName: 'Alice',
    controllerEmail: 'alice@example.com',
    protocolId: 'las-vegas-house',
    naturalDealing: false,
    dealSpeedPreset: 'fast',
    cardTimerPreset: 0,
    bankDrawAuto: true,
    tableMode: 'challenge',
    invitedEmails: ['carol@example.com'],
    bankBustSettlementMode: 'fractional',
  });

  const bankId = state.session.bankPlayerId!;
  const ownerId = state.tableMeta.ownerPersonId!;

  state = {
    ...state,
    players: {
      ...state.players,
      [bankId]: { ...state.players[bankId]!, playerType: 'real', controllerName: 'Bob' },
    },
  };

  return { state, bankId, ownerId, guestId };
}

function bankBustWithBalances(
  mode: BankBustSettlementMode,
  balances: { bank: number; owner: number; guest: number },
) {
  const { state, bankId, ownerId, guestId } = challengeTableWithGuest();
  let next: GameState = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      bankBustSettlementMode: mode,
      tableMode: 'challenge',
    },
  };
  next = appendTestLedgerEntry(next, {
    roundNumber: next.session.currentRound,
    playerId: bankId,
    entryType: 'loss-collected',
    amount: balances.bank - 500,
    balanceBefore: 500,
    balanceAfter: balances.bank,
    description: 'test bank',
  });
  next = appendTestLedgerEntry(next, {
    roundNumber: next.session.currentRound,
    playerId: ownerId,
    entryType: 'win-paid',
    amount: balances.owner - 500,
    balanceBefore: 500,
    balanceAfter: balances.owner,
    description: 'test owner',
  });
  next = appendTestLedgerEntry(next, {
    roundNumber: next.session.currentRound,
    playerId: guestId,
    entryType: 'win-paid',
    amount: balances.guest - 500,
    balanceBefore: 500,
    balanceAfter: balances.guest,
    description: 'test guest',
  });
  return applyTableGameEndIfNeeded(next);
}

const STAKE_PANEL_SRC = readFileSync(
  join(process.cwd(), 'src/components/TableStakePanel.tsx'),
  'utf8',
);

describe('bank bust settlement setup', () => {
  it('defaults challenge setup to fractional', () => {
    const { state } = challengeTableWithGuest();
    expect(getConfiguredBankBustSettlementMode(state)).toBe('fractional');
  });

  it('shows bank bust settlement selector only in challenge configure', () => {
    expect(STAKE_PANEL_SRC).toContain('Bank bust settlement');
    expect(STAKE_PANEL_SRC).toContain('Fractional / Ranked');
    expect(STAKE_PANEL_SRC).toContain('Winner Takes All');
    expect(STAKE_PANEL_SRC).toMatch(
      /function renderChallengeConfigure[\s\S]*Bank bust settlement/,
    );
    const practiceBlock = STAKE_PANEL_SRC.match(
      /function renderPracticeConfigure\(\)[\s\S]*?(?=function renderChallengeConfigure)/,
    )?.[0];
    expect(practiceBlock).toBeTruthy();
    expect(practiceBlock).not.toContain('Bank bust settlement');
  });

  it('persists winner-takes-all from table setup input', () => {
    let state = tableAfterStartPlaying(500);
    state = applyTableStakeSetup(state, {
      stakeDescription: '€20',
      seatChips: 500,
      bankChips: 500,
      bankerMode: 'self',
      bankerName: '',
      controllerName: 'Alice',
      controllerEmail: 'alice@example.com',
      protocolId: 'las-vegas-house',
      naturalDealing: false,
      dealSpeedPreset: 'fast',
      cardTimerPreset: 0,
      bankDrawAuto: true,
      tableMode: 'challenge',
      bankBustSettlementMode: 'winner-takes-all',
    });
    expect(state.tableMeta.bankBustSettlementMode).toBe('winner-takes-all');
  });
});

describe('bank bust settlement outcomes', () => {
  it('fractional bank bust keeps ranked multi-player behavior', () => {
    const ended = bankBustWithBalances('fractional', { bank: 0, owner: 700, guest: 300 });
    expect(ended.tableMeta.gameEndReason).toBe('bank-bust');
    expect(isFractionalChallengeEnd(ended, 'bank-bust')).toBe(true);
    expect(resolveEffectiveSettlementMode(ended)).toBe('fractional');
    const { entry, message } = buildGameOverSummary(ended);
    expect(entry?.settlementMode).toBe('fractional');
    expect(entry?.winnerName).toBe('Fractional result');
    expect(message).toContain('Final totals:');
  });

  it('winner-takes-all bank bust with clear top total records single winner', () => {
    const ended = bankBustWithBalances('winner-takes-all', { bank: 0, owner: 800, guest: 200 });
    expect(isFractionalChallengeEnd(ended, 'bank-bust')).toBe(false);
    expect(resolveEffectiveSettlementMode(ended)).toBe('winner-takes-all');
    expect(ended.tableMeta.winnerId).toBe(ended.tableMeta.ownerPersonId);
    const { entry, message } = buildGameOverSummary(ended);
    expect(entry?.settlementMode).toBe('winner-takes-all');
    expect(entry?.winnerPersonId).toBe(ended.tableMeta.ownerPersonId);
    expect(message).toContain('winner takes all');
  });

  it('winner-takes-all bank bust with tied top totals falls back without fake winner', () => {
    const ended = bankBustWithBalances('winner-takes-all', { bank: 0, owner: 500, guest: 500 });
    expect(resolveClearTopNonBankWinner(ended)).toBeNull();
    expect(isFractionalChallengeEnd(ended, 'bank-bust')).toBe(true);
    expect(resolveEffectiveSettlementMode(ended)).toBe('fractional');
    const evaluation = evaluateTableGameEnd(ended);
    expect(evaluation.winnerId).toBeNull();
    const { entry, message } = buildGameOverSummary(ended);
    expect(entry?.settlementMode).toBe('fractional');
    expect(entry?.winnerPersonId).toBeNull();
    expect(message).toContain('ranked settlement');
  });
});
