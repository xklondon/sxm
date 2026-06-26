// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import {
  applyHoldemTableStakeSetup,
  createNewHoldemTable,
} from '../../engine/session';
import { applyHoldemActionToState } from '../../engine/holdem/applyHoldemActionToState';
import { processVirtualHoldemTurns } from '../../engine/holdem/gameState';
import { shuffleGameDeck } from '../../engine/deck';
import { mapPokerActionAvailability, mapPokerTableViewModel } from './state/mapPokerTableViewModel';
import { PokerActionPanel } from './components/PokerActionPanel';
import { PokerTableShell } from './components/PokerTableShell';
import { POKER_TEMPLATE_ACTION_BAR } from './pokerTemplateContract';

function practiceTable() {
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
    virtualPlayerCount: 1,
  });
}

function startPracticeHand() {
  const result = applyHoldemActionToState(shuffleGameDeck(practiceTable()), { type: 'start-hand' });
  expect(result.ok).toBe(true);
  return result.state;
}

describe('Poker betting action availability', () => {
  it('preflop after blinds: actor can Call and Raise, not Check or Bet', () => {
    const state = startPracticeHand();
    const actor = state.holdem?.activePlayerId!;
    const availability = mapPokerActionAvailability(state);

    expect(availability.canCall).toBe(true);
    expect(availability.canRaise).toBe(true);
    expect(availability.canFold).toBe(true);
    expect(availability.canCheck).toBe(false);
    expect(availability.canBet).toBe(false);
    expect(state.holdem?.currentBet).toBeGreaterThan(
      state.holdem?.playerStates[actor]?.playerBetsThisStreet ?? 0,
    );
  });

  it('postflop with no bet: first actor can Check and Bet', () => {
    const started = startPracticeHand();
    const actor = started.holdem?.activePlayerId!;
    const state = {
      ...started,
      holdem: {
        ...started.holdem!,
        status: 'flop' as const,
        bettingStreet: 'flop' as const,
        currentBet: 0,
        activePlayerId: actor,
        playerStates: {
          ...started.holdem!.playerStates,
          [actor]: {
            ...started.holdem!.playerStates[actor]!,
            playerBetsThisStreet: 0,
            hasActedThisStreet: false,
          },
        },
      },
    };
    const availability = mapPokerActionAvailability(state);
    expect(availability.canCheck).toBe(true);
    expect(availability.canBet).toBe(true);
    expect(availability.canCall).toBe(false);
    expect(availability.canRaise).toBe(false);
  });

  it('postflop facing a bet: actor can Call and Raise, not Bet', () => {
    const base = startPracticeHand();
    const actor = base.session.playerIds.find((id) => id !== base.holdem?.activePlayerId)!;
    const state = {
      ...base,
      holdem: {
        ...base.holdem!,
        status: 'flop' as const,
        bettingStreet: 'flop' as const,
        currentBet: 20,
        activePlayerId: actor,
        lastRaiseSize: 10,
        playerStates: {
          ...base.holdem!.playerStates,
          [actor]: {
            ...base.holdem!.playerStates[actor]!,
            playerBetsThisStreet: 0,
            hasActedThisStreet: false,
          },
        },
      },
    };
    const availability = mapPokerActionAvailability(state);
    expect(availability.canCall).toBe(true);
    expect(availability.canRaise).toBe(true);
    expect(availability.canBet).toBe(false);
    expect(availability.canCheck).toBe(false);
  });

  it('virtual practice opponent auto-advances after host acts', () => {
    let state = startPracticeHand();
    const hostId = state.session.playerIds[0]!;
    let actor = state.holdem?.activePlayerId!;
    if (state.players[actor]?.playerType === 'virtual') {
      state = processVirtualHoldemTurns(state);
      actor = state.holdem?.activePlayerId!;
    }
    expect(state.players[actor]?.playerType).not.toBe('virtual');
    const called = applyHoldemActionToState(state, { type: 'call', actorSeatId: actor });
    expect(called.ok).toBe(true);
    const advanced = processVirtualHoldemTurns(called.state);
    expect(advanced.holdem?.activePlayerId).toBeTruthy();
    expect(advanced.holdem?.status).not.toBe('resolved');
  });
});

describe('Poker action labels', () => {
  it('never renders blackjack Stay label', () => {
    const state = startPracticeHand();
    const availability = mapPokerActionAvailability(state);
    const html = renderToStaticMarkup(
      <PokerActionPanel
        activePlayerName="Alex"
        availability={availability}
        pot={state.holdem?.pot}
        bigBlind={10}
      />,
    );
    expect(html).not.toMatch(/\bStay\b/);
    expect(html).toContain('Fold');
    expect(html).toContain('Call');
    expect(html).toContain('Raise');
    expect(html).not.toContain('Check');
    expect(html).not.toContain('Bet 10');
  });

  it('postflop shows Check and Bet labels when legal', () => {
    const base = startPracticeHand();
    const actor = base.holdem?.activePlayerId!;
    const state = {
      ...base,
      holdem: {
        ...base.holdem!,
        status: 'flop' as const,
        bettingStreet: 'flop' as const,
        currentBet: 0,
        activePlayerId: actor,
        playerStates: {
          ...base.holdem!.playerStates,
          [actor]: {
            ...base.holdem!.playerStates[actor]!,
            playerBetsThisStreet: 0,
            hasActedThisStreet: false,
          },
        },
      },
    };
    const html = renderToStaticMarkup(
      <PokerActionPanel
        activePlayerName="Alex"
        availability={mapPokerActionAvailability(state)}
        bigBlind={10}
      />,
    );
    expect(html).toContain('Check');
    expect(html).toContain('Bet');
    expect(html).not.toMatch(/\bStay\b/);
  });

  it('shows Waiting for opponent copy when not viewer turn', () => {
    render(
      <PokerActionPanel
        activePlayerName={null}
        waitingForPlayerName="Virtual Player 2"
        availability={{
          canCheck: false,
          canCall: false,
          canBet: false,
          canRaise: false,
          canFold: false,
          canAllIn: false,
          callAmount: 0,
          allInAmount: 0,
          minBet: 10,
          minRaise: 10,
        }}
      />,
    );
    expect(screen.getByText(/Waiting for Virtual Player 2/i)).toBeTruthy();
    expect(screen.queryByText(/Stay/i)).toBeNull();
  });
});

describe('Poker action bar placement', () => {
  it('action bar uses template class outside felt overflow', () => {
    const state = practiceTable();
    const html = renderToStaticMarkup(
      <PokerTableShell
        gameState={state}
        viewModel={mapPokerTableViewModel(state, state.session.playerIds[0]!)}
      />,
    );
    expect(html).toContain(POKER_TEMPLATE_ACTION_BAR);
    expect(html).toContain('poker-hr-layout__actions');
    expect(html).not.toContain('data-testid="poker-chat-dock"');
  });
});
