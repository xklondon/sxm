import type { GameState } from '../../../src/types/index.js';

export type MaybePromise<T> = T | Promise<T>;
export type StoreType = 'memory' | 'postgres';

export type PersonStatus = 'invited' | 'active' | 'disabled';
export type PersonRole = 'root' | 'admin' | 'host' | 'player' | 'guest';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface MagicLinkRecord {
  token: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface TableInviteRecord {
  id: string;
  tableId: string;
  token: string;
  invitedEmail: string;
  invitedName: string;
  inviterUserId: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  expiresAt: string;
}

export interface TableMemberRecord {
  tableId: string;
  userId: string;
  personId: string;
  role: 'host' | 'player';
  joinedAt: string;
}

export interface TableRecord {
  id: string;
  hostUserId: string;
  name: string;
  state: GameState;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonRecord {
  id: string;
  email: string;
  displayName: string;
  status: PersonStatus;
  role: PersonRole;
  canLogin: boolean;
  canOwnTables: boolean;
  canPlay: boolean;
  canInvite: boolean;
  createdAt: string;
  invitedAt: string | null;
  invitedBy: string | null;
  lastLoginAt: string | null;
  userId: string | null;
}

export interface AuditLogRecord {
  id: string;
  at: string;
  actorEmail: string;
  action: string;
  targetPersonId: string;
  detail: string;
}

export interface Store {
  createUser(email: string, displayName: string): MaybePromise<UserRecord>;
  getUserByEmail(email: string): MaybePromise<UserRecord | null>;
  getUserById(id: string): MaybePromise<UserRecord | null>;

  createMagicLink(email: string, token: string, expiresAt: string): MaybePromise<MagicLinkRecord>;
  getMagicLink(token: string): MaybePromise<MagicLinkRecord | null>;
  markMagicLinkUsed(token: string): MaybePromise<void>;
  lastMagicLinkRequestAt(email: string): MaybePromise<string | null>;
  setLastMagicLinkRequestAt(email: string, at: string): MaybePromise<void>;

  createTable(record: TableRecord): void;
  getTable(id: string): TableRecord | null;
  updateTable(id: string, state: GameState, version: number): void;

  addMember(member: TableMemberRecord): void;
  getMembers(tableId: string): TableMemberRecord[];
  getMember(tableId: string, userId: string): TableMemberRecord | null;

  createInvite(invite: TableInviteRecord): MaybePromise<void>;
  getInvite(tableId: string, inviteId: string): MaybePromise<TableInviteRecord | null>;
  getInviteByToken(token: string): MaybePromise<TableInviteRecord | null>;
  updateInviteStatus(
    tableId: string,
    inviteId: string,
    status: TableInviteRecord['status'],
  ): MaybePromise<void>;

  createPerson(record: PersonRecord): MaybePromise<PersonRecord>;
  getPersonById(id: string): MaybePromise<PersonRecord | null>;
  getPersonByEmail(email: string): MaybePromise<PersonRecord | null>;
  getPersonByUserId(userId: string): MaybePromise<PersonRecord | null>;
  listPeople(): MaybePromise<PersonRecord[]>;
  updatePerson(id: string, patches: Partial<PersonRecord>): MaybePromise<PersonRecord | null>;

  appendAuditLog(entry: AuditLogRecord): MaybePromise<void>;
  listAuditLogs(limit?: number): MaybePromise<AuditLogRecord[]>;

  getRuntimeStats(): MaybePromise<{
    tables: number;
    users: number;
    people: number;
    invites: number;
  }>;
}
