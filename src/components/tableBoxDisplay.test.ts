import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildTablePeopleRows } from '../engine/session/tablePeople';
import {
  getCoBoxSlotsForPerson,
  getRunningBoxSlotsForPerson,
} from '../engine/session/tableBoxDisplay';
import {
  syncPlayerOrderAndAssignments,
} from '../engine/session/playerAssignment';
import { addPlayer, mergeSessionUpdate } from '../engine/session/session';
import { allocateChipsToBankrollOwner } from '../engine/session/allocation';
import { claimBoxSlot } from '../engine/session/boxOps';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import { boxPlayerId, tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';

function twoPlayerTable() {
  let state = tableAfterStartPlaying(500);
  const p1 = state.tableMeta.ownerPersonId!;
  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'P2',
    controllerName: 'P2',
    role: 'person',
    startingChips: 0,
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

function personRow(state: ReturnType<typeof twoPlayerTable>['state'], personId: string) {
  return buildTablePeopleRows(state).find((r) => r.personId === personId)!;
}

describe('This Table box display — stake-based ownership', () => {
  it('selecting a free box (selectedSeatId only) does not change This Table lists', () => {
    let { state, p1 } = twoPlayerTable();
    state = claimBoxSlot(state, 3);
    const box3 = boxPlayerId(state, 3)!;
    const before = personRow(state, p1);

    state = { ...state, selectedSeatId: box3 };

    const after = personRow(state, p1);
    expect(after.assignedBox).toBe(before.assignedBox);
    expect(after.runningBoxSlots).toEqual(before.runningBoxSlots);
    expect(after.coBoxSlots).toEqual(before.coBoxSlots);
    expect(after.runningBoxSlots).toEqual([]);
    expect(after.coBoxSlots).toEqual([]);
  });

  it('placing chips on a free box adds it to Running boxes for the first staker', () => {
    let { state, p1 } = twoPlayerTable();
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

    expect(getRunningBoxSlotsForPerson(state, p1)).toEqual([3]);
    expect(personRow(state, p1).runningBoxSlots).toEqual([3]);
    expect(personRow(state, p1).assignedBox).toBe(1);
  });

  it('placing chips on another player native box adds Co-boxes, not Running', () => {
    let { state, p1, p2 } = twoPlayerTable();
    const box2 = boxPlayerId(state, 2)!;
    state = addChipToBoxStake(state, box2, 10, p1);

    expect(getCoBoxSlotsForPerson(state, p1)).toEqual([2]);
    expect(getRunningBoxSlotsForPerson(state, p1)).toEqual([]);
    expect(personRow(state, p1).coBoxSlots).toEqual([2]);
    expect(personRow(state, p1).runningBoxSlots).toEqual([]);
    expect(personRow(state, p2).assignedBox).toBe(2);
    expect(personRow(state, p2).coBoxSlots).toEqual([]);
  });

  it('native box remains Assigned only when staked by native owner', () => {
    let { state, p1 } = twoPlayerTable();
    const box1 = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, box1, 10, p1);

    expect(personRow(state, p1).assignedBox).toBe(1);
    expect(personRow(state, p1).runningBoxSlots).toEqual([]);
    expect(getRunningBoxSlotsForPerson(state, p1)).toEqual([]);
  });

  it('selectedBettingBoxId stays client-local — selectBox does not persist selectedSeatId', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toContain('selectedBettingBoxId');
    expect(src).toMatch(/function selectBox\(boxId: string\) \{[\s\S]*selectLocalTarget/);
    expect(src).not.toMatch(/function selectBox\(boxId: string\) \{[\s\S]*selectedSeatId: boxId/);
  });

  it('empty slot tap selects chip target without assignBox or claimBoxSlot', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toMatch(
      /function handleClaimOrSelectSlot[\s\S]*selectLocalTarget\(slotNumber\)/,
    );
    expect(src).not.toMatch(/handleClaimOrSelectSlot[\s\S]*assignBox/);
    expect(src).not.toMatch(/handleClaimOrSelectSlot[\s\S]*claimBoxSlot/);
  });
});
