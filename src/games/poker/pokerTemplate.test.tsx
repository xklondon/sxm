// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  applyHoldemTableStakeSetup,
  createNewHoldemTable,
} from '../../engine/session';
import { appendLedgerEntry } from '../../engine/ledger/ledger';
import { createNewBlackjackTable, createNewZilchTable } from '../../engine/session/table';
import { applyHoldemActionToState } from '../../engine/holdem/applyHoldemActionToState';
import { shuffleGameDeck } from '../../engine/deck';
import { validateHoldemStartHand } from '../../engine/holdem/holdemStartValidation';
import { getHoldemActingSeatId } from '../../engine/holdem/holdemSelectors';
import { listHoldemPlayableSeatIds } from '../../engine/holdem/holdemPlayableSeats';
import { TableScreen } from '../../screens/TableScreen';
import { PokerPanel } from './components/PokerPanel';
import { PokerTableShell } from './components/PokerTableShell';
import { mapPokerTableViewModel } from './state/mapPokerTableViewModel';
import {
  POKER_TEMPLATE_ACTION_BAR,
  POKER_TEMPLATE_CLOTH,
  POKER_TEMPLATE_DEAL_BTN,
  POKER_TEMPLATE_SHELL,
  POKER_TEMPLATE_TABLE,
  POKER_TEMPLATE_TOPBAR,
} from './pokerTemplateContract';

vi.mock('../../storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Alex', email: 'alex@example.com' }),
}));

afterEach(() => {
  cleanup();
});

function practiceState(virtualPlayerCount = 1) {
  return applyHoldemTableStakeSetup(createNewHoldemTable(), {
    stakeDescription: 'Practice',
    tableName: 'High Roller Table',
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

describe('Poker High Roller template shell', () => {
  it('uses template shell classes from reference contract', () => {
    const state = practiceState();
    const html = renderToStaticMarkup(
      <PokerTableShell
        gameState={state}
        viewModel={mapPokerTableViewModel(state, state.session.playerIds[0]!)}
        canStartHand
        onStartHand={() => {}}
      />,
    );

    expect(html).toContain(POKER_TEMPLATE_SHELL);
    expect(html).toContain(POKER_TEMPLATE_TOPBAR);
    expect(html).toContain(POKER_TEMPLATE_TABLE);
    expect(html).toContain(POKER_TEMPLATE_CLOTH);
    expect(html).toContain(POKER_TEMPLATE_DEAL_BTN);
    expect(html).toContain(POKER_TEMPLATE_ACTION_BAR);
    expect(html).toContain('data-template="high-roller-protocol"');
    expect(html).toContain('poker-hr-seat__avatar');
  });

  it('Practice renders at least 2 seats and Deal Cards enabled immediately', () => {
    const state = practiceState();
    expect(listHoldemPlayableSeatIds(state).length).toBeGreaterThanOrEqual(2);
    expect(validateHoldemStartHand(state)).toBeNull();

    render(<PokerPanel gameState={state} onGameStateChange={() => {}} onExitTable={() => {}} />);
    const dealBtn = screen.getByRole('button', { name: /Deal Cards/i });
    expect(dealBtn).toBeTruthy();
    expect((dealBtn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/Waiting for invited player/i)).toBeNull();
  });

  it('clicking Deal Cards posts blinds, deals 2 cards, sets actor, pot equals SB+BB', () => {
    const state = practiceState();
    const onGameStateChange = vi.fn();
    render(<PokerPanel gameState={state} onGameStateChange={onGameStateChange} onExitTable={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Deal Cards/i }));

    expect(onGameStateChange).toHaveBeenCalled();
    const next = onGameStateChange.mock.calls.at(-1)![0] as ReturnType<typeof practiceState>;
    expect(next.holdem?.status).toBe('preflop');
    expect(next.holdem?.pot).toBe(15);
    expect(getHoldemActingSeatId(next)).toBeTruthy();

    for (const seatId of listHoldemPlayableSeatIds(next)) {
      expect(next.holdem?.playerStates[seatId]?.holeCardIds).toHaveLength(2);
    }
  });

  it('start flow via engine: single start-hand reaches preflop with pot SB+BB', () => {
    const started = applyHoldemActionToState(shuffleGameDeck(practiceState()), { type: 'start-hand' });
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(started.state.holdem?.pot).toBe(15);
      expect(started.state.holdem?.status).toBe('preflop');
    }
  });

  it('Challenge with only host shows waiting in top bar, Deal disabled', () => {
    let state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
      stakeDescription: '$50',
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
      totalChallengeValue: 50,
    });
    expect(validateHoldemStartHand(state)).toMatch(/Waiting for invited player/i);

    render(<PokerPanel gameState={state} onGameStateChange={() => {}} onExitTable={() => {}} />);
    expect(screen.getByText(/Waiting for invited player/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Deal Cards/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Challenge with host + guest enables Deal Cards', () => {
    let state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
      stakeDescription: '$50',
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
      totalChallengeValue: 50,
    });
    const hostId = state.session.playerIds[0]!;
    state = {
      ...state,
      session: { ...state.session, playerIds: [hostId, 'guest'] },
      players: {
        ...state.players,
        guest: {
          id: 'guest',
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
    for (const playerId of state.session.playerIds) {
      const funded = appendLedgerEntry(state.session, state.ledger, {
        playerId,
        entryType: 'buy-in',
        amount: 500,
        description: 'Test buy-in',
        roundNumber: state.session.currentRound,
      });
      state = { ...state, session: funded.session, ledger: funded.ledger };
    }

    expect(listHoldemPlayableSeatIds(state)).toHaveLength(2);
    expect(validateHoldemStartHand(state)).toBeNull();
    render(<PokerPanel gameState={state} onGameStateChange={() => {}} onExitTable={() => {}} />);
    expect((screen.getByRole('button', { name: /Deal Cards/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not render permanent right chat rail; blinds once; table name on cloth', () => {
    const state = practiceState();
    const html = renderToStaticMarkup(
      <TableScreen gameState={state} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(html).not.toContain('data-testid="poker-chat-dock"');
    expect(html).toContain('High Roller Table');
    expect(html).toContain('poker-hr-cloth');
    expect(html.match(/Blinds 5\/10/g)?.length).toBe(1);
    expect(html).toContain(POKER_TEMPLATE_ACTION_BAR);
  });

  it('Blackjack and Zilch smoke unchanged', () => {
    const bj = renderToStaticMarkup(
      <TableScreen gameState={createNewBlackjackTable()} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(bj).toContain('bj-casino');
    expect(bj).not.toContain(POKER_TEMPLATE_SHELL);

    const zilch = renderToStaticMarkup(
      <TableScreen gameState={createNewZilchTable()} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(zilch).toContain('zilch-panel');
    expect(zilch).not.toContain(POKER_TEMPLATE_SHELL);
  });
});
