// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  applyHoldemTableStakeSetup,
  createNewHoldemTable,
} from '../../engine/session';
import { assignBankBot } from '../../engine/session/boxOps';
import { createNewBlackjackTable } from '../../engine/session/table';
import { mapPokerTableViewModel } from './state/mapPokerTableViewModel';
import { PokerTableShell } from './components/PokerTableShell';
import { PokerPanel } from './components/PokerPanel';
import * as tableChatService from '../../features/messaging/tableChatService';

vi.mock('../../storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Alex', email: 'alex@example.com' }),
}));

afterEach(() => {
  cleanup();
});

describe('Poker UI layout integration', () => {
  it('renders compact header with metrics, cloth rail, and header deal control', () => {
    const state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
      stakeDescription: 'Practice',
      tableName: 'Poker StarWars',
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
      smallBlind: 1,
      bigBlind: 2,
      virtualPlayerCount: 1,
    });
    const vm = mapPokerTableViewModel(state, state.session.playerIds[0]!);
    const html = renderToStaticMarkup(
      <PokerTableShell
        gameState={state}
        viewModel={vm}
        canStartHand
        needsShuffle
        onStartHand={() => {}}
        onShuffleDeck={() => {}}
        onLeaveTable={() => {}}
      />,
    );

    expect(html).toContain('poker-table-shell__topbar');
    expect(html).toContain('poker0-header__controls');
    expect(html).toContain('This Table');
    expect(html).toContain('Poker StarWars');
    expect(html).toContain('poker-felt-cloth-layer__inner-rail');
    expect(html).toContain('poker0-cloth__title');
    expect(html).toContain('data-testid="poker-header-blinds"');
    expect(html).toContain('poker0-shell');
    expect(html).toContain('poker0-header__deal');
    expect(html).toContain('data-testid="poker-header-pot"');
    expect(html).not.toContain('poker-table-shell__subtitle');
    expect(html).not.toContain('poker-blinds__label');
    expect(html).not.toContain('data-testid="poker-chat-dock"');
    expect(html).not.toContain('TABLE CHAT');
    expect(html).toContain('data-testid="poker-header-blinds"');
    expect(html).toContain('1/2');
    expect(html).toContain('data-testid="poker-community-flop"');
  });

  it('does not render permanent table chat rail on felt layout', () => {
    const state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
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
    const html = renderToStaticMarkup(
      <PokerTableShell
        gameState={state}
        viewModel={mapPokerTableViewModel(state, state.session.playerIds[0]!)}
      />,
    );
    expect(html).not.toContain('data-testid="poker-chat-dock"');
    expect(html).not.toContain('poker-table-layout__controls');
  });

  it('2-player challenge maps two seats when bank is pruned', () => {
    let state = assignBankBot(createNewBlackjackTable(), 500);
    state = applyHoldemTableStakeSetup(state, {
      stakeDescription: '$50',
      seatChips: 500,
      bankChips: 500,
      bankerMode: 'self',
      bankerName: 'Host',
      controllerName: 'Host',
      controllerEmail: 'host@example.com',
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
      session: { ...state.session, playerIds: [...state.session.playerIds, 'guest'] },
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
    const vm = mapPokerTableViewModel(state, hostId);
    expect(vm.seats).toHaveLength(2);
  });

  it('PokerPanel uses shared table chat service via hook', async () => {
    const getSpy = vi.spyOn(tableChatService, 'getTableMessages').mockResolvedValue([]);
    const state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
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

    render(
      <PokerPanel
        gameState={state}
        onGameStateChange={() => {}}
        onExitTable={() => {}}
      />,
    );

    await vi.waitFor(() => {
      expect(getSpy).toHaveBeenCalled();
    });
    getSpy.mockRestore();
  });

  it('This Table menu exposes invite and edit blinds', () => {
    const state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
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

    render(
      <PokerPanel
        gameState={state}
        onGameStateChange={() => {}}
        onInviteTable={() => {}}
        onExitTable={() => {}}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'This Table' })[0]!);
    expect(screen.getByRole('button', { name: /Invite to table/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Edit blinds/i })).toBeTruthy();
    expect(screen.getByText('Chat')).toBeTruthy();
  });
});
