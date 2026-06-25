import { describe, expect, it } from 'vitest';
import { createNewHoldemTable } from '../../../engine/session/table';
import {
  formatPokerHoldemActionError,
  mapPokerUiActionToHoldemAction,
  mapPokerUiToServerTableAction,
  runPokerHoldemAction,
} from './pokerHoldemDispatch';

describe('pokerHoldemDispatch', () => {
  it('runPokerHoldemAction delegates to applyHoldemActionToState for start-hand', () => {
    const state = createNewHoldemTable();
    const result = runPokerHoldemAction(state, { type: 'start-hand' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Shuffle the deck/i);
    }
  });

  it('maps UI player actions to canonical holdem actions', () => {
    expect(mapPokerUiActionToHoldemAction('fold', 'seat-1')).toEqual({
      type: 'fold',
      actorSeatId: 'seat-1',
      requestedByPlayerId: 'seat-1',
    });
    expect(mapPokerUiActionToHoldemAction('bet', 'seat-2', 20)).toEqual({
      type: 'bet',
      actorSeatId: 'seat-2',
      requestedByPlayerId: 'seat-2',
      amount: 20,
    });
    expect(mapPokerUiActionToHoldemAction('all-in', 'seat-2')).toEqual({
      type: 'all-in',
      actorSeatId: 'seat-2',
      requestedByPlayerId: 'seat-2',
    });
    expect(mapPokerUiActionToHoldemAction('start-hand', 'seat-3')).toEqual({
      type: 'start-hand',
      requestedByPlayerId: 'seat-3',
    });
  });

  it('maps all-in UI action to holdemAllIn server action', () => {
    expect(mapPokerUiToServerTableAction('all-in')).toEqual({
      type: 'holdemAllIn',
      payload: {},
    });
  });

  it('passes through action errors for the panel', () => {
    expect(formatPokerHoldemActionError('Not your turn')).toBe('Not your turn');
  });

  it('failed wrapper result returns unchanged state reference', () => {
    const state = createNewHoldemTable();
    const result = runPokerHoldemAction(state, { type: 'all-in' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.state).toBe(state);
      expect(result.error).toMatch(/Texas Hold'em|No active|Shuffle/i);
    }
  });
});
