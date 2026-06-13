import { describe, expect, it } from 'vitest';
import {
  getInsuranceActionsForController,
  getMyPendingInsurancePlayerIds,
} from '../../components/blackjackViewPhase';
import {
  declineInsuranceForPersonOnState,
  takeInsuranceForPersonOnState,
} from './gameState';
import { getBlackjackProtocolPhase } from './protocol';
import { addChipToBoxStake, confirmBoxStake } from './stakes';
import { insuranceWinPayout } from './rules';
import {
  getInsuranceDecisionPersonIdForBox,
  getPendingInsuranceBoxIdsForPerson,
} from './insurance';
import {
  tableWithClaimedBox,
  boxPlayerId,
  findCardId,
} from './sanity/fixtures';
import { addSeatAtTable } from '../session/table';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { syncCallersForDeal } from '../session/playerAssignment';
import { claimBoxSlot } from '../session/boxOps';
import { createBlackjackPlayerHand, createEmptyBlackjackRound } from '../../types/blackjack';
import { blackjackHandKey } from './handKeys';

function insuranceRoundForBoxes(
  state: ReturnType<typeof tableWithClaimedBox>,
  boxes: { boxId: string; bet: number }[],
) {
  const aceId = findCardId(state.deck!, 'A');
  const playerHands: Record<string, ReturnType<typeof createBlackjackPlayerHand>> = {};
  for (const { boxId, bet } of boxes) {
    playerHands[blackjackHandKey(boxId, 0)] = {
      ...createBlackjackPlayerHand(boxId, 0),
      cardIds: [findCardId(state.deck!, '9'), findCardId(state.deck!, '8')],
      currentBet: bet,
      actionStatus: 'acting',
    };
  }
  return {
    ...createEmptyBlackjackRound(),
    status: 'player-turns' as const,
    insuranceOfferPending: true,
    dealerCardIds: [aceId, findCardId(state.deck!, '10')],
    dealerHoleHidden: true,
    activeHandKey: null,
    insuranceBets: {},
    insuranceDeclined: {},
    playerHands,
  };
}

describe('insurance targeting', () => {
  it('round waits until every required player decides', () => {
    let state = tableWithClaimedBox(1);
    state = claimBoxSlot(state, 2);
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    const aliceId = state.tableMeta.ownerPersonId!;
    state = addChipToBoxStake(state, box1, 50, aliceId);
    state = confirmBoxStake(state, box1);

    state = addSeatAtTable(state, {
      displayName: 'Bob',
      controllerName: 'Bob',
      role: 'person',
      startingChips: 500,
    });
    const bobId = state.session.playerIds[state.session.playerIds.length - 1]!;
    state = allocateChipsToBankrollOwner(state, {
      bankrollOwnerId: bobId,
      amount: 500,
      reason: 'initial-player',
      source: 'setup',
    });
    state = addChipToBoxStake(state, box2, 20, bobId);
    state = confirmBoxStake(state, box2);
    state = syncCallersForDeal(state, [box1, box2]);
    state = {
      ...state,
      blackjack: insuranceRoundForBoxes(state, [
        { boxId: box1, bet: 50 },
        { boxId: box2, bet: 20 },
      ]),
    };

    state = takeInsuranceForPersonOnState(state, aliceId);
    expect(state.blackjack?.insuranceOfferPending).toBe(true);
    expect(getPendingInsuranceBoxIdsForPerson(state, state.blackjack!, bobId)).toEqual([box2]);

    state = declineInsuranceForPersonOnState(state, bobId);
    expect(state.blackjack?.insuranceOfferPending).toBe(false);
    expect(getBlackjackProtocolPhase(state)).not.toBe('insurance');
  });

  it('spectator and non-bettors do not receive insurance prompts', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const bettorId = state.tableMeta.ownerPersonId!;
    state = addChipToBoxStake(state, boxId, 50, bettorId);
    state = confirmBoxStake(state, boxId);
    state = addSeatAtTable(state, {
      displayName: 'Spectator',
      controllerName: 'Spectator',
      role: 'person',
      startingChips: 0,
    });
    const spectatorId = state.session.playerIds[state.session.playerIds.length - 1]!;
    state = syncCallersForDeal(state, [boxId]);
    state = {
      ...state,
      blackjack: {
        ...createEmptyBlackjackRound(),
        status: 'player-turns',
        insuranceOfferPending: true,
        dealerCardIds: [findCardId(state.deck!, 'A'), findCardId(state.deck!, '10')],
        dealerHoleHidden: true,
        activeHandKey: null,
        insuranceBets: {},
        insuranceDeclined: {},
        playerHands: {
          [blackjackHandKey(boxId, 0)]: {
            ...createBlackjackPlayerHand(boxId, 0),
            cardIds: [findCardId(state.deck!, '10'), findCardId(state.deck!, '9')],
            currentBet: 50,
            actionStatus: 'acting',
          },
        },
      },
    };
    const round = state.blackjack!;

    expect(getInsuranceActionsForController(state, round, bettorId)).toHaveLength(1);
    expect(getInsuranceActionsForController(state, round, spectatorId)).toEqual([]);
    expect(getMyPendingInsurancePlayerIds(state, round, spectatorId)).toEqual([]);
  });

  it('sole staker on a shared box owns the insurance decision', () => {
    let state = tableWithClaimedBox(1);
    const hostId = state.tableMeta.ownerPersonId!;
    state = addSeatAtTable(state, {
      displayName: 'Guest',
      controllerName: 'Guest',
      role: 'person',
      startingChips: 500,
    });
    const guestId = state.session.playerIds[state.session.playerIds.length - 1]!;
    state = allocateChipsToBankrollOwner(state, {
      bankrollOwnerId: guestId,
      amount: 500,
      reason: 'initial-player',
      source: 'setup',
    });
    const boxId = boxPlayerId(state, 1)!;
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxSlots: state.tableMeta.boxSlots.map((slot) =>
          slot.playerId === boxId ? { ...slot, nativeAssignedPersonId: null } : slot,
        ),
      },
    };
    state = addChipToBoxStake(state, boxId, 20, guestId);
    state = addChipToBoxStake(state, boxId, 20, guestId);
    state = confirmBoxStake(state, boxId);
    state = syncCallersForDeal(state, [boxId]);

    expect(getInsuranceDecisionPersonIdForBox(state, boxId)).toBe(guestId);

    state = {
      ...state,
      blackjack: {
        ...createEmptyBlackjackRound(),
        status: 'player-turns',
        insuranceOfferPending: true,
        dealerCardIds: [findCardId(state.deck!, 'A'), findCardId(state.deck!, '10')],
        dealerHoleHidden: true,
        activeHandKey: null,
        insuranceBets: {},
        insuranceDeclined: {},
        playerHands: {
          [blackjackHandKey(boxId, 0)]: {
            ...createBlackjackPlayerHand(boxId, 0),
            cardIds: [findCardId(state.deck!, '10'), findCardId(state.deck!, '9')],
            currentBet: 40,
            actionStatus: 'acting',
          },
        },
      },
    };

    expect(getInsuranceActionsForController(state, state.blackjack!, guestId)).toHaveLength(1);
    expect(getInsuranceActionsForController(state, state.blackjack!, hostId)).toEqual([]);
  });

  it('insurance payout remains 2:1', () => {
    expect(insuranceWinPayout(25)).toBe(75);
    expect(insuranceWinPayout(10)).toBe(30);
  });
});
