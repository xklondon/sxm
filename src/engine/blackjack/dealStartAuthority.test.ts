import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState } from '../../types';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { assignBankPerson, claimBoxSlot } from '../session/boxOps';
import {
  canCurrentUserDealTable,
  canStartBlackjackDeal,
  DEAL_CARDS_HOST_ONLY_MESSAGE,
} from '../session/tableDealPermission';
import { getCallerPersonIdForBox, syncPlayerOrderAndAssignments } from '../session/playerAssignment';
import { addChipToBoxStake } from './stakes';
import { canStartCards, getEligibleDealBoxes } from './protocol';
import { getActionableHandForView } from '../../components/blackjackViewPhase';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
} from './sanity/fixtures';
import { shuffleToStartOnState, dealCardsButtonOnState } from './gameState';
import { applyBlackjackActionToState } from './applyBlackjackAction';
import { getDealBlockReason } from './dealEligibility';

const DEAL_ELIGIBILITY_SRC = readFileSync(
  join(process.cwd(), 'src/engine/blackjack/dealEligibility.ts'),
  'utf8',
);

function twoPlayerSeated() {
  let state = tableAfterStartPlaying(500);
  const p1 = state.tableMeta.ownerPersonId!;
  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'P2',
    controllerName: 'P2',
    role: 'person',
    startingChips: 500,
  });
  state = mergeSessionUpdate(state, guestSpl);
  const p2 = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
  state = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: p2,
    amount: 500,
    reason: 'initial-player',
    source: 'setup',
  });
  state = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      playerOrder: [p1, p2],
    },
  };
  state = syncPlayerOrderAndAssignments(state);
  return { state, p1, p2 };
}

function readyToDeal(state: GameState): GameState {
  return shuffleToStartOnState(state);
}

describe('deal start authority', () => {
  it('host with no box bet can deal when guest bets host native box', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, p2);
    ready = readyToDeal(ready);
    expect(getCallerPersonIdForBox(ready, box1)).toBe(p2);
    expect(getEligibleDealBoxes(ready)).toContain(box1);
    expect(canStartCards(ready)).toBe(true);
    expect(canStartBlackjackDeal(ready, p1)).toBe(true);
    expect(canStartBlackjackDeal(ready, p2)).toBe(false);
  });

  it('host can deal with own free-box bet while guest bets other boxes', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    const box3 = boxPlayerId(state, 3)!;
    state = addChipToBoxStake(state, box3, 50, p1);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box2, 50, p2);
    state = readyToDeal(state);
    expect(canStartBlackjackDeal(state, p1)).toBe(true);
    expect(getEligibleDealBoxes(state).sort()).toEqual([box1, box2, box3].sort());
  });

  it('non-host with active bet cannot start deal', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box2 = boxPlayerId(state, 2)!;
    let ready = addChipToBoxStake(state, box2, 50, p2);
    ready = readyToDeal(ready);
    expect(canStartBlackjackDeal(ready, p2)).toBe(false);
    expect(() =>
      applyBlackjackActionToState(ready, 'dealCards', {
        personId: p2,
        payload: {},
        resolveBankAuto: true,
      }),
    ).toThrow(DEAL_CARDS_HOST_ONLY_MESSAGE);
  });

  it('temporary box commander who is not table host cannot start deal', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, p2);
    ready = readyToDeal(ready);
    expect(getCallerPersonIdForBox(ready, box1)).toBe(p2);
    expect(canStartBlackjackDeal(ready, p2)).toBe(false);
    expect(canStartBlackjackDeal(ready, p1)).toBe(true);
  });

  it('eligible deal boxes do not consult getCallerPersonIdForBox', () => {
    expect(DEAL_ELIGIBILITY_SRC).not.toMatch(/getEligibleDealBoxes[\s\S]*getCallerPersonIdForBox/);
    const { state, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, p2);
    ready = {
      ...ready,
      tableMeta: {
        ...ready.tableMeta,
        boxStakes: {
          ...ready.tableMeta.boxStakes,
          [box1]: {
            ...ready.tableMeta.boxStakes[box1]!,
            confirmed: true,
            callerPersonId: null,
          },
        },
        boxSlots: ready.tableMeta.boxSlots.map((slot) =>
          slot.playerId === box1 ? { ...slot, callerPersonId: null } : slot,
        ),
      },
    };
    expect(getCallerPersonIdForBox(ready, box1)).toBe(p2);
    expect(getEligibleDealBoxes(ready)).toContain(box1);
  });

  it('after dealing starts, player-turn authority still uses box caller rules', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box2 = boxPlayerId(state, 2)!;
    let ready = addChipToBoxStake(state, box2, 50, p2);
    ready = readyToDeal(ready);
    const dealt = dealCardsButtonOnState(ready);
    const playing = {
      ...dealt,
      tableMeta: { ...dealt.tableMeta, bettingLocked: true },
      blackjack: actingRound(
        dealt,
        box2,
        [findCardId(dealt.deck!, '6'), findCardId(dealt.deck!, '7')],
        50,
      ),
    };
    expect(getActionableHandForView(playing, p2, true)).not.toBeNull();
    expect(getActionableHandForView(playing, p1, true)).toBeNull();
  });

  it('host-as-bank can deal without placing a personal box bet', () => {
    let state = tableAfterStartPlaying(500);
    const hostId = state.tableMeta.ownerPersonId!;
    state = assignBankPerson(state, 'Alice', 500);
    const { state: seated, p2 } = (() => {
      const guestSpl = addPlayer(state.session, state.players, state.ledger, {
        displayName: 'P2',
        controllerName: 'P2',
        role: 'person',
        startingChips: 500,
      });
      let next = mergeSessionUpdate(state, guestSpl);
      const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
      next = allocateChipsToBankrollOwner(next, {
        bankrollOwnerId: guestId,
        amount: 500,
        reason: 'initial-player',
        source: 'setup',
      });
      next = {
        ...next,
        tableMeta: {
          ...next.tableMeta,
          playerOrder: [hostId, guestId],
        },
      };
      next = syncPlayerOrderAndAssignments(next);
      return { state: next, p2: guestId };
    })();
    const box1 = boxPlayerId(seated, 1)!;
    let ready = addChipToBoxStake(seated, box1, 50, p2);
    ready = readyToDeal(ready);
    expect(canCurrentUserDealTable(ready, hostId)).toBe(true);
    expect(canStartBlackjackDeal(ready, hostId)).toBe(true);
    expect(getDealBlockReason(ready)).toBeNull();
  });
});
