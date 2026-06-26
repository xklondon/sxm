// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  applyHoldemTableStakeSetup,
  createNewHoldemTable,
} from '../../engine/session';
import { appendLedgerEntry } from '../../engine/ledger/ledger';
import { validateHoldemStartHand } from '../../engine/holdem/holdemStartValidation';
import { listHoldemPlayableSeatIds } from '../../engine/holdem/holdemPlayableSeats';
import { PokerPanel } from './components/PokerPanel';
import type { GameState } from '../../types';

vi.mock('../../storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Alex', email: 'alex@example.com' }),
}));

afterEach(() => {
  cleanup();
});

function challengeTableHostOnly() {
  return applyHoldemTableStakeSetup(createNewHoldemTable(), {
    stakeDescription: '$100 challenge',
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
    tableMode: 'challenge',
    smallBlind: 5,
    bigBlind: 10,
    totalChallengeValue: 100,
  });
}

function fundGuest(state: GameState, hostId: string, guestId: string): GameState {
  let next: GameState = {
    ...state,
    session: { ...state.session, playerIds: [hostId, guestId] },
    players: {
      ...state.players,
      [guestId]: {
        id: guestId,
        displayName: 'Guest',
        controllerName: 'Guest',
        playerType: 'real',
        role: 'person',
        cardIds: [],
        currentBet: 0,
        status: 'active',
        startingBalance: 500,
      },
    },
  };
  for (const seatId of [hostId, guestId]) {
    const result = appendLedgerEntry(next.session, next.ledger, {
      playerId: seatId,
      entryType: 'buy-in',
      amount: 500,
      description: 'Challenge buy-in',
      roundNumber: next.session.currentRound,
    });
    next = { ...next, session: result.session, ledger: result.ledger };
  }
  return next;
}

describe('Poker online host sync on guest join', () => {
  it('host PokerPanel re-renders seats when gameState updates after guest join', () => {
    const hostOnly = challengeTableHostOnly();
    const hostId = hostOnly.session.playerIds[0]!;
    expect(listHoldemPlayableSeatIds(hostOnly)).toEqual([hostId]);
    expect(validateHoldemStartHand(hostOnly)).toMatch(/Waiting for invited player/i);

    const { rerender } = render(
      <PokerPanel gameState={hostOnly} onGameStateChange={() => {}} onExitTable={() => {}} />,
    );

    expect(document.querySelectorAll('[data-testid^="poker-seat-"]').length).toBe(1);
    expect(screen.getByTestId('poker-header-status').textContent).toMatch(/Waiting for invited player/i);
    expect(screen.getByTestId('poker-header-deal').hasAttribute('disabled')).toBe(true);

    const withGuest = fundGuest(hostOnly, hostId, 'guest-person');
    expect(listHoldemPlayableSeatIds(withGuest)).toEqual([hostId, 'guest-person']);
    expect(validateHoldemStartHand(withGuest)).toBeNull();

    rerender(
      <PokerPanel gameState={withGuest} onGameStateChange={() => {}} onExitTable={() => {}} />,
    );

    expect(document.querySelectorAll('[data-testid^="poker-seat-"]').length).toBe(2);
    expect(screen.queryByText(/Waiting for invited player/i)).toBeNull();
    expect(screen.getByTestId('poker-header-deal').hasAttribute('disabled')).toBe(false);
    expect(screen.getByTestId('poker-header-pot')).toBeTruthy();
    expect(document.querySelector('.poker-hr-pot')).toBeNull();
  });

  it('pot and deal render in header row, not felt center', () => {
    const state = challengeTableHostOnly();
    render(<PokerPanel gameState={state} onGameStateChange={() => {}} onExitTable={() => {}} />);

    expect(screen.getByTestId('poker-header-metrics')).toBeTruthy();
    expect(screen.getByTestId('poker-header-deal')).toBeTruthy();
    const center = screen.getByTestId('poker-felt-center');
    expect(center.querySelector('.poker-hr-pot')).toBeNull();
    expect(center.querySelector('.poker-hr-deal')).toBeNull();
    expect(center.querySelector('.poker-community')).toBeTruthy();
  });

  it('challenge participants are host + guest only (no bank/box/virtual)', () => {
    const hostOnly = challengeTableHostOnly();
    const hostId = hostOnly.session.playerIds[0]!;
    const withGuest = fundGuest(hostOnly, hostId, 'guest-person');
    const playable = listHoldemPlayableSeatIds(withGuest);
    expect(playable).toEqual([hostId, 'guest-person']);
    for (const seatId of playable) {
      const player = withGuest.players[seatId]!;
      expect(player.role).toBe('person');
      expect(player.playerType).toBe('real');
    }
  });
});
