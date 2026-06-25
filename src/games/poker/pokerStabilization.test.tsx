import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyHoldemTableStakeSetup,
  createNewHoldemTable,
} from '../../engine/session';
import { applyHoldemChallengeEndToState } from '../../engine/holdem/challengeWinner';
import { ensureHoldemChallengeParticipantSnapshot } from '../../engine/holdem/challengeParticipants';
import { validatePokerBlinds } from '../../types/poker';
import { TableScreen } from '../../screens/TableScreen';
import { mapPokerTableViewModel } from './state/mapPokerTableViewModel';
import { validatePokerChallengeSettlement } from './state/pokerChallengeSettlement';
import { PokerTableShell } from './components/PokerTableShell';

function personPlayer(id: string, name: string) {
  return {
    id,
    displayName: name,
    controllerName: name,
    playerType: 'real' as const,
    role: 'person' as const,
    cardIds: [],
    currentBet: 0,
    status: 'active' as const,
    startingBalance: 500,
  };
}

describe('Poker final stabilization', () => {
  it('validatePokerBlinds rejects big blind <= small blind', () => {
    expect(validatePokerBlinds(10, 10)).toMatch(/greater/i);
    expect(validatePokerBlinds(10, 5)).toMatch(/greater/i);
  });

  it('2-player challenge setup to authoritative winner uses participant roster', () => {
    let state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
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
    state = ensureHoldemChallengeParticipantSnapshot({
      ...state,
      session: { ...state.session, playerIds: [hostId, 'guest'] },
      players: {
        ...state.players,
        guest: personPlayer('guest', 'Guest'),
      },
      tableMeta: {
        ...state.tableMeta,
        owner: {
          ownerName: 'Host',
          ownerEmail: 'host@example.com',
          createdAt: new Date().toISOString(),
        },
        setupInvitedEmails: ['guest@example.com'],
        invites: [
          {
            inviteId: 'inv-1',
            tableId: state.session.id,
            invitedEmail: 'guest@example.com',
            invitedName: 'Guest',
            invitedBy: 'Host',
            inviteStatus: 'pending',
            canInviteOthers: false,
            createdAt: new Date().toISOString(),
            token: 'guest',
          },
        ],
      },
    });
    state = applyHoldemChallengeEndToState(state, {
      winnerSeatId: hostId,
      reason: 'chip-leader',
    });

    const validation = validatePokerChallengeSettlement(state, hostId);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.settlement.participantCount).toBe(2);
      expect(validation.settlement.stakePerParticipant).toBe(25);
      expect(validation.settlement.losers).toHaveLength(1);
    }
  });

  it('4-player roster excludes bank and box session ids', () => {
    const base = createNewHoldemTable();
    const state = ensureHoldemChallengeParticipantSnapshot({
      ...base,
      session: { ...base.session, playerIds: ['w', 'l1', 'l2', 'l3', 'bank', 'box1'] },
      players: {
        w: personPlayer('w', 'Winner'),
        l1: personPlayer('l1', 'L1'),
        l2: personPlayer('l2', 'L2'),
        l3: personPlayer('l3', 'L3'),
        bank: {
          id: 'bank',
          displayName: 'Bank',
          controllerName: 'Bank',
          playerType: 'virtual',
          role: 'bank',
          cardIds: [],
          currentBet: 0,
          status: 'active',
          startingBalance: 500,
        },
        box1: { ...personPlayer('box1', 'Box'), role: 'box' },
      },
      tableMeta: {
        ...base.tableMeta,
        pokerConfig: {
          ...base.tableMeta.pokerConfig!,
          mode: 'challenge',
          totalChallengeValue: 100,
        },
      },
    });

    const seats = state.tableMeta.pokerConfig?.challengeParticipantSeatIds ?? [];
    expect(seats).toEqual(['w', 'l1', 'l2', 'l3']);
    expect(seats).not.toContain('bank');
    expect(seats).not.toContain('box1');
  });

  it('TableScreen hides global chat on poker tables', () => {
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
      <TableScreen gameState={state} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(html).not.toContain('table-chat-dock');
    expect(html).toContain('poker-chat-dock');
  });

  it('seat ring renders for 6 and 9 players without throwing', () => {
    for (const count of [6, 9]) {
      const ids = Array.from({ length: count }, (_, i) => `p${i}`);
      const state = {
        ...createNewHoldemTable(),
        session: { ...createNewHoldemTable().session, playerIds: ids },
        players: Object.fromEntries(ids.map((id) => [id, personPlayer(id, id)])),
      };
      const vm = mapPokerTableViewModel(state, ids[0]!);
      expect(vm.seats).toHaveLength(count);
    }
  });

  it('table shell keeps action panel, chat dock, pot lines, and hero cards', () => {
    const ids = ['hero', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const state = {
      ...createNewHoldemTable(),
      session: { ...createNewHoldemTable().session, playerIds: ids, dealerButtonPlayerId: 'p2' },
      players: Object.fromEntries(ids.map((id) => [id, personPlayer(id, id)])),
      tableMeta: {
        ...createNewHoldemTable().tableMeta,
        pokerConfig: {
          ...createNewHoldemTable().tableMeta.pokerConfig!,
          mode: 'practice' as const,
          smallBlind: 5,
          bigBlind: 10,
        },
      },
      holdem: {
        status: 'flop' as const,
        bettingStreet: 'flop' as const,
        smallBlind: 5,
        bigBlind: 10,
        communityCardIds: [],
        pot: 120,
        currentBet: 20,
        dealerButtonPlayerId: 'p2',
        smallBlindPlayerId: 'p2',
        bigBlindPlayerId: 'p3',
        activePlayerId: 'hero',
        playerStates: {
          hero: {
            holeCardIds: ['c1', 'c2'],
            actionStatus: 'active',
            playerBetsThisStreet: 0,
            playerTotalCommitted: 40,
            hasActedThisStreet: false,
          },
        },
        sidePots: [
          { id: 'pot-1', amount: 80, eligibleSeatIds: ids, threshold: 20 },
          { id: 'pot-2', amount: 40, eligibleSeatIds: ['hero', 'p2'], threshold: 40 },
        ],
        actionLog: ['Hero calls'],
        winners: [],
        resultSummary: '',
        lastRaiseSize: 10,
        payoutSummary: ['Main pot: Hero +80', 'Side pot 1: Hero +40'],
      },
    };
    const vm = mapPokerTableViewModel(state, 'hero');
    const html = renderToStaticMarkup(
      <PokerTableShell
        viewModel={vm}
        tableId="layout-qa"
        chatMessages={[{ id: 'm1', author: 'Host', body: 'gl', timestamp: 0 }]}
        onAction={() => {}}
        onSendChat={() => {}}
      />,
    );

    expect(html).toContain('poker-table-layout__controls');
    expect(html).toContain('poker-actions');
    expect(html).toContain('poker-chat-dock');
    expect(html).toContain('poker-pot__payouts');
    expect(html).toContain('poker-pot__side-count');
    expect(html).toContain('poker-seat--viewer');
    expect(html).not.toMatch(/poker-chat-dock[^>]*poker-actions/);
  });
});
