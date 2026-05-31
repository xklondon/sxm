import { describe, expect, it } from 'vitest';
import { createNewBlackjackTable } from '../session';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import { addChipToBoxStake, getStakeBetValidationMessage } from './stakes';
import { hasEligibleDealBoxes } from './dealEligibility';

describe('stake bet validation', () => {
  function tableWithBoxStake(chips: Array<1 | 2 | 5 | 10 | 50>) {
    let state = createNewBlackjackTable();
    const boxId = 'box-test';
    const personId = 'person-1';
    state = {
      ...state,
      players: {
        [boxId]: {
          id: boxId,
          displayName: 'Box 1',
          controllerName: 'Host',
          role: 'box',
          bankrollOwnerId: personId,
          playerType: 'real',
          startingBalance: 0,
          currentBet: 0,
          cardIds: [],
          status: 'active',
        },
        [personId]: {
          id: personId,
          displayName: 'Host',
          controllerName: 'Host',
          role: 'person',
          playerType: 'real',
          startingBalance: 0,
          currentBet: 0,
          cardIds: [],
          status: 'active',
        },
      },
      session: {
        ...state.session,
        playerIds: [personId, boxId],
        boxSlotNumbers: { [boxId]: 1 },
      },
      tableMeta: {
        ...state.tableMeta,
        minimumBet: 5,
        ownerPersonId: personId,
        boxSlots: state.tableMeta.boxSlots.map((s) =>
          s.slotNumber === 1
            ? { ...s, playerId: boxId, nativeAssignedPersonId: personId, bankrollOwnerId: personId }
            : s,
        ),
      },
    };
    state = allocateChipsToBankrollOwner(state, {
      bankrollOwnerId: personId,
      amount: 5000,
      reason: 'initial-player',
      source: 'setup',
    });
    for (const chip of chips) {
      state = addChipToBoxStake(state, boxId, chip, personId);
    }
    return { state, boxId };
  }

  it('bet 10 with min 5 is valid and eligible to deal', () => {
    const { state, boxId } = tableWithBoxStake([10]);
    expect(getStakeBetValidationMessage(state, boxId)).toBeNull();
    expect(hasEligibleDealBoxes(state)).toBe(true);
  });

  it('bet 50+10+50 with min 5 is valid and eligible to deal', () => {
    const { state, boxId } = tableWithBoxStake([50, 10, 50]);
    expect(getStakeBetValidationMessage(state, boxId)).toBeNull();
    expect(state.tableMeta.boxStakes[boxId]?.amount).toBe(110);
    expect(hasEligibleDealBoxes(state)).toBe(true);
  });

  it('bet 7 with min 5 shows multiple-of-min message', () => {
    const { state, boxId } = tableWithBoxStake([2, 5]);
    expect(getStakeBetValidationMessage(state, boxId)).toMatch(/multiple of 5/i);
    expect(hasEligibleDealBoxes(state)).toBe(false);
  });

  it('valid bet clears previous invalid message', () => {
    const invalid = tableWithBoxStake([2, 5]);
    expect(getStakeBetValidationMessage(invalid.state, invalid.boxId)).toMatch(/multiple of 5/i);
    const valid = tableWithBoxStake([10]);
    expect(getStakeBetValidationMessage(valid.state, valid.boxId)).toBeNull();
  });
});
