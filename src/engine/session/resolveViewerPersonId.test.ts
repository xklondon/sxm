import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import { addPlayer, mergeSessionUpdate } from './session';
import {
  getActionableHandForView,
} from '../../components/blackjackViewPhase';
import {
  getCallerPersonIdForBox,
  resolveViewerPersonId,
} from './playerAssignment';
import { actingRound, boxPlayerId, findCardId, tableAfterStartPlaying } from '../blackjack/sanity/fixtures';
import { claimBoxSlot } from './boxOps';
import { allocateChipsToBankrollOwner } from './allocation';

function twoPlayerTable(): { state: GameState; ownerId: string; guestId: string } {
  let state = tableAfterStartPlaying(500);
  const ownerId = state.tableMeta.ownerPersonId!;
  state = claimBoxSlot(state, 1);
  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'Kay',
    controllerName: 'Kay',
    role: 'person',
    startingChips: 500,
  });
  state = mergeSessionUpdate(state, guestSpl);
  const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
  state = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: guestId,
    amount: 500,
    reason: 'initial-player',
    source: 'setup',
  });
  state = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      playerOrder: [ownerId, guestId],
      assignedBoxByPersonId: { [ownerId]: 1, [guestId]: 2 },
      invites: [
        {
          inviteId: 'inv-1',
          tableId: 't1',
          invitedEmail: 'kay@example.com',
          invitedName: 'Kay',
          invitedBy: ownerId,
          inviteStatus: 'accepted',
          canInviteOthers: false,
          createdAt: new Date().toISOString(),
          token: 'tok',
        },
      ],
    },
  };
  state = claimBoxSlot(state, 2);
  const box2 = boxPlayerId(state, 2)!;
  state = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxSlots: state.tableMeta.boxSlots.map((s) =>
        s.slotNumber === 2
          ? { ...s, nativeAssignedPersonId: guestId, bankrollOwnerId: guestId }
          : s,
      ),
    },
  };
  void box2;
  return { state, ownerId, guestId };
}

describe('resolveViewerPersonId', () => {
  it('uses stored viewer person id over mismatched profile name', () => {
    const { state, guestId } = twoPlayerTable();
    const resolved = resolveViewerPersonId(state, {
      storedViewerPersonId: guestId,
      profileName: 'WrongName',
      profileEmail: 'other@example.com',
    });
    expect(resolved).toBe(guestId);
  });

  it('maps accepted invite email to seated guest', () => {
    const { state, guestId } = twoPlayerTable();
    const resolved = resolveViewerPersonId(state, {
      profileName: 'WrongName',
      profileEmail: 'kay@example.com',
    });
    expect(resolved).toBe(guestId);
  });

  it('active box 2: guest sees actionable hand, owner does not', () => {
    let { state, ownerId, guestId } = twoPlayerTable();
    const box2 = boxPlayerId(state, 2)!;
    const round = actingRound(
      state,
      box2,
      [findCardId(state.deck!, '10'), findCardId(state.deck!, '9')],
      10,
    );
    state = {
      ...state,
      tableMeta: { ...state.tableMeta, bettingLocked: true },
      blackjack: round,
    };
    expect(getCallerPersonIdForBox(state, box2)).toBe(guestId);
    expect(getActionableHandForView(state, guestId, true)).not.toBeNull();
    expect(getActionableHandForView(state, ownerId, true)).toBeNull();
  });
});
