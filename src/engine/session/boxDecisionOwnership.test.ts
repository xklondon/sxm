import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assignTemporaryBoxOwnerOnFirstBet,
  getBoxDecisionOwner,
  getCanonicalBoxAssignment,
  getViewerCanActOnActiveHand,
  resolveViewerActionPermission,
} from './boxDecisionOwnership';
import {
  syncPlayerOrderAndAssignments,
  getAssignedSlotForPerson,
} from './playerAssignment';
import { addPlayer, mergeSessionUpdate } from './session';
import { allocateChipsToBankrollOwner } from './allocation';
import { claimBoxSlot } from './boxOps';
import { addChipToBoxStake } from '../blackjack/stakes';
import { startNextRoundOnState } from '../blackjack/gameState';
import { finalizeInviteJoinAtTable } from './inviteJoin';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
} from '../blackjack/sanity/fixtures';
import { canShowPlayerDecisionControls } from '../../components/blackjackViewPhase';

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

function playerTurnState(base: ReturnType<typeof twoPlayerSeated>['state'], boxId: string) {
  return {
    ...base,
    blackjack: actingRound(base, boxId, [findCardId(base.deck!, '6'), findCardId(base.deck!, '7')], 10),
  };
}

describe('boxDecisionOwnership — assignment rules', () => {
  it('P1 native box 1, P2 native box 2 — no commander until stake', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    expect(getCanonicalBoxAssignment(state)).toEqual([
      { personId: p1, nativeSlot: 1 },
      { personId: p2, nativeSlot: 2 },
    ]);
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    expect(getBoxDecisionOwner(state, box1)).toBeNull();
    expect(getBoxDecisionOwner(state, box2)).toBeNull();
    const staked1 = addChipToBoxStake(state, box1, 10, p1);
    expect(getBoxDecisionOwner(staked1, box1)).toBe(p1);
  });

  it('P1 chips on P2 native box — P1 commands when P2 has not staked', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box2 = boxPlayerId(state, 2)!;
    const next = addChipToBoxStake(state, box2, 10, p1);
    expect(getBoxDecisionOwner(next, box2)).toBe(p1);
    expect(getAssignedSlotForPerson(next, p2)).toBe(2);
  });

  it('first bettor on free box 3 gets temporary ownership', () => {
    let { state, p1 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxSlots: state.tableMeta.boxSlots.map((s) =>
          s.playerId === box3 ? { ...s, nativeAssignedPersonId: null } : s,
        ),
      },
    };
    const next = addChipToBoxStake(state, box3, 10, p1);
    expect(getBoxDecisionOwner(next, box3)).toBe(p1);
    expect(
      assignTemporaryBoxOwnerOnFirstBet(next, box3, p1, next.tableMeta.boxStakes[box3]),
    ).toBe(p1);
  });

  it('second bettor on free box does not steal temporary ownership', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxSlots: state.tableMeta.boxSlots.map((s) =>
          s.playerId === box3 ? { ...s, nativeAssignedPersonId: null } : s,
        ),
      },
    };
    let next = addChipToBoxStake(state, box3, 10, p1);
    next = addChipToBoxStake(next, box3, 5, p2);
    expect(getBoxDecisionOwner(next, box3)).toBe(p1);
  });

  it('temporary assignment clears on new betting round', () => {
    let { state, p1 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    state = addChipToBoxStake(
      {
        ...state,
        tableMeta: {
          ...state.tableMeta,
          boxSlots: state.tableMeta.boxSlots.map((s) =>
            s.playerId === box3 ? { ...s, nativeAssignedPersonId: null } : s,
          ),
        },
      },
      box3,
      10,
      p1,
    );
    state = {
      ...state,
      tableMeta: { ...state.tableMeta, awaitingNextRound: true },
      blackjack: { ...state.blackjack!, isSettled: true, status: 'resolved' },
    };
    const next = startNextRoundOnState(state);
    expect(getBoxDecisionOwner(next, box3)).toBeNull();
  });

  it('hydration preserves native assignment after invite join', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Guest',
      controllerName: 'Guest',
      role: 'person',
      startingChips: 0,
    });
    const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
    state = mergeSessionUpdate(state, guestSpl);
    const joined = finalizeInviteJoinAtTable(state, guestId, 'Guest');
    expect(getAssignedSlotForPerson(joined.state, guestId)).toBe(2);
    const box2 = boxPlayerId(joined.state, 2)!;
    expect(getBoxDecisionOwner(joined.state, box2)).toBeNull();
  });
});

describe('boxDecisionOwnership — viewer action permission', () => {
  it('P2 native box active: P2 can act after staking, P1 cannot', () => {
    const { state, p1, p2 } = twoPlayerSeated();
    const box2 = boxPlayerId(state, 2)!;
    const staked = addChipToBoxStake(state, box2, 10, p2);
    const playing = playerTurnState(staked, box2);

    expect(getViewerCanActOnActiveHand(playing, p2)).toEqual({
      handKey: playing.blackjack!.activeHandKey!,
      boxId: box2,
    });
    expect(getViewerCanActOnActiveHand(playing, p1)).toBeNull();

    const ownerPerm = resolveViewerActionPermission(playing, p2);
    expect(ownerPerm.canAct).toBe(true);
    const guestPerm = resolveViewerActionPermission(playing, p1);
    expect(guestPerm.canAct).toBe(false);
    expect(guestPerm.waitMessage).toMatch(/waiting for P2/i);
  });

  it('free box temp owner: first bettor can act, contributor cannot', () => {
    let { state, p1, p2 } = twoPlayerSeated();
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxSlots: state.tableMeta.boxSlots.map((s) =>
          s.playerId === box3 ? { ...s, nativeAssignedPersonId: null } : s,
        ),
      },
    };
    state = addChipToBoxStake(state, box3, 10, p1);
    state = addChipToBoxStake(state, box3, 5, p2);
    const playing = playerTurnState(state, box3);

    expect(getViewerCanActOnActiveHand(playing, p1)).not.toBeNull();
    expect(getViewerCanActOnActiveHand(playing, p2)).toBeNull();
  });

  it('Full Table and Card View share permission — Card View adds hero-box gate', () => {
    const { state, p2 } = twoPlayerSeated();
    const box2 = boxPlayerId(state, 2)!;
    const staked = addChipToBoxStake(state, box2, 10, p2);
    const playing = playerTurnState(staked, box2);
    playing.tableMeta.boxSlots = playing.tableMeta.boxSlots.map((slot) =>
      slot.playerId === box2 ? { ...slot, callerPersonId: p2 } : slot,
    );

    const fullTable = resolveViewerActionPermission(playing, p2);
    const cardViewHero = resolveViewerActionPermission(playing, p2, {
      cardViewHeroBoxId: box2,
    });
    const cardViewWrongBox = resolveViewerActionPermission(playing, p2, {
      cardViewHeroBoxId: boxPlayerId(state, 1)!,
    });

    expect(fullTable.canAct).toBe(true);
    expect(cardViewHero).toEqual(fullTable);
    expect(cardViewWrongBox.canAct).toBe(false);
    expect(cardViewWrongBox.blockReason).toBe('wrong-hero-box');
  });

  it('mobile and desktop Card View use the same permission helper', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
    expect(src).toContain('resolveViewerActionPermission');
    expect(src).not.toContain('getActionableHandForView');
  });

  it('Card View no longer routes gameplay through hero swipe handlers', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
    expect(src).not.toMatch(/handleTouchEnd[\s\S]*actionPermission\.canAct/);
    expect(src).toContain('resolveViewerActionPermission');
  });

  it('single-player solo bypass unchanged', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const box1 = boxPlayerId(state, 1)!;
    const p1 = state.tableMeta.ownerPersonId!;
    const playing = playerTurnState(state, box1);
    expect(getViewerCanActOnActiveHand(playing, p1)).not.toBeNull();
  });

  it('initial deal controls hidden until reveal complete', () => {
    const { state } = twoPlayerSeated();
    const box2 = boxPlayerId(state, 2)!;
    const playing = {
      ...playerTurnState(state, box2),
      blackjack: {
        ...playerTurnState(state, box2).blackjack!,
        status: 'initial-deal' as const,
      },
    };
    expect(
      canShowPlayerDecisionControls(playing, 'player', { cardRevealComplete: true }),
    ).toBe(false);
  });
});
