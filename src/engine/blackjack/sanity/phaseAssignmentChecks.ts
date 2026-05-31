import { addChipToBoxStake } from '../stakes';
import { canStartCards } from '../protocol';
import { getEligibleDealBoxes } from '../dealEligibility';
import { shuffleToStartOnState } from '../gameState';
import {
  getAssignedSlotForPerson,
  getCallerPersonIdForBox,
  movePlayerInOrder,
} from '../../session/playerAssignment';
import { addPlayer, mergeSessionUpdate } from '../../session/session';
import { registerPassiveBet } from '../../session/boxOps';
import { claimBoxSlot } from '../../session/boxOps';
import { check, type SanitySuiteResult } from './types';
import { boxPlayerId, tableAfterStartPlaying } from './fixtures';

function stake(state: ReturnType<typeof tableAfterStartPlaying>, boxId: string, amount: number) {
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes: {
        ...state.tableMeta.boxStakes,
        [boxId]: { amount, chips: [], confirmed: true },
      },
    },
  };
}

export function runPhaseAssignmentSanityChecks(): SanitySuiteResult {
  const results = [];

  let state = tableAfterStartPlaying(500);
  const box1 = boxPlayerId(state, 1)!;
  state = stake(state, box1, 5);
  state = shuffleToStartOnState(state);
  results.push(check('deal allowed with confirmed min bet', canStartCards(state)));
  results.push(
    check(
      'eligible box includes box 1',
      getEligibleDealBoxes(state).includes(box1),
      `eligible=${getEligibleDealBoxes(state).join(',')}`,
    ),
  );

  state = tableAfterStartPlaying(500);
  for (let slot = 2; slot <= 5; slot += 1) {
    state = claimBoxSlot(state, slot);
  }
  const amounts = [5, 5, 10, 10, 50];
  const boxIds: string[] = [];
  for (let slot = 1; slot <= 5; slot += 1) {
    const id = boxPlayerId(state, slot)!;
    boxIds.push(id);
    state = stake(state, id, amounts[slot - 1]!);
  }
  state = shuffleToStartOnState(state);
  const eligible = getEligibleDealBoxes(state);
  results.push(
    check(
      'deal deals to all five staked boxes',
      boxIds.every((id) => eligible.includes(id)) && eligible.length === 5,
      `eligible=${eligible.length}`,
    ),
  );

  state = tableAfterStartPlaying(500);
  results.push(
    check(
      'owner assigned to box 1',
      getAssignedSlotForPerson(state, state.tableMeta.ownerPersonId!) === 1,
    ),
  );

  state = tableAfterStartPlaying(500);
  const orderOwnerId = state.tableMeta.ownerPersonId!;
  const personSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'Bob',
    controllerName: 'Bob',
    role: 'person',
    startingChips: 0,
  });
  state = mergeSessionUpdate(state, personSpl);
  const bobId = personSpl.session.playerIds[personSpl.session.playerIds.length - 1]!;
  state = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      playerOrder: [orderOwnerId, bobId],
      assignedBoxByPersonId: { [orderOwnerId]: 1, [bobId]: 2 },
    },
  };
  results.push(
    check(
      'second player assigned box 2',
      getAssignedSlotForPerson(state, bobId) === 2,
    ),
  );

  state = movePlayerInOrder(state, bobId, 'up');
  results.push(
    check(
      'reorder moves bob to box 1',
      getAssignedSlotForPerson(state, bobId) === 1 &&
        getAssignedSlotForPerson(state, orderOwnerId) === 2,
      `bob=${getAssignedSlotForPerson(state, bobId)} owner=${getAssignedSlotForPerson(state, orderOwnerId)}`,
    ),
  );

  state = tableAfterStartPlaying(500);
  const passiveOwnerId = state.tableMeta.ownerPersonId!;
  const nativeBox = boxPlayerId(state, 1)!;
  state = registerPassiveBet(state, nativeBox, 'Bob');
  state = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes: {
        ...state.tableMeta.boxStakes,
        [nativeBox]: { amount: 5, chips: [], confirmed: true, callerPersonId: passiveOwnerId },
      },
    },
  };
  results.push(
    check(
      'passive bettor is not caller on native box',
      getCallerPersonIdForBox(state, nativeBox) === passiveOwnerId,
      `caller=${getCallerPersonIdForBox(state, nativeBox)}`,
    ),
  );

  state = tableAfterStartPlaying(500);
  const freeOwnerId = state.tableMeta.ownerPersonId!;
  const freeSlot = 3;
  let freeState = state;
  const freeSpl = addPlayer(freeState.session, freeState.players, freeState.ledger, {
    displayName: 'Box 3',
    controllerName: 'Alice',
    role: 'box',
    bankrollOwnerId: freeOwnerId,
    startingChips: 0,
  });
  freeState = mergeSessionUpdate(freeState, freeSpl);
  const freeBoxId = freeSpl.session.playerIds[freeSpl.session.playerIds.length - 1]!;
  const freeSlots = freeState.tableMeta.boxSlots.map((s) =>
    s.slotNumber === freeSlot
      ? { ...s, playerId: freeBoxId, bankrollOwnerId: freeOwnerId, nativeAssignedPersonId: null, callerPersonId: null }
      : s,
  );
  freeState = {
    ...freeState,
    session: {
      ...freeState.session,
      boxSlotNumbers: { ...freeState.session.boxSlotNumbers, [freeBoxId]: freeSlot },
    },
    tableMeta: { ...freeState.tableMeta, boxSlots: freeSlots },
  };
  freeState = addChipToBoxStake(freeState, freeBoxId, 10, freeOwnerId);
  results.push(
    check(
      'free box caller is first staking player',
      getCallerPersonIdForBox(freeState, freeBoxId) === freeOwnerId,
    ),
  );

  state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 2);
  const soloBox1 = boxPlayerId(state, 1)!;
  const soloBox2 = boxPlayerId(state, 2)!;
  state = stake(state, soloBox1, 5);
  state = stake(state, soloBox2, 10);
  state = shuffleToStartOnState(state);
  results.push(
    check(
      'single player can call multiple boxes',
      getEligibleDealBoxes(state).length === 2,
    ),
  );

  return { passed: results.every((r) => r.passed), results };
}
