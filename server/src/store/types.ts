import type { GameState } from '../../../src/types/index.js';

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
  createUser(email: string, displayName: string): UserRecord;
  getUserByEmail(email: string): UserRecord | null;
  getUserById(id: string): UserRecord | null;

  createMagicLink(email: string, token: string, expiresAt: string): MagicLinkRecord;
  getMagicLink(token: string): MagicLinkRecord | null;
  markMagicLinkUsed(token: string): void;
  lastMagicLinkRequestAt(email: string): string | null;
  setLastMagicLinkRequestAt(email: string, at: string): void;

  createTable(record: TableRecord): void;
  getTable(id: string): TableRecord | null;
  updateTable(id: string, state: GameState, version: number): void;

  addMember(member: TableMemberRecord): void;
  getMembers(tableId: string): TableMemberRecord[];
  getMember(tableId: string, userId: string): TableMemberRecord | null;

  createInvite(invite: TableInviteRecord): void;
  getInvite(tableId: string, inviteId: string): TableInviteRecord | null;
  getInviteByToken(token: string): TableInviteRecord | null;
  updateInviteStatus(tableId: string, inviteId: string, status: TableInviteRecord['status']): void;

  createPerson(record: PersonRecord): PersonRecord;
  getPersonById(id: string): PersonRecord | null;
  getPersonByEmail(email: string): PersonRecord | null;
  getPersonByUserId(userId: string): PersonRecord | null;
  listPeople(): PersonRecord[];
  updatePerson(id: string, patches: Partial<PersonRecord>): PersonRecord | null;

  appendAuditLog(entry: AuditLogRecord): void;
  listAuditLogs(limit?: number): AuditLogRecord[];

  getRuntimeStats(): {
    tables: number;
    users: number;
    people: number;
    invites: number;
  };
}
