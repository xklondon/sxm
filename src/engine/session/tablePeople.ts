import type { GameState } from '../../types';
import type { TableInviteRecord } from '../../types/invites';
import type { Player } from '../../types/player';
import { log } from '../../utils/logger';
import { isTableOwner } from './tokens';
import {
  findPersonPlayerIdByController,
  getAvailableChipsForBankrollOwner,
  getLedgerBalanceForBankrollOwner,
  getTotalBettingExposureForBankrollOwner,
  getBoxSlotNumbersForBankrollOwner,
  listPersonBankrollOwnerIds,
} from './bankroll';
import {
  getEffectivePlayerOrder,
  getAssignedSlotForPerson,
} from './playerAssignment';

export type TablePersonStatus = 'owner' | 'active' | 'invited' | 'pending';

export interface TableBankRow {
  participantId: string;
  bankName: string;
  balance: number;
  available: number;
  ledgerBalance: number;
}

export interface TablePersonRow {
  key: string;
  personId: string | null;
  label: string;
  status: TablePersonStatus;
  available: number;
  betting: number;
  ledgerBalance: number;
  boxSlots: number[];
  assignedBox: number | null;
  kind: 'person' | 'invite';
  showBalance: boolean;
}

function inviteStatusLabel(invite: TableInviteRecord): TablePersonStatus {
  if (invite.inviteStatus === 'pending') {
    return 'pending';
  }
  return 'invited';
}

function personStatus(state: GameState, personId: string, label: string): TablePersonStatus {
  if (isTableOwner(state, label)) {
    return 'owner';
  }
  const boxSlots = getBoxSlotNumbersForBankrollOwner(state, personId);
  if (boxSlots.length > 0) {
    return 'active';
  }
  return 'active';
}

function bankDisplayName(bank: Player): string {
  const name = bank.displayName.trim();
  if (bank.playerType === 'virtual') {
    return name.replace(/^Bank\s+/i, '') || 'Bot';
  }
  return bank.controllerName?.trim() || name;
}

function collectPersonBankrollIds(state: GameState): string[] {
  const ids = new Set(listPersonBankrollOwnerIds(state));
  const ownerPersonId = state.tableMeta.ownerPersonId;
  if (ownerPersonId) {
    ids.add(ownerPersonId);
  }
  const ownerName = state.tableMeta.owner?.ownerName?.trim();
  if (ownerName) {
    const byOwner = findPersonPlayerIdByController(state, ownerName);
    if (byOwner) {
      ids.add(byOwner);
    }
  }
  const controller = state.tableMeta.controllerName.trim();
  if (controller) {
    const byController = findPersonPlayerIdByController(state, controller);
    if (byController) {
      ids.add(byController);
    }
  }
  return [...ids];
}

export function logThisTablePlayerRow(row: TablePersonRow): void {
  if (row.kind !== 'person' || !row.personId) {
    return;
  }
  log.info('thisTablePlayerRow', {
    personId: row.personId,
    name: row.label,
    ledgerBalance: row.ledgerBalance,
    exposure: row.betting,
    available: row.available,
    betting: row.betting,
    boxes: row.boxSlots,
  });
}

export function logThisTableBalanceDebug(state: GameState): void {
  const bank = buildTableBankRow(state);
  if (bank) {
    log.info('thisTableBalanceDebug', {
      personId: bank.participantId,
      role: 'bank',
      ledgerBalance: bank.ledgerBalance,
      exposure: 0,
      available: bank.available,
      ledgerEntriesForPerson: state.ledger.entries
        .filter((e) => e.playerId === bank.participantId)
        .map((e) => ({ type: e.entryType, amount: e.amount, balanceAfter: e.balanceAfter })),
    });
  }
  for (const row of buildTablePeopleRows(state)) {
    logThisTablePlayerRow(row);
  }
}

/** Bank row for This Table panel. */
export function buildTableBankRow(state: GameState): TableBankRow | null {
  const bankId = state.session.bankPlayerId;
  if (!bankId || !state.players[bankId]) {
    return null;
  }
  const bank = state.players[bankId];
  const ledgerBalance = getLedgerBalanceForBankrollOwner(state, bankId);
  const available = getAvailableChipsForBankrollOwner(state, bankId);
  return {
    participantId: bankId,
    bankName: bankDisplayName(bank),
    balance: ledgerBalance,
    available,
    ledgerBalance,
  };
}

export function buildTablePeopleRows(state: GameState): TablePersonRow[] {
  const rows: TablePersonRow[] = [];
  const seenLabels = new Set<string>();
  const orderedIds = getEffectivePlayerOrder(state);
  const allIds = collectPersonBankrollIds(state);
  const personIds = [
    ...orderedIds,
    ...allIds.filter((id) => !orderedIds.includes(id)),
  ];

  for (const personId of personIds) {
    const person = state.players[personId];
    if (!person) {
      continue;
    }
    const label = person.controllerName?.trim() || person.displayName;
    const labelKey = label.toLowerCase();
    if (seenLabels.has(labelKey)) {
      continue;
    }
    seenLabels.add(labelKey);

    const ownerName = state.tableMeta.owner?.ownerName?.trim();
    let status = personStatus(state, personId, label);
    if (ownerName && label.toLowerCase() === ownerName.toLowerCase()) {
      status = 'owner';
    } else if (isTableOwner(state, label)) {
      status = 'owner';
    }

    const boxSlots = getBoxSlotNumbersForBankrollOwner(state, personId);
    const assignedBox = getAssignedSlotForPerson(state, personId);
    const ledgerBalance = getLedgerBalanceForBankrollOwner(state, personId);
    const betting = getTotalBettingExposureForBankrollOwner(state, personId);
    const available = getAvailableChipsForBankrollOwner(state, personId);

    rows.push({
      key: personId,
      personId,
      label,
      status,
      available,
      betting,
      ledgerBalance,
      boxSlots,
      assignedBox,
      kind: 'person',
      showBalance: true,
    });
  }

  for (const invite of state.tableMeta.invites) {
    const inviteLabel = invite.invitedName?.trim() || invite.invitedEmail;
    const labelKey = inviteLabel.toLowerCase();
    if (seenLabels.has(labelKey)) {
      continue;
    }
    seenLabels.add(labelKey);
    rows.push({
      key: invite.inviteId,
      personId: null,
      label: inviteLabel,
      status: inviteStatusLabel(invite),
      available: 0,
      betting: 0,
      ledgerBalance: 0,
      boxSlots: [],
      assignedBox: null,
      kind: 'invite',
      showBalance: false,
    });
  }

  return rows;
}
