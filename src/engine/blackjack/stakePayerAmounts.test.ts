import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { syncPlayerOrderAndAssignments } from '../session/playerAssignment';
import { canDealBlackjack } from '../session/canDealBlackjack';
import {
  addChipToBoxStake,
  getStakeForBox,
  removeLastChipFromBoxStake,
  resolveStakerAmountsByPersonId,
} from './stakes';
import {
  getOpenStakeExposureForPerson,
  getTotalCommittedExposureForPerson,
} from '../session/playerCommittedExposure';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { dealCardsButtonOnState, shuffleToStartOnState, startNextRoundOnState } from './gameState';
import { boxPlayerId, tableAfterStartPlaying } from './sanity/fixtures';

function twoPlayerSeated(startingChips = 500) {
  let state = tableAfterStartPlaying(startingChips);
  const host = state.tableMeta.ownerPersonId!;
  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'K',
    controllerName: 'K',
    role: 'person',
    startingChips: 0,
  });
  state = mergeSessionUpdate(state, guestSpl);
  const guest = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
  state = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: guest,
    amount: startingChips,
    reason: 'initial-player',
    source: 'setup',
  });
  state = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      playerOrder: [host, guest],
    },
  };
  state = syncPlayerOrderAndAssignments(state);
  return { state, host, guest };
}

function ledgerBalance(state: GameState, personId: string): number {
  return derivePlayerBalanceFromLedger(personId, state.ledger);
}

function readyToDeal(state: GameState): GameState {
  return shuffleToStartOnState(state);
}

describe('stake payer amounts (Phase A)', () => {
  it('guest k on host native Box 1: k exposure only, k debited on deal', () => {
    const { state, host, guest } = twoPlayerSeated(500);
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);

    expect(getStakeForBox(ready, box1)).toBe(150);
    expect(getOpenStakeExposureForPerson(ready, guest)).toBe(150);
    expect(getOpenStakeExposureForPerson(ready, host)).toBe(0);
    expect(resolveStakerAmountsByPersonId(ready, box1)).toEqual({ [guest]: 150 });

    const hostBefore = ledgerBalance(ready, host);
    const guestBefore = ledgerBalance(ready, guest);
    const dealt = dealCardsButtonOnState(readyToDeal(ready));

    expect(ledgerBalance(dealt, guest)).toBe(guestBefore - 150);
    expect(ledgerBalance(dealt, host)).toBe(hostBefore);
  });

  it('host xx on guest native Box 2: host exposure only, host debited on deal', () => {
    const { state, host, guest } = twoPlayerSeated(500);
    const box2 = boxPlayerId(state, 2)!;
    let ready = addChipToBoxStake(state, box2, 50, host);
    ready = addChipToBoxStake(ready, box2, 50, host);

    expect(getOpenStakeExposureForPerson(ready, host)).toBe(100);
    expect(getOpenStakeExposureForPerson(ready, guest)).toBe(0);

    const hostBefore = ledgerBalance(ready, host);
    const guestBefore = ledgerBalance(ready, guest);
    const dealt = dealCardsButtonOnState(readyToDeal(ready));

    expect(ledgerBalance(dealt, host)).toBe(hostBefore - 100);
    expect(ledgerBalance(dealt, guest)).toBe(guestBefore);
  });

  it('co-staked box: per-staker exposure and debits without full-box double count', () => {
    const { state, host, guest } = twoPlayerSeated(500);
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, host);
    ready = addChipToBoxStake(ready, box1, 50, host);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);

    expect(getStakeForBox(ready, box1)).toBe(300);
    expect(getOpenStakeExposureForPerson(ready, host)).toBe(100);
    expect(getOpenStakeExposureForPerson(ready, guest)).toBe(200);
    expect(getTotalCommittedExposureForPerson(ready, host)).toBe(100);
    expect(getTotalCommittedExposureForPerson(ready, guest)).toBe(200);

    const hostBefore = ledgerBalance(ready, host);
    const guestBefore = ledgerBalance(ready, guest);
    const dealt = dealCardsButtonOnState(readyToDeal(ready));

    expect(ledgerBalance(dealt, host)).toBe(hostBefore - 100);
    expect(ledgerBalance(dealt, guest)).toBe(guestBefore - 200);
  });

  it('remove last chip decrements payer amount and prunes stakerPersonIds', () => {
    const { state, host, guest } = twoPlayerSeated(500);
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, host);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    ready = removeLastChipFromBoxStake(ready, box1);

    const entry = ready.tableMeta.boxStakes[box1]!;
    expect(entry.amount).toBe(50);
    expect(entry.stakerPersonIds).toEqual([host]);
    expect(entry.stakerAmountsByPersonId).toEqual({ [host]: 50 });
    expect(getOpenStakeExposureForPerson(ready, guest)).toBe(0);
    expect(getOpenStakeExposureForPerson(ready, host)).toBe(50);
  });

  it('second round: reset clears staker amounts, new cross-box bets and deal work', () => {
    let { state, host, guest } = twoPlayerSeated(500);
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;

    state = addChipToBoxStake(state, box1, 50, guest);
    state = addChipToBoxStake(state, box1, 50, guest);
    state = addChipToBoxStake(state, box1, 50, guest);
    const round1Dealt = dealCardsButtonOnState(readyToDeal(state));
    expect(round1Dealt.tableMeta.bettingLocked).toBe(true);

    const settled = {
      ...round1Dealt,
      tableMeta: {
        ...round1Dealt.tableMeta,
        awaitingNextRound: true,
        bettingLocked: true,
      },
      blackjack: {
        ...round1Dealt.blackjack!,
        status: 'resolved' as const,
        isSettled: true,
      },
    };

    let betting = startNextRoundOnState(settled);
    expect(betting.tableMeta.boxStakes).toEqual({});
    expect(betting.tableMeta.bettingLocked).toBe(false);
    expect(betting.tableMeta.boxSlots.every((s) => s.callerPersonId === null)).toBe(true);

    betting = addChipToBoxStake(betting, box2, 50, host);
    betting = addChipToBoxStake(betting, box2, 50, host);
    betting = addChipToBoxStake(betting, box1, 50, guest);
    betting = addChipToBoxStake(betting, box1, 50, guest);

    expect(canDealBlackjack(betting, host).allowed).toBe(true);
    expect(getOpenStakeExposureForPerson(betting, host)).toBe(100);
    expect(getOpenStakeExposureForPerson(betting, guest)).toBe(100);
    expect(betting.tableMeta.boxStakes[box1]?.stakerAmountsByPersonId).toEqual({ [guest]: 100 });

    const hostBefore = ledgerBalance(betting, host);
    const guestBefore = ledgerBalance(betting, guest);
    const round2 = dealCardsButtonOnState(readyToDeal(betting));
    expect(round2.blackjack?.status).not.toBe('betting');
    expect(ledgerBalance(round2, host)).toBe(hostBefore - 100);
    expect(ledgerBalance(round2, guest)).toBe(guestBefore - 100);
  });
});
