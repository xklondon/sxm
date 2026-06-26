import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import { shuffleGameDeck } from '../deck';
import {
  deriveAllBalancesFromLedger,
  derivePlayerBalanceFromLedger,
} from '../ledger/ledger';
import { applyHoldemTableStakeSetup } from '../session/holdemTableSetup';
import { createNewHoldemTable } from '../session/table';
import { listHoldemPlayableSeatIds } from './holdemPlayableSeats';
import { applyHoldemActionToState } from './applyHoldemActionToState';
import { getHoldemActingSeatId } from './holdemSelectors';
import { validateHoldemStartHand } from './holdemStartValidation';
import { getFirstPreflopActor } from './helpers';

function practiceTable(virtualPlayerCount = 1): GameState {
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
    virtualPlayerCount,
  });
}

function startHand(state: GameState) {
  return applyHoldemActionToState(shuffleGameDeck(state), { type: 'start-hand' });
}

describe('holdem start hand flow', () => {
  it('start hand from idle posts blinds automatically', () => {
    const table = practiceTable();
    const seats = listHoldemPlayableSeatIds(table);
    const before = deriveAllBalancesFromLedger(table.session, table.ledger);
    const result = startHand(table);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const { holdem } = result.state;
    expect(holdem?.status).toBe('preflop');
    expect(holdem?.pot).toBeGreaterThan(0);
    expect(holdem?.currentBet).toBe(10);

    const after = deriveAllBalancesFromLedger(result.state.session, result.state.ledger);
    const sbId = holdem?.smallBlindPlayerId!;
    const bbId = holdem?.bigBlindPlayerId!;
    expect(before[sbId]! - after[sbId]!).toBe(5);
    expect(before[bbId]! - after[bbId]!).toBe(10);
    expect(seats.every((id) => (before[id] ?? 0) > 0)).toBe(true);
  });

  it('start hand deals two hole cards per active player', () => {
    const result = startHand(practiceTable());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const seats = listHoldemPlayableSeatIds(result.state);
    for (const seatId of seats) {
      const ps = result.state.holdem?.playerStates[seatId];
      expect(ps?.holeCardIds).toHaveLength(2);
    }
  });

  it('start hand enters preflop betting with an active actor', () => {
    const result = startHand(practiceTable());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.holdem?.status).toBe('preflop');
    expect(result.state.holdem?.bettingStreet).toBe('preflop');
    expect(getHoldemActingSeatId(result.state)).toBeTruthy();
  });

  it('heads-up preflop actor is dealer / small blind', () => {
    const result = startHand(practiceTable(1));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const dealerId = result.state.holdem?.dealerButtonPlayerId!;
    const sbId = result.state.holdem?.smallBlindPlayerId!;
    expect(dealerId).toBe(sbId);
    expect(getHoldemActingSeatId(result.state)).toBe(dealerId);
  });

  it('three or more players — preflop actor is UTG (seat after big blind)', () => {
    const result = startHand(practiceTable(2));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const bbId = result.state.holdem?.bigBlindPlayerId!;
    const dealerId = result.state.holdem?.dealerButtonPlayerId!;
    const expected = getFirstPreflopActor(result.state.session, bbId, dealerId);
    expect(getHoldemActingSeatId(result.state)).toBe(expected);
    expect(listHoldemPlayableSeatIds(result.state)).toHaveLength(3);
  });

  it('blocks start when fewer than two playable seats', () => {
    let state = practiceTable(0);
    state = {
      ...state,
      session: { ...state.session, playerIds: [state.session.playerIds[0]!] },
    };
    expect(validateHoldemStartHand(state)).toMatch(/Need at least 2 players/i);
    const result = applyHoldemActionToState(shuffleGameDeck(state), { type: 'start-hand' });
    expect(result.ok).toBe(false);
  });

  it('blocks start when a playable seat has zero chips', () => {
    const state = practiceTable(1);
    const seats = listHoldemPlayableSeatIds(state);
    const brokeId = seats[1]!;
    const brokeName = state.players[brokeId]?.displayName ?? 'Player';
    const drained = {
      ...state,
      ledger: {
        ...state.ledger,
        entries: state.ledger.entries.filter((entry) => entry.playerId !== brokeId),
      },
    };
    expect(derivePlayerBalanceFromLedger(brokeId, drained.ledger)).toBe(0);
    expect(validateHoldemStartHand(drained)).toMatch(new RegExp(`${brokeName} has no chips`, 'i'));
    const result = applyHoldemActionToState(shuffleGameDeck(drained), { type: 'start-hand' });
    expect(result.ok).toBe(false);
  });
});
