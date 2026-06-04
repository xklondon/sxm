import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import type { BlackjackRound } from '../../types/blackjack';
import { createBlackjackPlayerHand, createEmptyBlackjackRound } from '../../types/blackjack';
import {
  takeInsuranceOnState,
  declineInsuranceOnState,
  applyInsuranceAdvanceOnState,
} from './gameState';
import { getBlackjackProtocolPhase } from './protocol';
import { addChipToBoxStake, confirmBoxStake } from './stakes';
import { blackjackHandKey } from './handKeys';
import {
  getInsuranceActionsForController,
  getPendingInsurancePlayerIds,
} from '../../components/blackjackViewPhase';
import { getInsuranceEligibleBoxIds } from './protocols/activeRules';
import {
  allInsuranceDecisionsResolved,
  isInsuranceBoxDecisionResolved,
} from './insurance';
import { LAS_VEGAS_PROTOCOL } from './protocols';
import {
  tableWithClaimedBox,
  tableWithTwoBoxesSamePerson,
  boxPlayerId,
  findCardId,
} from './sanity/fixtures';
import { claimBoxSlot, setControllerName } from '../session/boxOps';
import { addSeatAtTable } from '../session/table';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { syncCallersForDeal } from '../session/playerAssignment';

function insuranceRoundTwoBoxes(
  state: GameState,
  box1: string,
  box2: string,
  bets: [number, number],
): BlackjackRound {
  const aceId = findCardId(state.deck!, 'A');
  return {
    ...createEmptyBlackjackRound(),
    status: 'player-turns',
    insuranceOfferPending: true,
    dealerCardIds: [aceId, findCardId(state.deck!, '10')],
    dealerHoleHidden: true,
    activeHandKey: null,
    activePlayerId: null,
    insuranceBets: {},
    insuranceDeclined: {},
    playerHands: {
      [blackjackHandKey(box1, 0)]: {
        ...createBlackjackPlayerHand(box1, 0),
        cardIds: [findCardId(state.deck!, '9'), findCardId(state.deck!, '8')],
        currentBet: bets[0],
        actionStatus: 'acting',
      },
      [blackjackHandKey(box2, 0)]: {
        ...createBlackjackPlayerHand(box2, 0),
        cardIds: [findCardId(state.deck!, '7'), findCardId(state.deck!, '6')],
        currentBet: bets[1],
        actionStatus: 'acting',
      },
    },
  };
}

function readyTwoBoxInsurance(ownerName = 'Alice'): GameState {
  let state = tableWithTwoBoxesSamePerson();
  state = setControllerName(state, ownerName);
  const box1 = boxPlayerId(state, 1)!;
  const box2 = boxPlayerId(state, 2)!;
  const personId = state.tableMeta.ownerPersonId!;
  state = addChipToBoxStake(state, box1, 50, personId);
  state = addChipToBoxStake(state, box2, 10, personId);
  state = confirmBoxStake(state, box1);
  state = confirmBoxStake(state, box2);
  state = syncCallersForDeal(state, [box1, box2]);
  const round = insuranceRoundTwoBoxes(state, box1, box2, [50, 10]);
  return { ...state, blackjack: round };
}

describe('multi-box insurance', () => {
  it('offers insurance for every eligible box', () => {
    const state = readyTwoBoxInsurance();
    const round = state.blackjack!;
    const eligible = getInsuranceEligibleBoxIds(state.session, round, LAS_VEGAS_PROTOCOL);
    expect(eligible).toHaveLength(2);
  });

  it('same player: accepting Box 1 leaves Box 2 pending until decided', () => {
    let state = readyTwoBoxInsurance();
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;

    expect(getPendingInsurancePlayerIds(state, state.blackjack!)).toEqual([box1, box2]);

    state = takeInsuranceOnState(state, box1);
    expect(state.blackjack?.insuranceOfferPending).toBe(true);
    expect(state.blackjack?.insuranceBets?.[box1]).toBe(25);
    expect(getPendingInsurancePlayerIds(state, state.blackjack!)).toEqual([box2]);

    state = declineInsuranceOnState(state, box2);
    expect(state.blackjack?.insuranceOfferPending).toBe(false);
    expect(getBlackjackProtocolPhase(state)).not.toBe('insurance');
  });

  it('auto-skips unfunded boxes so the phase does not stall', () => {
    let state = readyTwoBoxInsurance();
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    const personId = state.tableMeta.ownerPersonId!;
    state = {
      ...state,
      ledger: { ...state.ledger, entries: [] },
      blackjack: insuranceRoundTwoBoxes(state, box1, box2, [50, 10]),
    };
    void personId;
    expect(isInsuranceBoxDecisionResolved(state, state.blackjack!, LAS_VEGAS_PROTOCOL, box1)).toBe(
      true,
    );
    expect(isInsuranceBoxDecisionResolved(state, state.blackjack!, LAS_VEGAS_PROTOCOL, box2)).toBe(
      true,
    );
    expect(allInsuranceDecisionsResolved(state, state.blackjack!, LAS_VEGAS_PROTOCOL)).toBe(true);
    const advanced = applyInsuranceAdvanceOnState(state);
    expect(advanced.blackjack?.insuranceOfferPending).toBe(false);
  });

  it('controller sees actions only for boxes they call', () => {
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
    state = addChipToBoxStake(state, box2, 10, bobId);
    state = confirmBoxStake(state, box2);
    state = syncCallersForDeal(state, [box1, box2]);
    state = { ...state, blackjack: insuranceRoundTwoBoxes(state, box1, box2, [50, 10]) };
    const round = state.blackjack!;

    const aliceActions = getInsuranceActionsForController(state, round, aliceId);
    expect(aliceActions.map((a) => a.playerId)).toEqual([box1]);

    const bobActions = getInsuranceActionsForController(state, round, bobId);
    expect(bobActions.map((a) => a.playerId)).toEqual([box2]);
  });
});
