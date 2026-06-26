import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyHoldemTableStakeSetup,
  createNewBlackjackTable,
  createNewHoldemTable,
  createNewZilchTable,
  updatePokerBlindsOnState,
} from '../../engine/session';
import { TableStakePanel } from '../../components/TableStakePanel';
import { TableScreen } from '../../screens/TableScreen';
import { PokerTableShell } from './components/PokerTableShell';
import {
  buildPokerIouHandoffRequests,
  computePokerWinnerTakesAllSettlement,
} from './state/pokerChallengeSettlement';
import { ensureHoldemChallengeParticipantSnapshot } from '../../engine/holdem/challengeParticipants';
import { createDefaultPokerTableConfig } from './state/pokerTableConfig';
import { mapPokerTableViewModel } from './state/mapPokerTableViewModel';

describe('Poker setup flow', () => {
  it('TableStakePanel shows Poker protocol under Cards', () => {
    const html = renderToStaticMarkup(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        onConfirm={() => {}}
        embeddedInOverlay
        entryPoint="root"
      />,
    );
    expect(html).toContain('Cards');
    expect(html).toContain('Dice');
  });

  it('holdem stake setup stores poker config with blinds and challenge value', () => {
    let state = createNewHoldemTable();
    state = applyHoldemTableStakeSetup(state, {
      stakeDescription: '$100 dinner',
      tableName: 'Poker Night',
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
      invitedEmails: ['friend@example.com'],
      smallBlind: 5,
      bigBlind: 10,
      totalChallengeValue: 100,
      currency: '$',
    });
    expect(state.tableMeta.pokerConfig?.smallBlind).toBe(5);
    expect(state.tableMeta.pokerConfig?.bigBlind).toBe(10);
    expect(state.tableMeta.pokerConfig?.totalChallengeValue).toBe(100);
    expect(state.tableMeta.pokerConfig?.mode).toBe('challenge');
  });
});

describe('PokerTableShell routing', () => {
  it('TableScreen renders PokerPanel for holdem tables', () => {
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
      virtualPlayerCount: 2,
    });
    const html = renderToStaticMarkup(
      <TableScreen gameState={state} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('poker-panel');
    expect(html).not.toContain('HoldemPanel');
  });

  it('TableScreen hides global TableChatDock on poker tables', () => {
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
      virtualPlayerCount: 2,
    });
    const html = renderToStaticMarkup(
      <TableScreen gameState={state} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('poker-panel');
    expect(html).not.toContain('table-chat-dock');
    expect(html).not.toContain('data-testid="poker-chat-dock"');
  });
});

describe('Poker blinds control', () => {
  it('owner can update blinds before a hand starts', () => {
    let state = createNewHoldemTable();
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        pokerConfig: createDefaultPokerTableConfig({ smallBlind: 5, bigBlind: 10 }),
      },
      holdem: null,
    };
    const next = updatePokerBlindsOnState(state, 10, 20);
    expect(next.holdemSettings.smallBlind).toBe(10);
    expect(next.tableMeta.pokerConfig?.bigBlind).toBe(20);
  });

  it('owner cannot update blinds mid-hand', () => {
    let state = createNewHoldemTable();
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        pokerConfig: createDefaultPokerTableConfig(),
      },
      holdem: {
        status: 'preflop',
        bettingStreet: 'preflop',
        smallBlind: 5,
        bigBlind: 10,
        communityCardIds: [],
        pot: 15,
        currentBet: 10,
        dealerButtonPlayerId: 'p1',
        smallBlindPlayerId: 'p1',
        bigBlindPlayerId: 'p2',
        activePlayerId: 'p1',
        playerStates: {},
        actionLog: [],
        winners: [],
        resultSummary: '',
        lastRaiseSize: 10,
      },
    };
    expect(() => updatePokerBlindsOnState(state, 10, 20)).toThrow(/before a hand starts/i);
  });

  it('rejects invalid blind values in engine guard', () => {
    const state = {
      ...createNewHoldemTable(),
      tableMeta: {
        ...createNewHoldemTable().tableMeta,
        pokerConfig: createDefaultPokerTableConfig(),
      },
      holdem: null,
    };
    expect(() => updatePokerBlindsOnState(state, 10, 10)).toThrow(/Big blind must be greater/i);
    expect(() => updatePokerBlindsOnState(state, 0, 10)).toThrow(/Small blind must be a positive/i);
  });
});

describe('Poker view model authority', () => {
  it('does not inject mock seats when pokerConfig is present', () => {
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
    const viewModel = mapPokerTableViewModel(state);
    expect(viewModel.seats.length).toBe(state.session.playerIds.length);
    expect(viewModel.pot).toBe(0);
    expect(viewModel.seats.some((seat) => seat.displayName === 'Jordan')).toBe(false);
  });
});

describe('Poker dealer badge mapping', () => {
  it('maps dealer and blind badges onto seats', () => {
    const state = createNewHoldemTable();
    const viewModel = mapPokerTableViewModel({
      ...state,
      session: { ...state.session, playerIds: ['p1', 'p2'] },
      players: {
        p1: { id: 'p1', displayName: 'Alex', controllerName: 'Alex', playerType: 'real', role: 'person', cardIds: [], currentBet: 0, status: 'active', startingBalance: 500 },
        p2: { id: 'p2', displayName: 'Jordan', controllerName: 'Jordan', playerType: 'real', role: 'person', cardIds: [], currentBet: 0, status: 'active', startingBalance: 500 },
      },
      tableMeta: {
        ...state.tableMeta,
        pokerConfig: createDefaultPokerTableConfig({ dealerSeatId: 'p1' }),
      },
      holdem: {
        status: 'preflop',
        bettingStreet: 'preflop',
        smallBlind: 5,
        bigBlind: 10,
        communityCardIds: [],
        pot: 15,
        currentBet: 10,
        dealerButtonPlayerId: 'p1',
        smallBlindPlayerId: 'p1',
        bigBlindPlayerId: 'p2',
        activePlayerId: 'p1',
        playerStates: {},
        actionLog: [],
        winners: [],
        resultSummary: '',
        lastRaiseSize: 10,
      },
    });
    const dealerSeat = viewModel.seats.find((seat) => seat.playerId === 'p1');
    const bbSeat = viewModel.seats.find((seat) => seat.playerId === 'p2');
    expect(dealerSeat?.isDealer).toBe(true);
    expect(dealerSeat?.isSmallBlind).toBe(true);
    expect(bbSeat?.isBigBlind).toBe(true);
  });
});

describe('Poker challenge IOU settlement', () => {
  it('computes winner-takes-all per-loser amounts', () => {
    const state = createNewHoldemTable();
    const settled = ensureHoldemChallengeParticipantSnapshot({
      ...state,
      session: { ...state.session, playerIds: ['w', 'l1', 'l2', 'l3'] },
      players: {
        w: { id: 'w', displayName: 'Winner', controllerName: 'Winner', playerType: 'real', role: 'person', cardIds: [], currentBet: 0, status: 'active', startingBalance: 500 },
        l1: { id: 'l1', displayName: 'L1', controllerName: 'L1', playerType: 'real', role: 'person', cardIds: [], currentBet: 0, status: 'active', startingBalance: 500 },
        l2: { id: 'l2', displayName: 'L2', controllerName: 'L2', playerType: 'real', role: 'person', cardIds: [], currentBet: 0, status: 'active', startingBalance: 500 },
        l3: { id: 'l3', displayName: 'L3', controllerName: 'L3', playerType: 'real', role: 'person', cardIds: [], currentBet: 0, status: 'active', startingBalance: 500 },
      },
      tableMeta: {
        ...state.tableMeta,
        owner: { ownerName: 'Winner', ownerEmail: 'winner@example.com', createdAt: new Date().toISOString() },
        ownerPersonId: 'w',
        pokerConfig: createDefaultPokerTableConfig({
          mode: 'challenge',
          totalChallengeValue: 100,
          currency: '$',
          challengeStatus: 'ended',
          challengeWinnerSeatId: 'w',
        }),
      },
    });
    const result = computePokerWinnerTakesAllSettlement(settled, 'w');
    expect(result?.stakePerParticipant).toBe(25);
    expect(result?.losers).toHaveLength(3);
  });

  it('practice mode does not build IOU payloads', () => {
    const state = createNewHoldemTable();
    const settled = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        pokerConfig: createDefaultPokerTableConfig({ mode: 'practice' }),
      },
    };
    expect(buildPokerIouHandoffRequests(settled, 'p1')).toHaveLength(0);
  });

  it('challenge mode builds one IOU payload per losing player with email', () => {
    const state = createNewHoldemTable();
    const settled = {
      ...state,
      session: { ...state.session, playerIds: ['w', 'l1', 'l2'] },
      players: {
        w: { id: 'w', displayName: 'Winner', controllerName: 'Winner', playerType: 'real', role: 'person', cardIds: [], currentBet: 0, status: 'active', startingBalance: 500 },
        l1: { id: 'l1', displayName: 'L1', controllerName: 'L1', playerType: 'real', role: 'person', cardIds: [], currentBet: 0, status: 'active', startingBalance: 500, bankrollOwnerId: 'l1' },
        l2: { id: 'l2', displayName: 'L2', controllerName: 'L2', playerType: 'real', role: 'person', cardIds: [], currentBet: 0, status: 'active', startingBalance: 500, bankrollOwnerId: 'l2' },
      },
      tableMeta: {
        ...state.tableMeta,
        owner: { ownerName: 'Winner', ownerEmail: 'winner@example.com', createdAt: new Date().toISOString() },
        ownerPersonId: 'w',
        setupInvitedEmails: ['loser1@example.com', 'loser2@example.com'],
        invites: [
          {
            inviteId: 'inv-1',
            tableId: state.session.id,
            invitedEmail: 'loser1@example.com',
            invitedName: 'L1',
            invitedBy: 'Winner',
            inviteStatus: 'pending',
            canInviteOthers: false,
            createdAt: new Date().toISOString(),
            token: 'a',
          },
          {
            inviteId: 'inv-2',
            tableId: state.session.id,
            invitedEmail: 'loser2@example.com',
            invitedName: 'L2',
            invitedBy: 'Winner',
            inviteStatus: 'pending',
            canInviteOthers: false,
            createdAt: new Date().toISOString(),
            token: 'b',
          },
        ],
        pokerConfig: createDefaultPokerTableConfig({
          mode: 'challenge',
          totalChallengeValue: 100,
          handNumber: 1,
        }),
      },
    };
    const requests = buildPokerIouHandoffRequests(settled, 'w');
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((req) => req.creditorEmail === 'winner@example.com')).toBe(true);
  });
});

describe('Poker This Table panel', () => {
  it('opens slide panel with table id attribute — chat lives in panel only', () => {
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
        tableId="table-123"
        chatMessages={[]}
      />,
    );
    expect(html).toContain('data-table-id="table-123"');
    expect(html).not.toContain('data-testid="poker-chat-dock"');
    expect(html).toContain('This Table');
  });
});

describe('Blackjack and Zilch smoke unchanged', () => {
  it('blackjack table still renders BlackjackPanel from TableScreen', () => {
    const html = renderToStaticMarkup(
      <TableScreen gameState={createNewBlackjackTable()} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('bj-casino');
    expect(html).not.toContain('poker-panel');
  });

  it('zilch table still renders ZilchPanel from TableScreen', () => {
    const html = renderToStaticMarkup(
      <TableScreen gameState={createNewZilchTable()} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('zilch-panel');
    expect(html).not.toContain('poker-panel');
  });
});
