import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { assignBankPerson, claimBoxSlot } from '../session/boxOps';
import {
  getCallerPersonIdForBox,
  syncPlayerOrderAndAssignments,
} from '../session/playerAssignment';
import { resetBlackjackRoundOwnership } from '../session/resetBlackjackRoundOwnership';
import {
  canDealBlackjack,
  DEAL_CARDS_HOST_ONLY_MESSAGE,
  logDealAudit,
} from './canDealBlackjack';
import { resolvePlayableBoxes } from './playableBoxes';
import { addChipToBoxStake } from '../blackjack/stakes';
import { getEligibleDealBoxes } from '../blackjack/dealEligibility';
import { applyBlackjackActionToState } from '../blackjack/applyBlackjackAction';
import { shuffleToStartOnState } from '../blackjack/gameState';
import { boxPlayerId, tableAfterStartPlaying } from '../blackjack/sanity/fixtures';

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

function ctx(state: GameState, personId: string) {
  return { personId, payload: {}, resolveBankAuto: true };
}

describe('resolvePlayableBoxes', () => {
  it('designated box: owner staked commands; co-bettors passive', () => {
    const { state, p1 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const ready = addChipToBoxStake(state, box1, 50, p1);
    const [box] = resolvePlayableBoxes(ready);
    expect(box?.boxId).toBe(box1);
    expect(box?.designatedOwner).toBe(p1);
    expect(box?.activePlayer).toBe(p1);
    expect(box?.passivePlayers).toEqual([]);
  });

  it('designated box: first staker commands when owner did not stake', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const ready = addChipToBoxStake(state, box1, 50, p2);
    const [box] = resolvePlayableBoxes(ready);
    expect(box?.designatedOwner).toBe(p1);
    expect(box?.activePlayer).toBe(p2);
    expect(box?.passivePlayers).toEqual([]);
  });

  it('free box: first staker commands when slot has no native owner', () => {
    let { state, p1 } = twoPlayerSeated();
    const box3PlayerId = 'box3-test-player';
    state = {
      ...state,
      players: {
        ...state.players,
        [box3PlayerId]: {
          id: box3PlayerId,
          displayName: 'Box 3',
          controllerName: 'Box 3',
          role: 'box',
          chips: 0,
        },
      },
      session: {
        ...state.session,
        playerIds: [...state.session.playerIds, box3PlayerId],
        boxSlotNumbers: { ...state.session.boxSlotNumbers, [box3PlayerId]: 3 },
      },
      tableMeta: {
        ...state.tableMeta,
        boxSlots: [
          ...state.tableMeta.boxSlots,
          { playerId: box3PlayerId, nativeAssignedPersonId: null, callerPersonId: null },
        ],
      },
    };
    const ready = addChipToBoxStake(state, box3PlayerId, 50, p1);
    const box = resolvePlayableBoxes(ready).find((b) => b.boxId === box3PlayerId);
    expect(box?.designatedOwner).toBeNull();
    expect(box?.activePlayer).toBe(p1);
  });

  it('restores designated ownership after round reset', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box1 = boxPlayerId(state, 1)!;
    const box3 = boxPlayerId(state, 3)!;
    state = addChipToBoxStake(state, box3, 50, p1);
    state = addChipToBoxStake(state, box1, 50, p2);
    expect(getCallerPersonIdForBox(state, box1)).toBe(p2);

    const reset = resetBlackjackRoundOwnership({
      ...state,
      tableMeta: { ...state.tableMeta, awaitingNextRound: true, bettingLocked: true },
    });
    const box1After = resolvePlayableBoxes(reset).find((b) => b.boxId === box1);
    expect(box1After?.designatedOwner).toBe(p1);
    expect(box1After?.activePlayer).toBeNull();
  });
});

describe('canDealBlackjack', () => {
  it('host can deal with guest bets on host native box', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, p2);
    ready = readyToDeal(ready);
    expect(canDealBlackjack(ready, p1).allowed).toBe(true);
    expect(canDealBlackjack(ready, p2).allowed).toBe(false);
  });

  it('non-host cannot deal', () => {
    const { state, p2 } = twoPlayerSeated();
    const box2 = boxPlayerId(state, 2)!;
    let ready = addChipToBoxStake(state, box2, 50, p2);
    ready = readyToDeal(ready);
    const result = canDealBlackjack(ready, p2);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_table_host');
    expect(result.message).toBe(DEAL_CARDS_HOST_ONLY_MESSAGE);
  });

  it('host with reassigned boxes can deal all staked boxes', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    const box3 = boxPlayerId(state, 3)!;
    state = addChipToBoxStake(state, box2, 50, p1);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box3, 50, p2);
    state = readyToDeal(state);
    expect(canDealBlackjack(state, p1).allowed).toBe(true);
    expect(getEligibleDealBoxes(state).sort()).toEqual([box1, box2, box3].sort());
    const playable = resolvePlayableBoxes(state);
    expect(playable.find((b) => b.boxId === box1)?.activePlayer).toBe(p2);
    expect(playable.find((b) => b.boxId === box2)?.activePlayer).toBe(p1);
  });

  it('host with no playable eligible boxes cannot deal', () => {
    const { state, p1 } = twoPlayerSeated();
    const ready = readyToDeal(state);
    const result = canDealBlackjack(ready, p1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('place_bets_first');
  });

  it('free boxes still allow deal when host has eligible stake elsewhere', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    state = addChipToBoxStake(state, box3, 50, p1);
    state = addChipToBoxStake(state, boxPlayerId(state, 1)!, 50, p2);
    state = readyToDeal(state);
    expect(canDealBlackjack(state, p1).allowed).toBe(true);
    expect(getEligibleDealBoxes(state)).toContain(box3);
  });

  it('first-start allowPreShuffle skips deck requirement', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, p2);
    ready = { ...ready, deck: undefined };
    expect(ready.tableMeta.shoeStarted).toBe(false);
    expect(canDealBlackjack(ready, p1).allowed).toBe(false);
    expect(canDealBlackjack(ready, p1, { allowPreShuffle: true }).allowed).toBe(true);
  });

  it('enabled authority must not no-op on dealCards action', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    const box3 = boxPlayerId(state, 3)!;
    state = addChipToBoxStake(state, box2, 50, p1);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box3, 50, p2);
    const betting = readyToDeal(state);
    expect(canDealBlackjack(betting, p1).allowed).toBe(true);
    expect(() => applyBlackjackActionToState(betting, 'dealCards', ctx(betting, p1))).not.toThrow();
    const dealt = applyBlackjackActionToState(betting, 'dealCards', ctx(betting, p1));
    expect(dealt.blackjack?.status).not.toBe('betting');
    expect(Object.keys(dealt.blackjack?.playerHands ?? {}).length).toBeGreaterThan(0);
  });

  it('logDealAudit returns same result as canDealBlackjack', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const ready = readyToDeal(addChipToBoxStake(state, box1, 50, p2));
    const direct = canDealBlackjack(ready, p1);
    const audited = logDealAudit(ready, p1, { source: 'test' });
    expect(audited).toEqual(direct);
  });
});
