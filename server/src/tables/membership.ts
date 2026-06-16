import type { GameState } from '../../../src/types/index.js';
import type { PeopleService } from '../people/service.js';
import type { Store, TableMemberRecord, TableRecord, UserRecord } from '../store/types.js';
import { isSeatedPersonAtTable } from '../../../src/engine/session/playerAssignment.js';
import { TableMembershipError, TableNotFoundError } from './errors.js';

export interface ResolvedTableMember {
  userId: string;
  personId: string;
  role: TableMemberRecord['role'];
  record: TableMemberRecord;
}

/** Canonical session user id for table routes (email wins when JWT user id is stale). */
export async function resolveCanonicalTableUserId(
  people: PeopleService,
  userId: string,
  sessionEmail: string | undefined,
  context: string,
): Promise<UserRecord> {
  return people.resolveSessionUser(userId, sessionEmail, context);
}

function normalizeLabel(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

function findPersonIdForUserInState(state: GameState, user: UserRecord, sessionEmail?: string): string | null {
  const email = normalizeLabel(sessionEmail ?? user.email);
  const ownerEmail = normalizeLabel(state.tableMeta.owner?.ownerEmail);
  const ownerPersonId = state.tableMeta.ownerPersonId;
  if (ownerPersonId && ownerEmail && ownerEmail === email && state.players[ownerPersonId]) {
    return ownerPersonId;
  }

  const userLabel = normalizeLabel(user.displayName || user.email.split('@')[0]);
  for (const personId of state.session.playerIds) {
    const player = state.players[personId];
    if (!player || player.role === 'box') {
      continue;
    }
    if (!isSeatedPersonAtTable(state, personId)) {
      continue;
    }
    const personLabel = normalizeLabel(player.controllerName || player.displayName);
    if (userLabel && personLabel && personLabel === userLabel) {
      return personId;
    }
  }

  for (const slot of state.tableMeta.boxSlots) {
    const nativePersonId = slot.nativeAssignedPersonId;
    if (!nativePersonId || !state.players[nativePersonId]) {
      continue;
    }
    const player = state.players[nativePersonId];
    const personLabel = normalizeLabel(player?.controllerName || player?.displayName);
    if (userLabel && personLabel && personLabel === userLabel) {
      return nativePersonId;
    }
  }

  return null;
}

function syncMemberPersonId(
  table: TableRecord,
  member: TableMemberRecord,
  user: UserRecord,
  sessionEmail?: string,
): TableMemberRecord {
  const state = table.state;
  if (member.personId && state.players[member.personId] && isSeatedPersonAtTable(state, member.personId)) {
    if (table.hostUserId === user.id && state.tableMeta.ownerPersonId) {
      const ownerId = state.tableMeta.ownerPersonId;
      if (state.players[ownerId] && member.personId !== ownerId) {
        return { ...member, personId: ownerId };
      }
    }
    return member;
  }

  const repairedPersonId = findPersonIdForUserInState(state, user, sessionEmail);
  if (repairedPersonId) {
    return { ...member, personId: repairedPersonId };
  }

  return member;
}

function buildHostMember(table: TableRecord, user: UserRecord): TableMemberRecord | null {
  const ownerPersonId = table.state.tableMeta.ownerPersonId;
  if (!ownerPersonId || !table.state.players[ownerPersonId]) {
    return null;
  }
  return {
    tableId: table.id,
    userId: user.id,
    personId: ownerPersonId,
    role: 'host',
    joinedAt: new Date().toISOString(),
  };
}

function buildPlayerMember(
  table: TableRecord,
  user: UserRecord,
  sessionEmail?: string,
): TableMemberRecord | null {
  const personId = findPersonIdForUserInState(table.state, user, sessionEmail);
  if (!personId) {
    return null;
  }
  return {
    tableId: table.id,
    userId: user.id,
    personId,
    role: 'player',
    joinedAt: new Date().toISOString(),
  };
}

export function upsertTableMember(store: Store, member: TableMemberRecord): TableMemberRecord {
  const existing = store.getMember(member.tableId, member.userId);
  if (!existing) {
    store.addMember(member);
    return member;
  }
  if (
    existing.personId === member.personId &&
    existing.role === member.role &&
    existing.tableId === member.tableId
  ) {
    return existing;
  }
  const next: TableMemberRecord = {
    ...existing,
    personId: member.personId,
    role: member.role,
  };
  store.upsertMember(next);
  return next;
}

/**
 * Authoritative table member for an authenticated session.
 * Repairs missing host rows and re-syncs personId when game state drifted.
 */
export async function ensureTableMember(params: {
  store: Store;
  people: PeopleService;
  tableId: string;
  userId: string;
  sessionEmail?: string;
  context?: string;
}): Promise<ResolvedTableMember> {
  const context = params.context ?? 'table member lookup';
  const user = await resolveCanonicalTableUserId(
    params.people,
    params.userId,
    params.sessionEmail,
    context,
  );
  const table = params.store.getTable(params.tableId);
  if (!table) {
    throw new TableNotFoundError();
  }

  let member = params.store.getMember(params.tableId, user.id);
  if (!member) {
    if (table.hostUserId === user.id) {
      member = buildHostMember(table, user);
    } else {
      member = buildPlayerMember(table, user, params.sessionEmail);
    }
    if (member) {
      member = upsertTableMember(params.store, member);
    }
  }

  if (!member) {
    throw new TableMembershipError();
  }

  const synced = syncMemberPersonId(table, member, user, params.sessionEmail);
  if (synced.personId !== member.personId) {
    member = upsertTableMember(params.store, synced);
  }

  if (!table.state.players[member.personId]) {
    throw new TableMembershipError('Not a member of this table');
  }

  return {
    userId: user.id,
    personId: member.personId,
    role: member.role,
    record: member,
  };
}
