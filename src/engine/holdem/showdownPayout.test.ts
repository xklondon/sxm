import { describe, expect, it } from 'vitest';
import type { GameSession } from '../../types/session';
import type { Ledger } from '../../types/ledger';
import { createEmptyHoldemRound } from '../../types/holdem';
import { createEmptyLedger } from '../../types/ledger';
import { executeHoldemPayout } from './showdownPayout';
import { buildHoldemSidePots } from './sidePots';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import type { RankedHoldemHand } from './handEvaluator';

function mockHand(label: string): RankedHoldemHand {
  return {
    category: 'high-card',
    categoryRank: 1,
    tiebreak: [14],
    cards: [],
    label,
  };
}

function sessionWithPlayers(ids: string[]): GameSession {
  return {
    id: 'sess-1',
    playerIds: ids,
    currentRound: 1,
    status: 'active',
    gameType: 'texas-holdem',
    dealerButtonPlayerId: ids[0],
    ledgerEntryIds: [],
  } as GameSession;
}

describe('executeHoldemPayout', () => {
  it('13. showdown pays main pot to best hand', () => {
    const session = sessionWithPlayers(['A', 'B']);
    const ledger = createEmptyLedger('sess-1');
    let round = createEmptyHoldemRound('A', 'A', 'B');
    round = {
      ...round,
      status: 'showdown',
      communityCardIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
      playerStates: {
        A: {
          holeCardIds: ['h1', 'h2'],
          actionStatus: 'active',
          playerBetsThisStreet: 0,
          playerTotalCommitted: 100,
          hasActedThisStreet: true,
        },
        B: {
          holeCardIds: ['h3', 'h4'],
          actionStatus: 'active',
          playerBetsThisStreet: 0,
          playerTotalCommitted: 100,
          hasActedThisStreet: true,
        },
      },
    };

    const result = executeHoldemPayout(session, {}, ledger, round, ['A', 'B'], {
      reason: 'showdown',
      rankedHands: [
        { seatId: 'A', hand: { ...mockHand('Pair of Aces'), tiebreak: [14, 13] } },
        { seatId: 'B', hand: { ...mockHand('High card'), tiebreak: [9] } },
      ],
    });

    expect(result.winnerIds).toEqual(['A']);
    expect(result.payouts[0]?.amount).toBe(200);
    const balanceA = derivePlayerBalanceFromLedger('A', result.ledger);
    expect(balanceA).toBe(200);
  });

  it('14. showdown pays side pot correctly', () => {
    const session = sessionWithPlayers(['A', 'B', 'C']);
    const ledger = createEmptyLedger('sess-1');
    let round = createEmptyHoldemRound('A', 'A', 'B');
    round = {
      ...round,
      status: 'showdown',
      playerStates: {
        A: {
          holeCardIds: [],
          actionStatus: 'all-in',
          playerBetsThisStreet: 0,
          playerTotalCommitted: 50,
          hasActedThisStreet: true,
        },
        B: {
          holeCardIds: [],
          actionStatus: 'active',
          playerBetsThisStreet: 0,
          playerTotalCommitted: 100,
          hasActedThisStreet: true,
        },
        C: {
          holeCardIds: [],
          actionStatus: 'active',
          playerBetsThisStreet: 0,
          playerTotalCommitted: 100,
          hasActedThisStreet: true,
        },
      },
    };
    round.sidePots = buildHoldemSidePots([
      { seatId: 'A', amount: 50 },
      { seatId: 'B', amount: 100 },
      { seatId: 'C', amount: 100 },
    ]);

    const result = executeHoldemPayout(session, {}, ledger, round, ['A', 'B', 'C'], {
      reason: 'showdown',
      rankedHands: [
        { seatId: 'A', hand: { ...mockHand('Pair'), tiebreak: [14] } },
        { seatId: 'B', hand: { ...mockHand('Two pair'), tiebreak: [13, 12] } },
        { seatId: 'C', hand: { ...mockHand('High card'), tiebreak: [7] } },
      ],
    });

    expect(result.payouts).toHaveLength(2);
    const paidA = derivePlayerBalanceFromLedger('A', result.ledger);
    const paidB = derivePlayerBalanceFromLedger('B', result.ledger);
    expect(paidA).toBe(150);
    expect(paidB).toBe(100);
  });

  it('15. showdown handles tie split', () => {
    const session = sessionWithPlayers(['A', 'B']);
    const ledger = createEmptyLedger('sess-1');
    let round = createEmptyHoldemRound('A', 'A', 'B');
    round = {
      ...round,
      status: 'showdown',
      playerStates: {
        A: {
          holeCardIds: [],
          actionStatus: 'active',
          playerBetsThisStreet: 0,
          playerTotalCommitted: 100,
          hasActedThisStreet: true,
        },
        B: {
          holeCardIds: [],
          actionStatus: 'active',
          playerBetsThisStreet: 0,
          playerTotalCommitted: 100,
          hasActedThisStreet: true,
        },
      },
    };

    const result = executeHoldemPayout(session, {}, ledger, round, ['A', 'B'], {
      reason: 'showdown',
      rankedHands: [
        { seatId: 'A', hand: mockHand('Same') },
        { seatId: 'B', hand: mockHand('Same') },
      ],
    });

    expect(result.winnerIds.sort()).toEqual(['A', 'B']);
    expect(derivePlayerBalanceFromLedger('A', result.ledger)).toBe(100);
    expect(derivePlayerBalanceFromLedger('B', result.ledger)).toBe(100);
  });

  it('16. fold win applies uncalled return then pays winner', () => {
    const session = sessionWithPlayers(['A', 'B']);
    const ledger = createEmptyLedger('sess-1');
    let round = createEmptyHoldemRound('A', 'A', 'B');
    round = {
      ...round,
      playerStates: {
        A: {
          holeCardIds: [],
          actionStatus: 'active',
          playerBetsThisStreet: 100,
          playerTotalCommitted: 100,
          hasActedThisStreet: true,
        },
        B: {
          holeCardIds: [],
          actionStatus: 'folded',
          playerBetsThisStreet: 50,
          playerTotalCommitted: 50,
          hasActedThisStreet: true,
        },
      },
    };

    const result = executeHoldemPayout(session, { A: { displayName: 'Alice' } }, ledger, round, ['A'], {
      reason: 'all others folded',
    });

    expect(result.round.playerStates.A!.playerTotalCommitted).toBe(50);
    expect(derivePlayerBalanceFromLedger('A', result.ledger)).toBe(150);
  });

  it('17. two-player pot pays sole winner total committed', () => {
    const session = sessionWithPlayers(['A', 'B']);
    const ledger = createEmptyLedger('sess-1');
    let round = createEmptyHoldemRound('A', 'A', 'B');
    round = {
      ...round,
      playerStates: {
        A: {
          holeCardIds: [],
          actionStatus: 'active',
          playerBetsThisStreet: 20,
          playerTotalCommitted: 20,
          hasActedThisStreet: true,
        },
        B: {
          holeCardIds: [],
          actionStatus: 'folded',
          playerBetsThisStreet: 10,
          playerTotalCommitted: 10,
          hasActedThisStreet: true,
        },
      },
    };

    const result = executeHoldemPayout(session, {}, ledger, round, ['A'], {
      reason: 'all others folded',
    });

    expect(derivePlayerBalanceFromLedger('A', result.ledger)).toBe(30);
  });
});
