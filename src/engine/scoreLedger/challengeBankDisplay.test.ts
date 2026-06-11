import { describe, expect, it } from 'vitest';
import { tableWithClaimedBox } from '../blackjack/sanity/fixtures';
import {
  isChallengeTable,
  resolveLedgerWinnerPersonId,
  resolveWinnerDisplayName,
} from './challengeBankDisplay';
import { buildGameOverSummary } from './scoreLedger';
import { buildIouHandoffCreateRequest } from './gameEndIou';

function challengeBankWinState() {
  const base = tableWithClaimedBox(1);
  const bankId = base.session.bankPlayerId!;
  const ownerPersonId = base.tableMeta.ownerPersonId!;
  return {
    ...base,
    players: {
      ...base.players,
      [bankId]: { ...base.players[bankId]!, playerType: 'real' as const, controllerName: 'Bob' },
      [ownerPersonId]: {
        ...base.players[ownerPersonId]!,
        playerType: 'real' as const,
        controllerName: 'Alice',
      },
    },
    tableMeta: {
      ...base.tableMeta,
      gameStatus: 'ended' as const,
      winnerId: bankId,
      tableMode: 'challenge' as const,
      owner: {
        ownerName: 'Alice',
        ownerEmail: 'alice@example.com',
        createdAt: new Date().toISOString(),
      },
      setupInvitedEmails: ['bob@example.com'],
    },
    session: { ...base.session, currentRound: 3 },
  };
}

describe('challenge bank display', () => {
  it('requires a human bank player in challenge mode', () => {
    const state = challengeBankWinState();
    expect(isChallengeTable(state)).toBe(true);
    expect(state.session.bankPlayerId).toBeTruthy();
    expect(state.players[state.session.bankPlayerId!]?.playerType).toBe('real');
  });

  it('formats bank win as player wins as Bank', () => {
    const state = challengeBankWinState();
    const bankId = state.session.bankPlayerId!;
    expect(resolveWinnerDisplayName(state, bankId)).toBe('Bob wins as Bank');
    const { message } = buildGameOverSummary(state);
    expect(message).toContain('Bob wins as Bank');
    expect(message).not.toMatch(/Bank won/i);
  });

  it('credits bank player id in ledger for challenge bank win', () => {
    const state = challengeBankWinState();
    const bankId = state.session.bankPlayerId!;
    expect(resolveLedgerWinnerPersonId(state, bankId)).toBe(bankId);
    const { entry } = buildGameOverSummary(state);
    expect(entry?.winnerPersonId).toBe(bankId);
    expect(entry?.winnerName).toBe('Bob wins as Bank');
  });

  it('uses player-facing bank label in challenge setup', () => {
    const state = challengeBankWinState();
    const bankId = state.session.bankPlayerId!;
    expect(resolveWinnerDisplayName(state, bankId)).toContain('Bob');
    expect(resolveWinnerDisplayName(state, bankId)).toContain('Bank');
  });

  it('practice mode allows anonymous bank winner id in ledger', () => {
    const base = tableWithClaimedBox(1);
    const bankId = base.session.bankPlayerId!;
    expect(resolveLedgerWinnerPersonId(base, bankId)).toBeNull();
  });

  it('IOU handoff uses player emails when bank wins challenge', () => {
    const state = challengeBankWinState();
    const request = buildIouHandoffCreateRequest(state);
    expect(request?.creditorEmail).toBe('bob@example.com');
    expect(request?.debtorEmail).toBe('alice@example.com');
  });
});
