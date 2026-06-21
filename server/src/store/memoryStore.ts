import { randomUUID } from 'node:crypto';
import type {
  AuditLogRecord,
  MagicLinkRecord,
  PersonRecord,
  Store,
  TableInviteRecord,
  TableJoinRequestRecord,
  TableMemberRecord,
  TableRecord,
  UserRecord,
} from './types.js';

export function createMemoryStore(options?: { enableTestHooks?: boolean }): Store & {
  insertOrphanPersonForTests?: (person: PersonRecord) => void;
} {
  const usersByEmail = new Map<string, UserRecord>();
  const usersById = new Map<string, UserRecord>();
  const magicLinks = new Map<string, MagicLinkRecord>();
  const magicLinkCooldown = new Map<string, string>();
  const tables = new Map<string, TableRecord>();
  const members = new Map<string, TableMemberRecord[]>();
  const invites = new Map<string, TableInviteRecord>();
  const invitesByToken = new Map<string, TableInviteRecord>();
  const joinRequests = new Map<string, TableJoinRequestRecord>();
  const peopleByEmail = new Map<string, PersonRecord>();
  const peopleById = new Map<string, PersonRecord>();
  const auditLogs: AuditLogRecord[] = [];

  function inviteKey(tableId: string, inviteId: string): string {
    return `${tableId}:${inviteId}`;
  }

  function joinRequestKey(tableId: string, requestId: string): string {
    return `${tableId}:${requestId}`;
  }

  const store: Store = {
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

    listUsers() {
      return [...usersById.values()];
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

    listAllTables() {
      return [...tables.values()];
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

    upsertMember(member) {
      const list = members.get(member.tableId) ?? [];
      const index = list.findIndex((m) => m.userId === member.userId);
      if (index === -1) {
        list.push(member);
      } else {
        list[index] = { ...list[index]!, ...member };
      }
      members.set(member.tableId, list);
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

    listInvitesForEmail(email) {
      const normalized = email.trim().toLowerCase();
      return [...invites.values()].filter(
        (invite) => invite.invitedEmail.trim().toLowerCase() === normalized,
      );
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

    createJoinRequest(request) {
      joinRequests.set(joinRequestKey(request.tableId, request.id), request);
    },

    getJoinRequest(tableId, requestId) {
      return joinRequests.get(joinRequestKey(tableId, requestId)) ?? null;
    },

    listJoinRequestsForTable(tableId) {
      return [...joinRequests.values()].filter((request) => request.tableId === tableId);
    },

    listJoinRequestsForUser(userId) {
      return [...joinRequests.values()].filter((request) => request.userId === userId);
    },

    updateJoinRequestStatus(tableId, requestId, status) {
      const key = joinRequestKey(tableId, requestId);
      const request = joinRequests.get(key);
      if (request) {
        joinRequests.set(key, {
          ...request,
          status,
          resolvedAt: new Date().toISOString(),
        });
      }
    },

    createPerson(record) {
      const normalized = record.email.trim().toLowerCase();
      const existing = peopleByEmail.get(normalized);
      if (existing && existing.id !== record.id) {
        peopleById.delete(existing.id);
      }
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
      const nextEmail =
        patches.email !== undefined ? patches.email.trim().toLowerCase() : person.email;
      if (nextEmail !== person.email) {
        peopleByEmail.delete(person.email);
      }
      const updated = { ...person, ...patches, email: nextEmail };
      peopleById.set(id, updated);
      peopleByEmail.set(updated.email, updated);
      return updated;
    },

    deletePerson(id) {
      const person = peopleById.get(id);
      if (!person) {
        return false;
      }
      peopleById.delete(id);
      const current = peopleByEmail.get(person.email);
      if (current?.id === id) {
        peopleByEmail.delete(person.email);
      }
      return true;
    },

    revokePendingInvitesForEmail(email) {
      const normalized = email.trim().toLowerCase();
      let count = 0;
      for (const [key, invite] of invites) {
        if (
          invite.status === 'pending' &&
          invite.invitedEmail.trim().toLowerCase() === normalized
        ) {
          const updated = { ...invite, status: 'revoked' as const };
          invites.set(key, updated);
          invitesByToken.set(updated.token, updated);
          count += 1;
        }
      }
      return count;
    },

    replaceMemberPersonId(oldPersonId, newPersonId) {
      let count = 0;
      for (const [tableId, list] of members) {
        let changed = false;
        const next = list.map((member) => {
          if (member.personId !== oldPersonId) {
            return member;
          }
          changed = true;
          count += 1;
          return { ...member, personId: newPersonId };
        });
        if (changed) {
          members.set(tableId, next);
        }
      }
      return count;
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

  if (options?.enableTestHooks) {
    return Object.assign(store, {
      insertOrphanPersonForTests(person: PersonRecord) {
        const normalized = person.email.trim().toLowerCase();
        peopleById.set(person.id, { ...person, email: normalized });
      },
    });
  }

  return store;
}
