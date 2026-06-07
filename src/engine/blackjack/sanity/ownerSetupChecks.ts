import {
  buildTableBankRow,
  buildTablePeopleRows,
} from '../../session/tablePeople';
import {
  getAvailableChipsForBankrollOwner,
  getLedgerBalanceForBankrollOwner,
  getTotalBettingExposureForBankrollOwner,
} from '../../session/bankroll';
import { check, type SanitySuiteResult } from './types';
import { boxPlayerId, tableAfterStartPlaying } from './fixtures';
import { claimBoxSlot } from '../../session/boxOps';

function setOpenStake(
  state: ReturnType<typeof tableAfterStartPlaying>,
  boxId: string,
  amount: number,
) {
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

export function runOwnerSetupSanityChecks(): SanitySuiteResult {
  const results = [];

  let state = tableAfterStartPlaying(500);
  const ownerId = state.tableMeta.ownerPersonId!;
  const people = buildTablePeopleRows(state);
  const ownerRow = people.find((p) => p.personId === ownerId);
  const bank = buildTableBankRow(state);

  results.push(check('owner appears in This Table rows', Boolean(ownerRow?.showBalance)));
  results.push(
    check(
      'owner available equals starting seat chips',
      ownerRow?.available === 500,
      `available=${ownerRow?.available}`,
    ),
  );
  results.push(
    check(
      'owner has native box 1 assigned before extra claims',
      ownerRow?.assignedBox === 1 && (ownerRow?.runningBoxSlots.length ?? 0) === 0,
      `assigned=${ownerRow?.assignedBox} running=${ownerRow?.runningBoxSlots.join(',')}`,
    ),
  );
  results.push(
    check(
      'bank balance after setup',
      bank?.balance === 500,
      `bank=${bank?.balance}`,
    ),
  );

  const balBeforeClaim = getLedgerBalanceForBankrollOwner(state, ownerId);
  state = claimBoxSlot(state, 1);
  const balAfterClaim = getLedgerBalanceForBankrollOwner(state, ownerId);
  results.push(
    check(
      'owner claim box 1: no second allocation',
      balAfterClaim === balBeforeClaim && balAfterClaim === 500,
      `before=${balBeforeClaim} after=${balAfterClaim}`,
    ),
  );
  results.push(
    check(
      'owner available still 500 after box 1',
      getAvailableChipsForBankrollOwner(state, ownerId) === 500,
    ),
  );

  state = claimBoxSlot(state, 2);
  state = claimBoxSlot(state, 3);
  const ownerRowAfterClaims = buildTablePeopleRows(state).find((p) => p.personId === ownerId);
  results.push(
    check(
      'claimed boxes without stake do not appear in This Table running list',
      (ownerRowAfterClaims?.runningBoxSlots.length ?? 0) === 0 &&
        (ownerRowAfterClaims?.coBoxSlots.length ?? 0) === 0,
      `running=${ownerRowAfterClaims?.runningBoxSlots.join(',')} co=${ownerRowAfterClaims?.coBoxSlots.join(',')}`,
    ),
  );
  results.push(
    check(
      'owner still 500 after three boxes',
      getLedgerBalanceForBankrollOwner(state, ownerId) === 500,
    ),
  );

  const b1 = boxPlayerId(state, 1)!;
  const b2 = boxPlayerId(state, 2)!;
  const b3 = boxPlayerId(state, 3)!;
  state = setOpenStake(state, b1, 20);
  state = setOpenStake(state, b2, 30);
  state = setOpenStake(state, b3, 50);
  results.push(
    check(
      'owner betting exposure sums stakes',
      getTotalBettingExposureForBankrollOwner(state, ownerId) === 100,
    ),
  );
  results.push(
    check(
      'owner available after bets',
      getAvailableChipsForBankrollOwner(state, ownerId) === 400,
      `available=${getAvailableChipsForBankrollOwner(state, ownerId)}`,
    ),
  );

  state = tableAfterStartPlaying(777);
  const customOwnerId = state.tableMeta.ownerPersonId!;
  results.push(
    check(
      'starting chips 777 not overridden in tableMeta',
      state.tableMeta.startingChipsEachSeat === 777 &&
        state.tableMeta.startingChipsBank === 777,
      `seat=${state.tableMeta.startingChipsEachSeat} bank=${state.tableMeta.startingChipsBank}`,
    ),
  );
  results.push(
    check(
      'owner available 777 after custom setup',
      getAvailableChipsForBankrollOwner(state, customOwnerId) === 777,
    ),
  );
  results.push(
    check(
      'bank balance 777 when bank defaults to seat',
      buildTableBankRow(state)?.balance === 777,
    ),
  );

  return { passed: results.every((r) => r.passed), results };
}
