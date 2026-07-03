import { describe, expect, it } from 'vitest';

import type { GameState } from '../../types';
import { createBlackjackPlayerHand } from '../../types/blackjack';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { claimBoxSlot } from '../session/boxOps';
import {
  getCallerPersonIdForBox,
  syncPlayerOrderAndAssignments,
} from '../session/playerAssignment';
import {
  clearTemporaryBoxCommandState,
  hasNoRoundBoxOwnershipResidue,
} from '../session/resetBlackjackRoundOwnership';
import { getBlackjackProtocolPhase } from './protocol';
import { evaluateBlackjackDealEngine } from './dealEligibility';
import {
  completeBankingOnState,
  processPlayFlowAutoStands,
  resolveBankTurnAuto,
  startNextRoundOnState,
  syncBankPhaseOnState,
} from './gameState';
import { applyBlackjackActionToState, type BlackjackActorContext } from './applyBlackjackAction';
import { addChipToBoxStake, formatBoxStakeDisplayLabel, getBoxStakeBreakdown } from './stakes';
import { setPersonPlayFlow } from './playFlow';
import { blackjackHandKey, listHandKeysForPlayer } from './handKeys';
import { buildBlackjackCommandText } from '../../components/tableCommandDisplay';
import {
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
} from './sanity/fixtures';

function ctx(state: GameState): BlackjackActorContext {
  return {
    personId: state.tableMeta.ownerPersonId!,
    payload: {},
    resolveBankAuto: true,
  };
}

function threeBoxTable() {
  let state = tableAfterStartPlaying(500);
  const host = state.tableMeta.ownerPersonId!;
  const guest = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'Guest',
    controllerName: 'Guest',
    role: 'person',
    startingChips: 500,
  });
  state = mergeSessionUpdate(state, guest);
  const guestId = guest.session.playerIds[guest.session.playerIds.length - 1]!;
  state = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: guestId,
    amount: 500,
    reason: 'initial-player',
    source: 'setup',
  });
  state = {
    ...state,
    tableMeta: { ...state.tableMeta, playerOrder: [host, guestId] },
  };
  state = syncPlayerOrderAndAssignments(state);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, 2);
  state = claimBoxSlot(state, 3);
  const box1 = boxPlayerId(state, 1)!;
  const box2 = boxPlayerId(state, 2)!;
  const box3 = boxPlayerId(state, 3)!;
  return { state, host, guestId, box1, box2, box3 };
}

function threeHandAuto18State() {
  let { state, host, box1, box2, box3 } = threeBoxTable();
  state = setPersonPlayFlow(state, host, 'auto-18');
  state = addChipToBoxStake(state, box1, 50);
  state = addChipToBoxStake(state, box2, 50);
  state = addChipToBoxStake(state, box3, 50);
  const deck = state.deck!;
  const hands = [
    { boxId: box1, cards: [findCardId(deck, '10'), findCardId(deck, '8', 'hearts')] },
    { boxId: box2, cards: [findCardId(deck, 'K'), findCardId(deck, '8', 'clubs')] },
    { boxId: box3, cards: [findCardId(deck, 'Q'), findCardId(deck, '8', 'diamonds')] },
  ];
  const playerHands: NonNullable<GameState['blackjack']>['playerHands'] = {};
  for (const hand of hands) {
    const key = blackjackHandKey(hand.boxId, 0);
    playerHands[key] = {
      ...createBlackjackPlayerHand(hand.boxId, 0),
      cardIds: hand.cards,
      currentBet: 50,
      actionStatus: 'acting',
    };
  }
  return {
    ...state,
    tableMeta: { ...state.tableMeta, bettingLocked: true },
    blackjackSettings: { ...state.blackjackSettings, allowDoubleDown: false },
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns' as const,
      activeHandKey: blackjackHandKey(box1, 0),
      activePlayerId: box1,
      dealerCardIds: [findCardId(deck, '7'), findCardId(deck, '6', 'spades')],
      dealerHoleHidden: true,
      playerHands,
    },
  };
}

function advanceThroughAutoStands(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.blackjack?.status === 'player-turns' && guard < 40) {
    guard += 1;
    next = syncBankPhaseOnState(processPlayFlowAutoStands(next));
  }
  return next;
}

describe('blackjack round transition — auto-stop at 18+', () => {
  it('three boxes auto-stop → bank → resolved clears commanders and blocks stale player command', () => {
    let state = threeHandAuto18State();
    state = advanceThroughAutoStands(state);
    expect(['bank-turn', 'banking']).toContain(state.blackjack?.status);
    state = resolveBankTurnAuto(state);
    expect(state.blackjack?.status).toBe('resolved');
    expect(state.tableMeta.awaitingNextRound).toBe(true);
    expect(state.blackjack?.activeHandKey).toBeNull();

    for (const slot of state.tableMeta.boxSlots) {
      expect(slot.callerPersonId).toBeNull();
    }

    const command = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: 'Round complete',
      protocolPhase: getBlackjackProtocolPhase(state),
      roundSummaryLines: [],
      controllerName: 'Alice',
      viewerPersonId: state.tableMeta.ownerPersonId,
    });
    expect(command.commandMessage).not.toMatch(/your turn/i);
    expect(getBlackjackProtocolPhase(state)).toBe('round-complete');
    expect(evaluateBlackjackDealEngine(state).allowed).toBe(false);
  });

  it('next round after auto-stop settlement → clean betting → deal after new stakes', () => {
    let state = advanceThroughAutoStands(threeHandAuto18State());
    state = resolveBankTurnAuto(state);
    expect(state.tableMeta.awaitingNextRound).toBe(true);

    state = startNextRoundOnState(state);
    expect(hasNoRoundBoxOwnershipResidue(state)).toBe(true);
    expect(state.blackjack?.status).toBe('betting');
    expect(state.blackjack?.activeHandKey).toBeNull();
    expect(getBlackjackProtocolPhase(state)).toBe('betting');
    for (const boxId of [boxPlayerId(state, 1)!, boxPlayerId(state, 2)!, boxPlayerId(state, 3)!]) {
      expect(listHandKeysForPlayer(state.blackjack!.playerHands, boxId)).toHaveLength(1);
    }

    const box1 = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, box1, 50);
    expect(evaluateBlackjackDealEngine(state).allowed).toBe(true);

    const dealt = applyBlackjackActionToState(state, 'dealCards', ctx(state));
    expect(dealt.blackjack?.status).not.toBe('betting');
    expect(dealt.tableMeta.bettingLocked).toBe(true);
  });

  it('native assigned box commanded by other staker for round, reset after settlement', () => {
    let { state, host, guestId, box1 } = threeBoxTable();
    state = addChipToBoxStake(state, box1, 50, guestId);
    expect(getCallerPersonIdForBox(state, box1)).toBe(guestId);

    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        awaitingNextRound: true,
        bettingLocked: true,
      },
      blackjack: {
        ...state.blackjack!,
        status: 'resolved',
        isSettled: true,
        activeHandKey: null,
      },
    };
    state = clearTemporaryBoxCommandState(state);
    expect(getCallerPersonIdForBox(state, box1)).toBeNull();
    const slot = state.tableMeta.boxSlots.find((s) => s.playerId === box1)!;
    expect(slot.nativeAssignedPersonId).toBe(host);
  });

  it('co-staked box shows per-contributor breakdown label', () => {
    let { state, host, guestId, box1 } = threeBoxTable();
    state = addChipToBoxStake(state, box1, 120, host);
    state = addChipToBoxStake(state, box1, 80, guestId);
    const breakdown = getBoxStakeBreakdown(state, box1);
    expect(breakdown).toHaveLength(2);
    expect(breakdown.reduce((sum, row) => sum + row.amount, 0)).toBe(200);
    const label = formatBoxStakeDisplayLabel(state, box1);
    expect(label).toContain('120');
    expect(label).toContain('80');
    expect(label).not.toBe('200');
  });

  it('split hands cleared before next betting round', () => {
    let { state, box1 } = threeBoxTable();
    const splitKey = blackjackHandKey(box1, 1);
    state = {
      ...state,
      tableMeta: { ...state.tableMeta, awaitingNextRound: true, bettingLocked: true },
      blackjack: {
        ...state.blackjack!,
        status: 'resolved',
        isSettled: true,
        activeHandKey: splitKey,
        splitCounts: { [box1]: 1 },
        playerHands: {
          [blackjackHandKey(box1, 0)]: createBlackjackPlayerHand(box1, 0, true),
          [splitKey]: createBlackjackPlayerHand(box1, 1, true),
        },
      },
    };
    const next = startNextRoundOnState(state);
    expect(listHandKeysForPlayer(next.blackjack!.playerHands, box1)).toHaveLength(1);
    expect(next.blackjack?.splitCounts[box1] ?? 0).toBe(0);
    expect(next.blackjack?.activeHandKey).toBeNull();
  });

  it('resolved status never maps to betting protocol phase', () => {
    const { state } = threeBoxTable();
    const resolved = {
      ...state,
      tableMeta: { ...state.tableMeta, awaitingNextRound: false, bettingLocked: true },
      blackjack: { ...state.blackjack!, status: 'resolved' as const },
    };
    expect(getBlackjackProtocolPhase(resolved)).toBe('round-complete');
  });
});
