// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  applyHoldemTableStakeSetup,
  createNewBlackjackTable,
  createNewHoldemTable,
  createNewZilchTable,
  isBlackjackTable,
  isHoldemTable,
  normalizeLoadedGameState,
} from '../../engine/session';
import { assignBankBot } from '../../engine/session/boxOps';
import { TableScreen } from '../../screens/TableScreen';
import { TableStakePanel } from '../../components/TableStakePanel';
import { PokerPanel } from './components/PokerPanel';
import * as tableChatService from '../../features/messaging/tableChatService';

vi.mock('../../storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Alex', email: 'alex@example.com' }),
}));

afterEach(() => {
  cleanup();
});

describe('Poker live route — no legacy shell', () => {
  it('holdem cardGame routes to PokerPanel even when tableGame is still blackjack (online bootstrap)', () => {
    let state = assignBankBot(createNewBlackjackTable(), 500);
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        cardGame: 'holdem',
        gameCategory: 'cards',
        pokerConfig: {
          mode: 'practice',
          wagerLabel: 'Practice',
          startingStack: 500,
          smallBlind: 5,
          bigBlind: 10,
          currency: '$',
          handNumber: 0,
          dealerSeatId: state.session.playerIds[0]!,
        },
      },
    };
    expect(isHoldemTable(state)).toBe(true);
    expect(isBlackjackTable(state)).toBe(false);

    const html = renderToStaticMarkup(
      <TableScreen gameState={state} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('poker-panel');
    expect(html).toContain('poker-hr-shell');
    expect(html.match(/poker-hr-shell/g)?.length).toBe(1);
    expect(html).not.toContain('HoldemPanel');
    expect(html).not.toContain('bj-casino');
    expect(html).not.toContain('holdem-panel');
    expect(html).not.toContain('data-testid="poker-chat-dock"');
    expect(html).not.toContain('table-chat-dock');
  });

  it('normalizeLoadedGameState repairs hybrid blackjack shell into texas-holdem', () => {
    let state = assignBankBot(createNewBlackjackTable(), 500);
    state = applyHoldemTableStakeSetup(state, {
      stakeDescription: 'Dinner',
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
      invitedEmails: ['guest@example.com'],
    });
    const hybrid = { ...state, tableGame: 'blackjack' as const, session: { ...state.session, gameType: 'blackjack' as const } };
    const normalized = normalizeLoadedGameState(hybrid);
    expect(normalized.tableGame).toBe('texas-holdem');
    expect(isHoldemTable(normalized)).toBe(true);
    expect(normalized.session.playerIds.every((id) => normalized.players[id]?.role !== 'bank')).toBe(true);
    expect(normalized.session.playerIds.every((id) => normalized.players[id]?.role !== 'box')).toBe(true);
  });

  it('does not render large external Invite button — invite lives in This Table menu', () => {
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

    expect(screen.queryByRole('button', { name: /^Invite to table$/i })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'This Table' })[0]!);
    expect(screen.getByRole('button', { name: /Invite to table/i })).toBeTruthy();
  });

  it('shows blinds once on felt and table name on cloth', () => {
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

    const html = renderToStaticMarkup(
      <TableScreen gameState={state} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('Poker StarWars');
    expect(html).toContain('poker-felt-cloth-layer');
    expect(html.match(/Blinds 1\/2/g)?.length).toBe(1);
    expect(html).not.toContain('data-testid="poker-chat-dock"');
    expect(html).not.toContain('Setup');
  });

  it('Poker Challenge setup has no Total Challenge Value field but has invite message', () => {
    const html = renderToStaticMarkup(
      <TableStakePanel
        gameState={createNewHoldemTable()}
        embeddedInOverlay
        entryPoint="root"
        onConfirm={() => {}}
      />,
    );
    expect(html).toContain('Cards');
    expect(html).not.toContain('Total challenge value');
  });

  it('holdem challenge configure step includes invite message field', () => {
    const panel = render(
      <TableStakePanel
        gameState={createNewHoldemTable()}
        embeddedInOverlay
        entryPoint="root"
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }));
    fireEvent.click(
      screen.getByRole('button', { name: /Poker.*Texas Hold/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Challenge' }));
    expect(screen.queryByText('Total challenge value')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('friend@example.com'), {
      target: { value: 'guest@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Message for invite')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start Poker/i })).toBeTruthy();
    panel.unmount();
  });

  it('uses shared table chat service', async () => {
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

    render(<PokerPanel gameState={state} onGameStateChange={() => {}} onExitTable={() => {}} />);
    await vi.waitFor(() => expect(getSpy).toHaveBeenCalled());
    getSpy.mockRestore();
  });
});

describe('Poker live route — regression', () => {
  it('blackjack table still renders BlackjackPanel', () => {
    const html = renderToStaticMarkup(
      <TableScreen gameState={createNewBlackjackTable()} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('bj-casino');
    expect(html).not.toContain('poker-table-shell');
  });

  it('zilch table still renders ZilchPanel', () => {
    const html = renderToStaticMarkup(
      <TableScreen gameState={createNewZilchTable()} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('zilch-panel');
    expect(html).not.toContain('poker-table-shell');
  });
});
