import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveBoxRoundCommander } from './boxRoundCommander';
import {
  getCallerPersonIdForBox,
  getAssignedSlotForPerson,
  syncPlayerOrderAndAssignments,
} from './playerAssignment';
import {
  getBoxDecisionOwner,
  getViewerCanActOnActiveHand,
  resolveViewerActionPermission,
} from './boxDecisionOwnership';
import { getCoBoxSlotsForPerson, getRunningBoxSlotsForPerson } from './tableBoxDisplay';
import { buildBlackjackCommandText } from '../../components/tableCommandDisplay';
import { canPersonDecideInsuranceForBox } from '../blackjack/insurance';
import { addPlayer, mergeSessionUpdate } from './session';
import { allocateChipsToBankrollOwner } from './allocation';
import { claimBoxSlot } from './boxOps';
import { addChipToBoxStake } from '../blackjack/stakes';
import { startNextRoundOnState } from '../blackjack/gameState';
import { syncCallersForDeal } from './playerAssignment';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
} from '../blackjack/sanity/fixtures';

const AUTHORITY_SRC = readFileSync(join(process.cwd(), 'server/src/tables/authority.ts'), 'utf8');

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

function freeBox(state: ReturnType<typeof twoPlayerSeated>['state'], slotNumber: number) {
  let next = claimBoxSlot(state, slotNumber);
  const boxId = boxPlayerId(next, slotNumber)!;
  next = {
    ...next,
    tableMeta: {
      ...next.tableMeta,
      boxSlots: next.tableMeta.boxSlots.map((s) =>
        s.playerId === boxId ? { ...s, nativeAssignedPersonId: null, callerPersonId: null } : s,
      ),
    },
  };
  return { state: next, boxId };
}

function playerTurnState(base: ReturnType<typeof twoPlayerSeated>['state'], boxId: string) {
  const round = actingRound(base, boxId, [findCardId(base.deck!, '6'), findCardId(base.deck!, '7')], 10);
  return {
    ...base,
    tableMeta: { ...base.tableMeta, bettingLocked: true },
    blackjack: round,
  };
}

function insuranceAceState(base: ReturnType<typeof twoPlayerSeated>['state'], boxId: string) {
  const deck = base.deck!;
  const round = actingRound(base, boxId, [findCardId(deck, '6'), findCardId(deck, '7')], 10);
  return {
    ...base,
    tableMeta: { ...base.tableMeta, bettingLocked: true },
    blackjack: {
      ...round,
      insuranceOfferPending: true,
      dealerCardIds: [findCardId(deck, 'A'), findCardId(deck, '7')],
      dealerHoleHidden: true,
    },
  };
}

describe('resolveBoxRoundCommander', () => {
  it('designated owner does not stake — first staker commands designated box', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const staked = addChipToBoxStake(state, box1, 10, p2);
    const result = resolveBoxRoundCommander(staked, box1);
    expect(result).toEqual({
      commanderPersonId: p2,
      reason: 'first-staker-on-designated-box',
      coBettorPersonIds: [],
    });
    expect(getCallerPersonIdForBox(staked, box1)).toBe(p2);
    expect(getCallerPersonIdForBox(staked, box1)).not.toBe(p1);
    expect(getAssignedSlotForPerson(staked, p1)).toBe(1);
  });

  it('designated owner stakes after other player — owner commands, other is co-bettor', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let next = addChipToBoxStake(state, box1, 10, p2);
    next = addChipToBoxStake(next, box1, 5, p1);
    const result = resolveBoxRoundCommander(next, box1);
    expect(result.commanderPersonId).toBe(p1);
    expect(result.reason).toBe('designated-owner-staked');
    expect(result.coBettorPersonIds).toEqual([p2]);
  });

  it('free box — first staker commands, later staker is co-bettor', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const { state: withBox, boxId } = freeBox(state, 3);
    let next = addChipToBoxStake(withBox, boxId, 10, p2);
    next = addChipToBoxStake(next, boxId, 5, p1);
    const result = resolveBoxRoundCommander(next, boxId);
    expect(result.commanderPersonId).toBe(p2);
    expect(result.reason).toBe('first-staker-on-free-box');
    expect(result.coBettorPersonIds).toEqual([p1]);
  });

  it('clears temporary commander on next round; designated assignment persists', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const { state: withBox, boxId } = freeBox(state, 3);
    let next = addChipToBoxStake(withBox, boxId, 10, p1);
    next = {
      ...next,
      tableMeta: { ...next.tableMeta, awaitingNextRound: true },
      blackjack: { ...next.blackjack!, isSettled: true, status: 'resolved' },
    };
    const afterRound = startNextRoundOnState(next);
    expect(resolveBoxRoundCommander(afterRound, boxId).commanderPersonId).toBeNull();
    expect(getAssignedSlotForPerson(afterRound, p1)).toBe(1);

    const rebound = addChipToBoxStake(afterRound, boxId, 10, p2);
    expect(resolveBoxRoundCommander(rebound, boxId).commanderPersonId).toBe(p2);
    expect(resolveBoxRoundCommander(rebound, boxId).reason).toBe('first-staker-on-free-box');
  });

  it('no stake and no in-round hand — no commander', () => {
    const { state, p1 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    expect(resolveBoxRoundCommander(state, box1).commanderPersonId).toBeNull();
    expect(getBoxDecisionOwner(state, box1)).toBeNull();
    void p1;
  });
});

describe('box round commander — play authority', () => {
  it('first staker on designated box can act; designated owner without stake cannot', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const playing = playerTurnState(addChipToBoxStake(state, box1, 10, p2), box1);
    playing.tableMeta.boxSlots = syncCallersForDeal(playing, [box1]).tableMeta.boxSlots;

    expect(getViewerCanActOnActiveHand(playing, p2)).not.toBeNull();
    expect(getViewerCanActOnActiveHand(playing, p1)).toBeNull();
    expect(resolveViewerActionPermission(playing, p1).canAct).toBe(false);
    expect(resolveViewerActionPermission(playing, p2).canAct).toBe(true);
  });

  it('designated owner staking wins command for hit/stand', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let next = addChipToBoxStake(state, box1, 10, p2);
    next = addChipToBoxStake(next, box1, 5, p1);
    const playing = playerTurnState(next, box1);
    playing.tableMeta.boxSlots = syncCallersForDeal(playing, [box1]).tableMeta.boxSlots;

    expect(getViewerCanActOnActiveHand(playing, p1)).not.toBeNull();
    expect(getViewerCanActOnActiveHand(playing, p2)).toBeNull();
  });

  it('command text names round commander', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const playing = playerTurnState(addChipToBoxStake(state, box1, 10, p2), box1);
    playing.tableMeta.boxSlots = syncCallersForDeal(playing, [box1]).tableMeta.boxSlots;

    const guestView = buildBlackjackCommandText({
      gameState: playing,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'P2',
      viewerPersonId: p2,
    });
    expect(guestView.commandMessage).toMatch(/Box 1 — P2 — your turn/i);

    const ownerView = buildBlackjackCommandText({
      gameState: playing,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'P1',
      viewerPersonId: p1,
    });
    expect(ownerView.commandMessage).toMatch(/waiting for P2/i);
  });
});

describe('box round commander — insurance', () => {
  it('insurance authority follows round commander when designated owner did not stake', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let next = addChipToBoxStake(state, box1, 10, p2);
    next = syncCallersForDeal(next, [box1]);
    const ins = insuranceAceState(next, box1);

    expect(canPersonDecideInsuranceForBox(ins, box1, p2)).toBe(true);
    expect(canPersonDecideInsuranceForBox(ins, box1, p1)).toBe(false);
  });
});

describe('box round commander — This Table display', () => {
  it('running vs co-boxes reflect commander not native assignment alone', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const staked = addChipToBoxStake(state, box1, 10, p2);

    expect(getRunningBoxSlotsForPerson(staked, p2)).toEqual([1]);
    expect(getCoBoxSlotsForPerson(staked, p1)).toEqual([]);
    expect(getCoBoxSlotsForPerson(staked, p2)).toEqual([]);

    let both = addChipToBoxStake(staked, box1, 5, p1);
    expect(getRunningBoxSlotsForPerson(both, p1)).toEqual([]);
    expect(getCoBoxSlotsForPerson(both, p2)).toEqual([1]);
  });
});

describe('box round commander — online authority wiring', () => {
  it('server action authority uses getCallerPersonIdForBox', () => {
    expect(AUTHORITY_SRC).toContain('getCallerPersonIdForBox');
  });
});
