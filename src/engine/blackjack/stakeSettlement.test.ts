import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import type { BlackjackRound } from '../../types/blackjack';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { claimBoxSlot } from '../session/boxOps';
import {
  getCallerPersonIdForBox,
  syncCallersForDeal,
  syncPlayerOrderAndAssignments,
} from '../session/playerAssignment';
import { getBoxDecisionOwner } from '../session/boxDecisionOwnership';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { bankrollContextFromState } from '../session/bankroll';
import { addChipToBoxStake } from './stakes';
import { dealCardsButtonOnState, shuffleToStartOnState, startNextRoundOnState } from './gameState';
import { resolveBlackjackRound } from './round';
import { splitAmountByStakerShares } from './stakeSettlement';
import { boxPlayerId, findCardId, tableAfterStartPlaying } from './sanity/fixtures';

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

function resolveBankingRound(
  state: GameState,
  boxId: string,
  playerCardRanks: string[],
  dealerCardRanks: string[],
): GameState {
  const deck = state.deck!;
  const handKey = `${boxId}:0`;
  const hand = state.blackjack!.playerHands[handKey];
  if (!hand) {
    throw new Error(`Missing hand ${handKey}`);
  }
  const bankingRound: BlackjackRound = {
    ...state.blackjack!,
    status: 'banking',
    dealerHoleHidden: false,
    dealerCardIds: dealerCardRanks.map((rank) => findCardId(deck, rank)),
    playerHands: {
      [handKey]: {
        ...hand,
        cardIds: playerCardRanks.map((rank) => findCardId(deck, rank)),
        actionStatus: 'stood',
      },
    },
  };
  const resolved = resolveBlackjackRound(
    state.session,
    state.players,
    state.ledger,
    deck,
    bankingRound,
    state.blackjackSettings,
    bankrollContextFromState(state),
  );
  return {
    ...state,
    session: resolved.session,
    ledger: resolved.ledger,
    blackjack: resolved.round,
  };
}

describe('splitAmountByStakerShares', () => {
  it('splits co-stake 100/200 into 1/3 and 2/3', () => {
    expect(splitAmountByStakerShares(300, { host: 100, guest: 200 })).toEqual({
      host: 100,
      guest: 200,
    });
    expect(splitAmountByStakerShares(600, { host: 100, guest: 200 })).toEqual({
      host: 200,
      guest: 400,
    });
  });
});

describe('stake settlement (Phase B)', () => {
  it('guest k on host box: k receives win, host native owner does not', () => {
    const { state, host, guest } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    const afterDeal = dealCardsButtonOnState(readyToDeal(ready));
    const guestAfterDeal = ledgerBalance(afterDeal, guest);
    const hostAfterDeal = ledgerBalance(afterDeal, host);

    const settled = resolveBankingRound(afterDeal, box1, ['10', 'K'], ['10', '7']);
    expect(settled.blackjack?.outcomes[`${box1}:0`]).toBe('win');
    expect(ledgerBalance(settled, guest)).toBe(guestAfterDeal + 300);
    expect(ledgerBalance(settled, host)).toBe(hostAfterDeal);
  });

  it('host xx on guest box: host receives win, guest native owner does not', () => {
    const { state, host, guest } = twoPlayerSeated();
    const box2 = boxPlayerId(state, 2)!;
    let ready = addChipToBoxStake(state, box2, 50, host);
    ready = addChipToBoxStake(ready, box2, 50, host);
    const afterDeal = dealCardsButtonOnState(readyToDeal(ready));
    const guestAfterDeal = ledgerBalance(afterDeal, guest);
    const hostAfterDeal = ledgerBalance(afterDeal, host);

    const settled = resolveBankingRound(afterDeal, box2, ['10', 'K'], ['10', '7']);
    expect(ledgerBalance(settled, host)).toBe(hostAfterDeal + 200);
    expect(ledgerBalance(settled, guest)).toBe(guestAfterDeal);
  });

  it('co-stake loss: only stakers lose; native owner unchanged if they did not stake', () => {
    const { state, host, guest } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, host);
    ready = addChipToBoxStake(ready, box1, 50, host);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    const afterDeal = dealCardsButtonOnState(readyToDeal(ready));
    const guestAfterDeal = ledgerBalance(afterDeal, guest);
    const hostAfterDeal = ledgerBalance(afterDeal, host);

    const settled = resolveBankingRound(afterDeal, box1, ['10', '9'], ['K', 'A']);
    expect(settled.blackjack?.outcomes[`${box1}:0`]).toBe('loss');
    expect(ledgerBalance(settled, guest)).toBe(guestAfterDeal);
    expect(ledgerBalance(settled, host)).toBe(hostAfterDeal);
  });

  it('co-stake win splits payout 1/3 and 2/3 to contributors', () => {
    const { state, host, guest } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, host);
    ready = addChipToBoxStake(ready, box1, 50, host);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    ready = addChipToBoxStake(ready, box1, 50, guest);
    const afterDeal = dealCardsButtonOnState(readyToDeal(ready));
    const guestAfterDeal = ledgerBalance(afterDeal, guest);
    const hostAfterDeal = ledgerBalance(afterDeal, host);

    const settled = resolveBankingRound(afterDeal, box1, ['10', 'K'], ['10', '7']);
    // Win pays 600 total (300 bet × 2); split 1/3 / 2/3 by staker shares.
    expect(ledgerBalance(settled, host)).toBe(hostAfterDeal + 200);
    expect(ledgerBalance(settled, guest)).toBe(guestAfterDeal + 400);
  });
});

describe('box commander unchanged (Phase B)', () => {
  it('designated owner commands when they staked this round', () => {
    const { state, host } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const ready = addChipToBoxStake(state, box1, 50, host);
    expect(getCallerPersonIdForBox(ready, box1)).toBe(host);
    expect(getBoxDecisionOwner(ready, box1)).toBe(host);
  });

  it('first staker commands when designated owner did not stake', () => {
    const { state, host, guest } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    const ready = addChipToBoxStake(state, box1, 50, guest);
    expect(getCallerPersonIdForBox(ready, box1)).toBe(guest);
    expect(getCallerPersonIdForBox(ready, box1)).not.toBe(host);
  });

  it('free box resets commander after round', () => {
    let { state, host } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxSlots: state.tableMeta.boxSlots.map((s) =>
          s.playerId === box3 ? { ...s, nativeAssignedPersonId: null, callerPersonId: null } : s,
        ),
      },
    };
    state = addChipToBoxStake(state, box3, 50, host);
    expect(getCallerPersonIdForBox(state, box3)).toBe(host);

    const dealt = dealCardsButtonOnState(readyToDeal(state));
    const settled = {
      ...dealt,
      tableMeta: { ...dealt.tableMeta, awaitingNextRound: true, bettingLocked: true },
      blackjack: { ...dealt.blackjack!, status: 'resolved' as const, isSettled: true },
    };
    const betting = startNextRoundOnState(settled);
    expect(getCallerPersonIdForBox(betting, box3)).toBeNull();
    expect(betting.tableMeta.boxStakes[box3]).toBeUndefined();
  });

  it('syncCallersForDeal locks commander separately from payer', () => {
    const { state, host, guest } = twoPlayerSeated();
    const box1 = boxPlayerId(state, 1)!;
    let ready = addChipToBoxStake(state, box1, 50, guest);
    const locked = syncCallersForDeal(ready, [box1]);
    expect(getCallerPersonIdForBox(locked, box1)).toBe(guest);
    expect(locked.tableMeta.boxStakes[box1]?.stakerAmountsByPersonId?.[guest]).toBe(50);
    expect(locked.tableMeta.boxStakes[box1]?.stakerAmountsByPersonId?.[host]).toBeUndefined();
  });
});
