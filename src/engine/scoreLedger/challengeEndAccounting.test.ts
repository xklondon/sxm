import { describe, expect, it } from 'vitest';
import type { LedgerEntry } from '../../types/ledger';
import { tableAfterStartPlaying } from '../blackjack/sanity/fixtures';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { finalizeInviteJoinAtTable } from '../session/inviteJoin';
import {
  buildChallengeEndRankings,
  buildFractionalEndMessage,
  isFractionalChallengeEnd,
} from './challengeEndAccounting';
import { buildGameOverSummary } from './scoreLedger';
import { buildIouHandoffCreateRequest } from './gameEndIou';

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

function fractionalBankBustState() {
  let state = tableAfterStartPlaying(500);
  const bankId = state.session.bankPlayerId!;
  const ownerId = state.tableMeta.ownerPersonId!;

  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'Carol',
    controllerName: 'Carol',
    role: 'person',
    startingChips: 0,
  });
  state = mergeSessionUpdate(state, guestSpl);
  const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
  state = finalizeInviteJoinAtTable(state, guestId, 'Carol').state;

  state = {
    ...state,
    players: {
      ...state.players,
      [bankId]: { ...state.players[bankId]!, playerType: 'real', controllerName: 'Bob' },
    },
    tableMeta: {
      ...state.tableMeta,
      gameStatus: 'ended',
      winnerId: ownerId,
      gameEndReason: 'bank-bust',
      settlementMode: 'fractional',
      tableMode: 'challenge',
      owner: {
        ownerName: 'Alice',
        ownerEmail: 'alice@example.com',
        createdAt: new Date().toISOString(),
      },
      setupInvitedEmails: ['bob@example.com', 'carol@example.com'],
    },
  };

  state = appendTestLedgerEntry(state, {
    roundNumber: state.session.currentRound,
    playerId: bankId,
    entryType: 'loss-collected',
    amount: -500,
    balanceBefore: 500,
    balanceAfter: 0,
    description: 'test: bank bust',
  });
  state = appendTestLedgerEntry(state, {
    roundNumber: state.session.currentRound,
    playerId: ownerId,
    entryType: 'win-paid',
    amount: 200,
    balanceBefore: 500,
    balanceAfter: 700,
    description: 'test: owner gain',
  });
  state = appendTestLedgerEntry(state, {
    roundNumber: state.session.currentRound,
    playerId: guestId,
    entryType: 'loss-collected',
    amount: -200,
    balanceBefore: 500,
    balanceAfter: 300,
    description: 'test: guest hold',
  });

  return state;
}

describe('challengeEndAccounting', () => {
  it('ranks players by final chip total after bank bankruptcy', () => {
    const state = fractionalBankBustState();
    const rankings = buildChallengeEndRankings(state);
    expect(rankings[0]?.endingChips).toBeGreaterThan(rankings[1]?.endingChips ?? 0);
    expect(rankings.filter((r) => r.endingChips > 0)).toHaveLength(2);
    expect(isFractionalChallengeEnd(state, 'bank-bust')).toBe(true);
  });

  it('builds ranked fractional end message without generic Bank won', () => {
    const state = fractionalBankBustState();
    const message = buildFractionalEndMessage(state);
    expect(message).toContain('Bob (Bank) is bust.');
    expect(message).toContain('Final totals:');
    expect(message).not.toMatch(/Bank won/i);
    const { entry } = buildGameOverSummary(state);
    expect(entry?.winnerName).toBe('Fractional result');
    expect(entry?.participants?.every((p) => p.personId || p.email)).toBe(true);
    expect(entry?.participants?.some((p) => p.rank === 1)).toBe(true);
  });

  it('disables IOU when multiple non-bank players hold chips', () => {
    const state = fractionalBankBustState();
    expect(buildIouHandoffCreateRequest(state)).toBeNull();
  });
});
