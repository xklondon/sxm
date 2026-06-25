import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import type { HoldemRound } from '../../types/holdem';
import { createEmptyHoldemRound } from '../../types/holdem';
import { appendLedgerEntry } from '../ledger/ledger';
import { shuffleGameDeck } from '../deck';
import { applyHoldemTableStakeSetup, createNewHoldemTable } from '../session';
import {
  applyHoldemActionToState,
  allInHoldemOnState,
} from './index';
import { recomputeHoldemSidePots, syncHoldemPot } from './helpers';
import { allInHoldemPlayer, type HoldemActionContext } from './betting';

function practiceTable(): GameState {
  return applyHoldemTableStakeSetup(createNewHoldemTable(), {
    stakeDescription: 'Practice',
    seatChips: 500,
    bankChips: 500,
    bankerMode: 'self',
    bankerName: 'Alex',
    controllerName: 'Alex',
    controllerEmail: 'alex@example.com',
    protocolId: 'texas-holdem',
    naturalDealing: false,
    dealSpeedPreset: 'normal',
    cardTimerPreset: 0,
    bankDrawAuto: true,
    tableMode: 'practice',
    smallBlind: 5,
    bigBlind: 10,
    virtualPlayerCount: 2,
  });
}

function fundSeatedPlayers(state: GameState, amount = 500): GameState {
  let next = state;
  for (const playerId of next.session.playerIds) {
    const result = appendLedgerEntry(next.session, next.ledger, {
      playerId,
      entryType: 'buy-in',
      amount,
      description: 'Test buy-in',
      roundNumber: next.session.currentRound,
    });
    next = { ...next, session: result.session, ledger: result.ledger };
  }
  return next;
}

function activePreflopRound(state: GameState, stacks: Record<string, number>): GameState {
  const [p0, p1, p2] = state.session.playerIds;
  const round: HoldemRound = {
    ...createEmptyHoldemRound(p0!, p0!, p1!),
    status: 'preflop',
    bettingStreet: 'preflop',
    currentBet: 20,
    lastRaiseSize: 10,
    activePlayerId: p2!,
    playerStates: {
      [p0!]: {
        holeCardIds: [],
        actionStatus: 'acted',
        playerBetsThisStreet: 20,
        playerTotalCommitted: stacks[p0!] ?? 20,
        hasActedThisStreet: true,
      },
      [p1!]: {
        holeCardIds: [],
        actionStatus: 'acted',
        playerBetsThisStreet: 20,
        playerTotalCommitted: stacks[p1!] ?? 20,
        hasActedThisStreet: true,
      },
      [p2!]: {
        holeCardIds: [],
        actionStatus: 'active',
        playerBetsThisStreet: 0,
        playerTotalCommitted: stacks[p2!] ?? 0,
        hasActedThisStreet: false,
      },
    },
  };
  return { ...state, holdem: syncHoldemPot(round) };
}

describe('all-in holdem engine', () => {
  it('all-in commits full stack and marks player all-in', () => {
    let state = fundSeatedPlayers(shuffleGameDeck(practiceTable()));
    const playerId = state.session.playerIds[2]!;
    state = activePreflopRound(state, {
      [state.session.playerIds[0]!]: 20,
      [state.session.playerIds[1]!]: 20,
      [playerId]: 0,
    });

    const beforeBalance = state.ledger.entries.filter((e) => e.playerId === playerId).reduce(
      (sum, e) => sum + e.amount,
      0,
    );

    state = allInHoldemOnState(state);
    const ps = state.holdem!.playerStates[playerId]!;

    expect(ps.actionStatus).toBe('all-in');
    expect(ps.playerTotalCommitted).toBeGreaterThan(0);
    expect(ps.hasActedThisStreet).toBe(true);

    const afterBalance = state.ledger.entries.filter((e) => e.playerId === playerId).reduce(
      (sum, e) => sum + e.amount,
      0,
    );
    expect(afterBalance).toBe(0);
    expect(beforeBalance).toBeGreaterThan(0);
  });

  it('all-in advances action to next eligible player', () => {
    let state = fundSeatedPlayers(shuffleGameDeck(practiceTable()));
    const [p0, p1, p2] = state.session.playerIds;
    state = activePreflopRound(state, {
      [p0!]: 20,
      [p1!]: 20,
      [p2!]: 0,
    });

    state = allInHoldemOnState(state);
    expect(state.holdem?.playerStates[p2!]?.actionStatus).toBe('all-in');
    expect(state.holdem?.activePlayerId).not.toBe(p2);
  });

  it('zero stack cannot all-in via canonical action', () => {
    let state = fundSeatedPlayers(shuffleGameDeck(practiceTable()));
    const playerId = state.session.playerIds[0]!;
    state = {
      ...state,
      holdem: {
        ...createEmptyHoldemRound(playerId, playerId, state.session.playerIds[1]!),
        status: 'preflop',
        bettingStreet: 'preflop',
        activePlayerId: playerId,
        currentBet: 0,
        playerStates: {
          [playerId]: {
            holeCardIds: [],
            actionStatus: 'active',
            playerBetsThisStreet: 0,
            playerTotalCommitted: 0,
            hasActedThisStreet: false,
          },
        },
      },
    };
    for (const entry of [...state.ledger.entries]) {
      if (entry.playerId === playerId) {
        state = {
          ...state,
          ledger: {
            ...state.ledger,
            entries: state.ledger.entries.filter((e) => e !== entry),
          },
        };
      }
    }

    const result = applyHoldemActionToState(state, {
      type: 'all-in',
      actorSeatId: playerId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/No chips remaining/i);
    }
  });

  it('side pots recompute after all-in', () => {
    const round = syncHoldemPot({
      ...createEmptyHoldemRound('A', 'A', 'B'),
      playerStates: {
        A: {
          holeCardIds: [],
          actionStatus: 'all-in',
          playerBetsThisStreet: 50,
          playerTotalCommitted: 50,
          hasActedThisStreet: true,
        },
        B: {
          holeCardIds: [],
          actionStatus: 'active',
          playerBetsThisStreet: 100,
          playerTotalCommitted: 100,
          hasActedThisStreet: true,
        },
        C: {
          holeCardIds: [],
          actionStatus: 'active',
          playerBetsThisStreet: 100,
          playerTotalCommitted: 100,
          hasActedThisStreet: true,
        },
      },
    });

    expect(round.sidePots).toHaveLength(2);
    expect(round.pot).toBe(250);
  });

  it('direct allInHoldemPlayer rejects zero balance', () => {
    const round = createEmptyHoldemRound('A', 'A', 'B');
    const ctx: HoldemActionContext = {
      session: { playerIds: ['A'], currentRound: 1 } as HoldemActionContext['session'],
      ledger: { entries: [], nextEntryId: 1 },
      round: {
        ...round,
        status: 'preflop',
        activePlayerId: 'A',
        playerStates: {
          A: {
            holeCardIds: [],
            actionStatus: 'active',
            playerBetsThisStreet: 0,
            playerTotalCommitted: 0,
            hasActedThisStreet: false,
          },
        },
      },
      playerId: 'A',
    };
    expect(() => allInHoldemPlayer(ctx)).toThrow(/No chips remaining/i);
  });
});

describe('side pot integration after betting', () => {
  it('recomputes after bet via syncHoldemPot', () => {
    let round = createEmptyHoldemRound('A', 'A', 'B');
    round = {
      ...round,
      playerStates: {
        A: {
          holeCardIds: [],
          actionStatus: 'acted',
          playerBetsThisStreet: 100,
          playerTotalCommitted: 100,
          hasActedThisStreet: true,
        },
        B: {
          holeCardIds: [],
          actionStatus: 'acted',
          playerBetsThisStreet: 100,
          playerTotalCommitted: 100,
          hasActedThisStreet: true,
        },
      },
    };
    const synced = recomputeHoldemSidePots(round);
    expect(synced.sidePots).toHaveLength(1);
    expect(synced.sidePots![0]!.amount).toBe(200);
  });
});
