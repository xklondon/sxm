import type { GameState } from '../../types';
import { log } from '../../utils/logger';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { addPlayer, mergeSessionUpdate } from './session';
import { allocateChipsToBankrollOwner } from './allocation';
import { findPersonPlayerIdByController } from './bankroll';
import { buildTablePeopleRows } from './tablePeople';
import { syncPlayerOrderAndAssignments } from './playerAssignment';
import { getStartingChipsEachSeat } from './tokens';

function resolveOwnerName(state: GameState): string {
  return (
    state.tableMeta.owner?.ownerName?.trim() ||
    state.tableMeta.controllerName.trim()
  );
}

export function logThisTableRowsAfterSetup(state: GameState, context: string): void {
  const rows = buildTablePeopleRows(state).map((row) => ({
    personId: row.personId,
    name: row.label,
    status: row.status,
    available: row.available,
    betting: row.betting,
    boxes: [...row.runningBoxSlots, ...row.coBoxSlots],
    kind: row.kind,
  }));
  log.info('thisTableRowsAfterSetup', { context, rows });
}

/**
 * Ensure table owner has a person bankroll with starting seat chips allocated once.
 * Called at Start playing — owner appears in This Table before any box claim.
 */
export function ensureTableOwnerPersonBankroll(state: GameState): GameState {
  const ownerName = resolveOwnerName(state);
  if (!ownerName) {
    return state;
  }

  const seatChips = getStartingChipsEachSeat(state);
  let next = state;
  let personId = next.tableMeta.ownerPersonId ?? findPersonPlayerIdByController(next, ownerName);
  let created = false;

  if (!personId || !next.players[personId]) {
    const personSpl = addPlayer(next.session, next.players, next.ledger, {
      displayName: ownerName,
      controllerName: ownerName,
      role: 'person',
      startingChips: 0,
    });
    next = mergeSessionUpdate(next, personSpl);
    personId = personSpl.session.playerIds[personSpl.session.playerIds.length - 1]!;
    created = true;
    log.info('ownerBankrollCreated', {
      personId,
      ownerName,
      startingChipsEachSeat: seatChips,
    });
  }

  const balanceBefore = derivePlayerBalanceFromLedger(personId, next.ledger);
  if (balanceBefore === 0 && seatChips > 0) {
    next = allocateChipsToBankrollOwner(next, {
      bankrollOwnerId: personId,
      amount: seatChips,
      reason: 'initial-player',
      source: 'setup',
    });
    log.info('ownerInitialAllocation', {
      personId,
      ownerName,
      chips: seatChips,
      balanceAfter: derivePlayerBalanceFromLedger(personId, next.ledger),
    });
  }

  if (next.tableMeta.ownerPersonId !== personId) {
    next = {
      ...next,
      tableMeta: { ...next.tableMeta, ownerPersonId: personId },
    };
  }

  if (created || balanceBefore === 0) {
    logThisTableRowsAfterSetup(next, 'ensureTableOwnerPersonBankroll');
  }

  return syncPlayerOrderAndAssignments(next);
}
