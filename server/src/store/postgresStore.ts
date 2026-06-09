import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { GameState } from '../../../src/types/index.js';
import { createMemoryStore } from './memoryStore.js';
import type {
  AuditLogRecord,
  MagicLinkRecord,
  PersonRecord,
  Store,
  TableInviteRecord,
  TableMemberRecord,
  TableRecord,
  UserRecord,
} from './types.js';

function toUser(row: {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPerson(row: {
  id: string;
  email: string;
  displayName: string;
  status: string;
  role: string;
  canLogin: boolean;
  canOwnTables: boolean;
  canPlay: boolean;
  canInvite: boolean;
  createdAt: Date;
  invitedAt: Date | null;
  invitedBy: string | null;
  lastLoginAt: Date | null;
  userId: string | null;
}): PersonRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    status: row.status as PersonRecord['status'],
    role: row.role as PersonRecord['role'],
    canLogin: row.canLogin,
    canOwnTables: row.canOwnTables,
    canPlay: row.canPlay,
    canInvite: row.canInvite,
    createdAt: row.createdAt.toISOString(),
    invitedAt: row.invitedAt?.toISOString() ?? null,
    invitedBy: row.invitedBy,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    userId: row.userId,
  };
}

function toMagicLink(row: {
  token: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}): MagicLinkRecord {
  return {
    token: row.token,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    usedAt: row.usedAt?.toISOString() ?? null,
  };
}

function toInvite(row: {
  id: string;
  tableId: string;
  token: string;
  invitedEmail: string;
  invitedName: string;
  inviterUserId: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
}): TableInviteRecord {
  return {
    id: row.id,
    tableId: row.tableId,
    token: row.token,
    invitedEmail: row.invitedEmail,
    invitedName: row.invitedName,
    inviterUserId: row.inviterUserId,
    status: row.status as TableInviteRecord['status'],
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

function toAuditLog(row: {
  id: string;
  at: Date;
  actorEmail: string;
  action: string;
  targetPersonId: string;
  detail: string;
}): AuditLogRecord {
  return {
    id: row.id,
    at: row.at.toISOString(),
    actorEmail: row.actorEmail,
    action: row.action,
    targetPersonId: row.targetPersonId,
    detail: row.detail,
  };
}

/** Postgres-backed directory/auth data; ephemeral table game state stays in memory. */
export function createPostgresStore(prisma: PrismaClient): Store {
  const game = createMemoryStore();

  return {
    async createUser(email, displayName) {
      const normalized = email.trim().toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email: normalized } });
      if (existing) {
        return toUser(existing);
      }
      const user = await prisma.user.create({
        data: {
          id: randomUUID(),
          email: normalized,
          displayName: displayName.trim() || normalized.split('@')[0]!,
          createdAt: new Date(),
        },
      });
      return toUser(user);
    },

    async getUserByEmail(email) {
      const row = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      return row ? toUser(row) : null;
    },

    async getUserById(id) {
      const row = await prisma.user.findUnique({ where: { id } });
      return row ? toUser(row) : null;
    },

    async createMagicLink(email, token, expiresAt) {
      const normalized = email.trim().toLowerCase();
      const createdAt = new Date();
      await prisma.magicLink.create({
        data: {
          token,
          email: normalized,
          createdAt,
          expiresAt: new Date(expiresAt),
        },
      });
      return {
        token,
        email: normalized,
        createdAt: createdAt.toISOString(),
        expiresAt,
        usedAt: null,
      };
    },

    async getMagicLink(token) {
      const row = await prisma.magicLink.findUnique({ where: { token } });
      return row ? toMagicLink(row) : null;
    },

    async markMagicLinkUsed(token) {
      await prisma.magicLink.updateMany({
        where: { token },
        data: { usedAt: new Date() },
      });
    },

    async lastMagicLinkRequestAt(email) {
      const row = await prisma.magicLinkCooldown.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      return row ? row.lastAt.toISOString() : null;
    },

    async setLastMagicLinkRequestAt(email, at) {
      const normalized = email.trim().toLowerCase();
      await prisma.magicLinkCooldown.upsert({
        where: { email: normalized },
        create: { email: normalized, lastAt: new Date(at) },
        update: { lastAt: new Date(at) },
      });
    },

    createTable(record: TableRecord) {
      return game.createTable(record);
    },

    getTable(id: string) {
      return game.getTable(id);
    },

    listAllTables() {
      return game.listAllTables();
    },

    updateTable(id: string, state: GameState, version: number) {
      return game.updateTable(id, state, version);
    },

    addMember(member: TableMemberRecord) {
      return game.addMember(member);
    },

    getMembers(tableId: string) {
      return game.getMembers(tableId);
    },

    getMember(tableId: string, userId: string) {
      return game.getMember(tableId, userId);
    },

    async createInvite(invite: TableInviteRecord) {
      await prisma.tableInvite.create({
        data: {
          id: invite.id,
          tableId: invite.tableId,
          token: invite.token,
          invitedEmail: invite.invitedEmail.trim().toLowerCase(),
          invitedName: invite.invitedName,
          inviterUserId: invite.inviterUserId,
          status: invite.status,
          createdAt: new Date(invite.createdAt),
          expiresAt: new Date(invite.expiresAt),
        },
      });
    },

    async getInvite(tableId, inviteId) {
      const row = await prisma.tableInvite.findUnique({
        where: { tableId_id: { tableId, id: inviteId } },
      });
      return row ? toInvite(row) : null;
    },

    async getInviteByToken(token) {
      const row = await prisma.tableInvite.findUnique({ where: { token } });
      return row ? toInvite(row) : null;
    },

    async listInvitesForEmail(email) {
      const normalized = email.trim().toLowerCase();
      const rows = await prisma.tableInvite.findMany({
        where: { invitedEmail: normalized },
      });
      return rows.map(toInvite);
    },

    async updateInviteStatus(tableId, inviteId, status) {
      await prisma.tableInvite.updateMany({
        where: { tableId, id: inviteId },
        data: { status },
      });
    },

    async createPerson(record) {
      const normalized = record.email.trim().toLowerCase();
      const row = await prisma.person.create({
        data: {
          id: record.id,
          email: normalized,
          displayName: record.displayName,
          status: record.status,
          role: record.role,
          canLogin: record.canLogin,
          canOwnTables: record.canOwnTables,
          canPlay: record.canPlay,
          canInvite: record.canInvite,
          createdAt: new Date(record.createdAt),
          invitedAt: record.invitedAt ? new Date(record.invitedAt) : null,
          invitedBy: record.invitedBy,
          lastLoginAt: record.lastLoginAt ? new Date(record.lastLoginAt) : null,
          userId: record.userId,
        },
      });
      return toPerson(row);
    },

    async getPersonById(id) {
      const row = await prisma.person.findUnique({ where: { id } });
      return row ? toPerson(row) : null;
    },

    async getPersonByEmail(email) {
      const row = await prisma.person.findUnique({ where: { email: email.trim().toLowerCase() } });
      return row ? toPerson(row) : null;
    },

    async getPersonByUserId(userId) {
      const row = await prisma.person.findFirst({ where: { userId } });
      return row ? toPerson(row) : null;
    },

    async listPeople() {
      const rows = await prisma.person.findMany();
      return rows.map(toPerson);
    },

    async updatePerson(id, patches) {
      const existing = await prisma.person.findUnique({ where: { id } });
      if (!existing) {
        return null;
      }
      const row = await prisma.person.update({
        where: { id },
        data: {
          ...(patches.email !== undefined ? { email: patches.email.trim().toLowerCase() } : {}),
          ...(patches.displayName !== undefined ? { displayName: patches.displayName } : {}),
          ...(patches.status !== undefined ? { status: patches.status } : {}),
          ...(patches.role !== undefined ? { role: patches.role } : {}),
          ...(patches.canLogin !== undefined ? { canLogin: patches.canLogin } : {}),
          ...(patches.canOwnTables !== undefined ? { canOwnTables: patches.canOwnTables } : {}),
          ...(patches.canPlay !== undefined ? { canPlay: patches.canPlay } : {}),
          ...(patches.canInvite !== undefined ? { canInvite: patches.canInvite } : {}),
          ...(patches.invitedAt !== undefined
            ? { invitedAt: patches.invitedAt ? new Date(patches.invitedAt) : null }
            : {}),
          ...(patches.invitedBy !== undefined ? { invitedBy: patches.invitedBy } : {}),
          ...(patches.lastLoginAt !== undefined
            ? { lastLoginAt: patches.lastLoginAt ? new Date(patches.lastLoginAt) : null }
            : {}),
          ...(patches.userId !== undefined ? { userId: patches.userId } : {}),
        },
      });
      return toPerson(row);
    },

    async appendAuditLog(entry) {
      await prisma.auditLog.create({
        data: {
          id: entry.id,
          at: new Date(entry.at),
          actorEmail: entry.actorEmail,
          action: entry.action,
          targetPersonId: entry.targetPersonId,
          detail: entry.detail,
        },
      });
      const count = await prisma.auditLog.count();
      if (count > 500) {
        const stale = await prisma.auditLog.findMany({
          orderBy: { at: 'asc' },
          take: count - 500,
          select: { id: true },
        });
        if (stale.length > 0) {
          await prisma.auditLog.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
        }
      }
    },

    async listAuditLogs(limit = 50) {
      const rows = await prisma.auditLog.findMany({
        orderBy: { at: 'desc' },
        take: limit,
      });
      return rows.map(toAuditLog);
    },

    async getRuntimeStats() {
      const [users, people, invites, tables] = await Promise.all([
        prisma.user.count(),
        prisma.person.count(),
        prisma.tableInvite.count(),
        Promise.resolve(game.getRuntimeStats().tables),
      ]);
      return { users, people, invites, tables };
    },
  };
}
