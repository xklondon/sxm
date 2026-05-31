import { claimBoxSlot, setControllerName } from '../../session/boxOps';
import { ALL_BOXES_RECIPIENT, assignChips } from '../../session/tokens';
import { derivePlayerBalanceFromLedger } from '../../ledger/ledger';
import { buildTablePeopleRows } from '../../session/tablePeople';
import {
  findPersonPlayerIdByController,
  getAvailableChipsForBankrollOwner,
  getLedgerBalanceForBankrollOwner,
  getTotalBettingExposureForBankrollOwner,
  listPersonBankrollOwnerIds,
} from '../../session/bankroll';
import { check, type SanitySuiteResult } from './types';
import {
  baseTestTable,
  boxPlayerId,
  tableWithClaimedBox,
  tableWithTwoBoxesSamePerson,
} from './fixtures';

function setOpenStake(
  state: import('../../../types').GameState,
  boxPlayerId: string,
  amount: number,
): import('../../../types').GameState {
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes: {
        ...state.tableMeta.boxStakes,
        [boxPlayerId]: { amount, chips: [], confirmed: true },
      },
    },
  };
}
function isBoxPlayerId(state: import('../../../types').GameState, playerId: string): boolean {
  return state.tableMeta.boxSlots.some((s) => s.playerId === playerId);
}

export function runAllocationSanityChecks(): SanitySuiteResult {
  const results = [];

  let state = baseTestTable();
  const bankId = state.session.bankPlayerId!;
  const bankBal = derivePlayerBalanceFromLedger(bankId, state.ledger);
  results.push(
    check(
      'setup allocates bank once',
      bankBal === 500,
      `bank ledger=${bankBal}`,
    ),
  );

  state = tableWithClaimedBox(1);
  const personId = findPersonPlayerIdByController(state, 'Alice');
  if (personId) {
    const bal = getLedgerBalanceForBankrollOwner(state, personId);
    results.push(
      check(
        'owner bankroll allocated at setup; claim does not add chips',
        bal === 500,
        `person balance=${bal}`,
      ),
    );
  } else {
    results.push(check('owner bankroll allocated at setup; claim does not add chips', false, 'no person id'));
  }

  state = baseTestTable();
  const setupOwnerId = state.tableMeta.ownerPersonId!;
  const setupPeople = buildTablePeopleRows(state);
  results.push(
    check(
      'owner visible before box claim',
      setupPeople.some((p) => p.personId === setupOwnerId && p.available === 500),
    ),
  );

  state = tableWithClaimedBox(1);
  state = claimBoxSlot(state, 2);
  state = claimBoxSlot(state, 3);
  const kId = findPersonPlayerIdByController(state, 'Alice');
  if (kId) {
    const bal = getLedgerBalanceForBankrollOwner(state, kId);
    results.push(
      check(
        'same person multiple boxes no extra allocation',
        bal === 500,
        `balance=${bal}`,
      ),
    );
  } else {
    results.push(check('same person multiple boxes no extra allocation', false));
  }

  state = tableWithClaimedBox(1);
  state = claimBoxSlot(state, 2);
  state = claimBoxSlot(state, 3);
  const ownerId = findPersonPlayerIdByController(state, 'Alice')!;
  const b1 = boxPlayerId(state, 1)!;
  const b2 = boxPlayerId(state, 2)!;
  const b3 = boxPlayerId(state, 3)!;
  state = setOpenStake(state, b1, 20);
  state = setOpenStake(state, b2, 30);
  state = setOpenStake(state, b3, 50);
  const exposure = getTotalBettingExposureForBankrollOwner(state, ownerId);
  const available = getAvailableChipsForBankrollOwner(state, ownerId);
  results.push(
    check(
      'betting multiple boxes: exposure sums stakes',
      exposure === 100,
      `exposure=${exposure}`,
    ),
  );
  results.push(
    check(
      'betting multiple boxes: available is ledger minus exposure',
      available === 400,
      `available=${available}`,
    ),
  );

  state = tableWithClaimedBox(1);
  state = claimBoxSlot(state, 2);
  state = claimBoxSlot(state, 3);
  const kPerson = findPersonPlayerIdByController(state, 'Alice')!;
  const beforeAssign = getLedgerBalanceForBankrollOwner(state, kPerson);
  state = assignChips(state, kPerson, 100, 'top-up');
  const afterAssign = getLedgerBalanceForBankrollOwner(state, kPerson);
  results.push(
    check(
      'assign chips to person once (not per box)',
      afterAssign - beforeAssign === 100 && afterAssign === 600,
      `before=${beforeAssign} after=${afterAssign}`,
    ),
  );

  let annaState = baseTestTable();
  annaState = setControllerName(annaState, 'Anna');
  annaState = claimBoxSlot(annaState, 4);
  annaState = setControllerName(annaState, 'Alice');
  annaState = claimBoxSlot(annaState, 2);
  annaState = claimBoxSlot(annaState, 3);
  const aliceId = findPersonPlayerIdByController(annaState, 'Alice')!;
  const annaId = findPersonPlayerIdByController(annaState, 'Anna')!;
  const aliceBefore = getLedgerBalanceForBankrollOwner(annaState, aliceId);
  const annaBefore = getLedgerBalanceForBankrollOwner(annaState, annaId);
  annaState = assignChips(annaState, ALL_BOXES_RECIPIENT, 100, 'top-up');
  const aliceAfter = getLedgerBalanceForBankrollOwner(annaState, aliceId);
  const annaAfter = getLedgerBalanceForBankrollOwner(annaState, annaId);
  results.push(
    check(
      'assign all persons once each',
      aliceAfter - aliceBefore === 100 &&
        annaAfter - annaBefore === 100 &&
        aliceAfter === 600 &&
        annaAfter === 600,
      `alice ${aliceBefore}->${aliceAfter} anna ${annaBefore}->${annaAfter}`,
    ),
  );

  state = tableWithTwoBoxesSamePerson();
  const boxIds = state.tableMeta.boxSlots
    .map((s) => s.playerId)
    .filter((id): id is string => id !== null);
  const badEntries = state.ledger.entries.filter(
    (e) =>
      (e.entryType === 'buy-in' || e.entryType === 'manual-adjustment') &&
      boxIds.includes(e.playerId),
  );
  results.push(
    check(
      'no box ledger allocations for buy-in/top-up',
      badEntries.length === 0,
      badEntries.length > 0 ? `offending=${badEntries.map((e) => e.playerId).join(',')}` : undefined,
    ),
  );

  const personIds = listPersonBankrollOwnerIds(state);
  results.push(
    check(
      'listPersonBankrollOwnerIds returns one id for multi-box person',
      personIds.length === 1,
      `count=${personIds.length}`,
    ),
  );

  for (const boxId of boxIds) {
    results.push(
      check(
        `box ${boxId.slice(0, 6)} is not a bankroll target`,
        isBoxPlayerId(state, boxId) && !personIds.includes(boxId),
      ),
    );
  }

  return { passed: results.every((r) => r.passed), results };
}
