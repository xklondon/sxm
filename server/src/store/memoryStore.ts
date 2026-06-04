import { randomUUID } from 'node:crypto';
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

export function createMemoryStore(): Store {
  const usersByEmail = new Map<string, UserRecord>();
  const usersById = new Map<string, UserRecord>();
  const magicLinks = new Map<string, MagicLinkRecord>();
  const magicLinkCooldown = new Map<string, string>();
  const tables = new Map<string, TableRecord>();
  const members = new Map<string, TableMemberRecord[]>();
  const invites = new Map<string, TableInviteRecord>();
  const invitesByToken = new Map<string, TableInviteRecord>();
  const peopleByEmail = new Map<string, PersonRecord>();
  const peopleById = new Map<string, PersonRecord>();
  const auditLogs: AuditLogRecord[] = [];

  function inviteKey(tableId: string, inviteId: string): string {
    return `${tableId}:${inviteId}`;
  }

  return {
    createUser(email, displayName) {
      const normalized = email.trim().toLowerCase();
      const existing = usersByEmail.get(normalized);
      if (existing) {
        return existing;
      }
      const user: UserRecord = {
        id: randomUUID(),
        email: normalized,
        displayName: displayName.trim() || normalized.split('@')[0]!,
        createdAt: new Date().toISOString(),
      };
      usersByEmail.set(normalized, user);
      usersById.set(user.id, user);
      return user;
    },

    getUserByEmail(email) {
      return usersByEmail.get(email.trim().toLowerCase()) ?? null;
    },

    getUserById(id) {
      return usersById.get(id) ?? null;
    },

    createMagicLink(email, token, expiresAt) {
      const record: MagicLinkRecord = {
        token,
        email: email.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        expiresAt,
        usedAt: null,
      };
      magicLinks.set(token, record);
      return record;
    },

    getMagicLink(token) {
      return magicLinks.get(token) ?? null;
    },

    markMagicLinkUsed(token) {
      const link = magicLinks.get(token);
      if (link) {
        magicLinks.set(token, { ...link, usedAt: new Date().toISOString() });
      }
    },

    lastMagicLinkRequestAt(email) {
      return magicLinkCooldown.get(email.trim().toLowerCase()) ?? null;
    },

    setLastMagicLinkRequestAt(email, at) {
      magicLinkCooldown.set(email.trim().toLowerCase(), at);
    },

    createTable(record) {
      tables.set(record.id, record);
      members.set(record.id, []);
    },

    getTable(id) {
      return tables.get(id) ?? null;
    },

    updateTable(id, state, version) {
      const table = tables.get(id);
      if (!table) return;
      tables.set(id, {
        ...table,
        state,
        version,
        updatedAt: new Date().toISOString(),
      });
    },

    addMember(member) {
      const list = members.get(member.tableId) ?? [];
      if (!list.some((m) => m.userId === member.userId)) {
        list.push(member);
        members.set(member.tableId, list);
      }
    },

    getMembers(tableId) {
      return members.get(tableId) ?? [];
    },

    getMember(tableId, userId) {
      return (members.get(tableId) ?? []).find((m) => m.userId === userId) ?? null;
    },

    createInvite(invite) {
      invites.set(inviteKey(invite.tableId, invite.id), invite);
      invitesByToken.set(invite.token, invite);
    },

    getInvite(tableId, inviteId) {
      return invites.get(inviteKey(tableId, inviteId)) ?? null;
    },

    getInviteByToken(token) {
      return invitesByToken.get(token) ?? null;
    },

    updateInviteStatus(tableId, inviteId, status) {
      const key = inviteKey(tableId, inviteId);
      const invite = invites.get(key);
      if (invite) {
        const updated = { ...invite, status };
        invites.set(key, updated);
        invitesByToken.set(updated.token, updated);
      }
    },

    createPerson(record) {
      const normalized = record.email.trim().toLowerCase();
      const person = { ...record, email: normalized };
      peopleByEmail.set(normalized, person);
      peopleById.set(person.id, person);
      return person;
    },

    getPersonById(id) {
      return peopleById.get(id) ?? null;
    },

    getPersonByEmail(email) {
      return peopleByEmail.get(email.trim().toLowerCase()) ?? null;
    },

    getPersonByUserId(userId) {
      for (const person of peopleById.values()) {
        if (person.userId === userId) {
          return person;
        }
      }
      return null;
    },

    listPeople() {
      return [...peopleById.values()];
    },

    updatePerson(id, patches) {
      const person = peopleById.get(id);
      if (!person) return null;
      const updated = { ...person, ...patches };
      peopleById.set(id, updated);
      peopleByEmail.set(updated.email, updated);
      return updated;
    },

    appendAuditLog(entry) {
      auditLogs.unshift(entry);
      if (auditLogs.length > 500) {
        auditLogs.length = 500;
      }
    },

    listAuditLogs(limit = 50) {
      return auditLogs.slice(0, limit);
    },

    getRuntimeStats() {
      return {
        tables: tables.size,
        users: usersById.size,
        people: peopleById.size,
        invites: invites.size,
      };
    },
  };
}
