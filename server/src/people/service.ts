import { randomUUID } from 'node:crypto';
import type { PersonRecord, PersonRole, Store, TableInviteRecord } from '../store/types.js';
import { config } from '../config.js';import {
  isPeopleAdmin,
  isRootEmail,
  isRootPerson,
  normalizeEmail,
  permissionsForRole,
  permissionsForTableInvite,
  personToPermissions,
} from './permissions.js';

export class PeopleService {
  constructor(private readonly store: Store) {}

  listPeople(): PersonRecord[] {
    return this.store.listPeople().sort((a, b) => a.email.localeCompare(b.email));
  }

  getPersonByEmail(email: string): PersonRecord | null {
    return this.store.getPersonByEmail(email);
  }

  getPersonForUser(userId: string): PersonRecord | null {
    const byUser = this.store.getPersonByUserId(userId);
    if (byUser) return byUser;
    const user = this.store.getUserById(userId);
    if (!user) return null;
    return this.store.getPersonByEmail(user.email);
  }

  canRequestMagicLink(email: string): boolean {
    const normalized = normalizeEmail(email);
    if (isRootEmail(normalized)) {
      return true;
    }
    const person = this.store.getPersonByEmail(normalized);
    if (!person) {
      return !config.inviteOnlyMode;
    }
    if (person.status === 'disabled') {
      return false;
    }
    return person.canLogin && (person.status === 'active' || person.status === 'invited');
  }

  ensurePersonOnLogin(email: string, userId: string): PersonRecord {
    const normalized = normalizeEmail(email);
    let person = this.store.getPersonByEmail(normalized);
    const now = new Date().toISOString();

    if (isRootEmail(normalized)) {
      if (!person) {
        person = this.store.createPerson({
          id: randomUUID(),
          email: normalized,
          displayName: normalized.split('@')[0]!,
          status: 'active',
          role: 'root',
          ...permissionsForRole('root'),
          createdAt: now,
          invitedAt: null,
          invitedBy: null,
          lastLoginAt: now,
          userId,
        });
      } else {
        person = this.store.updatePerson(person.id, {
          role: 'root',
          status: 'active',
          ...permissionsForRole('root'),
          lastLoginAt: now,
          userId,
        })!;
      }
      return person;
    }

    if (!person) {
      if (config.inviteOnlyMode) {
        throw new Error('Person record missing after authorized login');
      }
      person = this.store.createPerson({
        id: randomUUID(),
        email: normalized,
        displayName: normalized.split('@')[0]!,
        status: 'active',
        role: 'player',
        ...permissionsForRole('player'),
        createdAt: now,
        invitedAt: null,
        invitedBy: null,
        lastLoginAt: now,
        userId,
      });
      return person;
    }

    const updates: Partial<PersonRecord> = { lastLoginAt: now, userId };
    if (person.status === 'invited') {
      updates.status = 'active';
    }
    return this.store.updatePerson(person.id, updates)!;
  }

  addPerson(params: {
    email: string;
    displayName?: string;
    role?: PersonRole;
    invitedByEmail: string;
  }): PersonRecord {
    const normalized = normalizeEmail(params.email);
    if (isRootEmail(normalized)) {
      throw new Error('Cannot add root user via people API');
    }
    const existing = this.store.getPersonByEmail(normalized);
    if (existing) {
      throw new Error('Person already exists');
    }
    const role = params.role ?? 'player';
    const now = new Date().toISOString();
    const person = this.store.createPerson({
      id: randomUUID(),
      email: normalized,
      displayName: params.displayName?.trim() || normalized.split('@')[0]!,
      status: 'invited',
      role,
      ...permissionsForRole(role),
      canLogin: true,
      createdAt: now,
      invitedAt: now,
      invitedBy: params.invitedByEmail,
      lastLoginAt: null,
      userId: null,
    });
    this.store.appendAuditLog({
      id: randomUUID(),
      at: now,
      actorEmail: params.invitedByEmail,
      action: 'people.create',
      targetPersonId: person.id,
      detail: `Added ${normalized} as ${role}`,
    });
    return person;
  }

  updatePerson(
    personId: string,
    patches: Partial<
      Pick<
        PersonRecord,
        | 'displayName'
        | 'role'
        | 'status'
        | 'canOwnTables'
        | 'canPlay'
        | 'canInvite'
        | 'canLogin'
      >
    >,
    actorEmail: string,
  ): PersonRecord {
    const person = this.store.getPersonById(personId);
    if (!person) {
      throw new Error('Person not found');
    }
    if (isRootPerson(person)) {
      if (
        patches.role !== undefined && patches.role !== 'root' ||
        patches.status === 'disabled' ||
        patches.canLogin === false
      ) {
        throw new Error('Root user cannot be disabled or demoted');
      }
      const allowed: Partial<PersonRecord> = {};
      if (patches.displayName !== undefined) {
        allowed.displayName = patches.displayName;
      }
      if (Object.keys(allowed).length === 0 && Object.keys(patches).length > 0) {
        throw new Error('Root user permissions are immutable');
      }
      return this.store.updatePerson(personId, allowed) ?? person;
    }

    const next: Partial<PersonRecord> = { ...patches };
    if (patches.role !== undefined) {
      Object.assign(next, permissionsForRole(patches.role));
    }
    const updated = this.store.updatePerson(personId, next);
    if (!updated) {
      throw new Error('Update failed');
    }
    this.store.appendAuditLog({
      id: randomUUID(),
      at: new Date().toISOString(),
      actorEmail,
      action: 'people.update',
      targetPersonId: personId,
      detail: JSON.stringify(patches),
    });
    return updated;
  }

  assertCanOwnTables(userId: string): PersonRecord {
    const person = this.requireActivePerson(userId);
    if (!person.canOwnTables && !isRootPerson(person)) {
      throw new Error('You do not have permission to create tables');
    }
    return person;
  }

  assertCanInvite(userId: string): PersonRecord {
    const person = this.requireActivePerson(userId);
    if (!person.canInvite && !isRootPerson(person)) {
      throw new Error('You do not have permission to invite others');
    }
    return person;
  }

  assertCanJoinTable(
    userId: string,
    invite: TableInviteRecord | null,
  ): PersonRecord {
    const user = this.store.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const person = this.getPersonForUser(userId);
    if (person && (person.canPlay || isRootPerson(person))) {
      return person;
    }
    if (invite && normalizeEmail(invite.invitedEmail) === user.email) {
      if (!person) {
        return this.ensureInvitedGuestOnJoin(user.email, userId);
      }
      return person;
    }
    throw new Error('You do not have permission to join this table');
  }

  ensureInvitedPersonForTable(params: {
    email: string;
    displayName: string;
    inviterEmail: string;
    role?: PersonRole;
  }): PersonRecord {
    const normalized = normalizeEmail(params.email);
    const tablePerms = permissionsForTableInvite();
    let person = this.store.getPersonByEmail(normalized);
    if (!person) {
      const role = params.role ?? 'player';
      const now = new Date().toISOString();
      person = this.store.createPerson({
        id: randomUUID(),
        email: normalized,
        displayName: params.displayName.trim() || normalized.split('@')[0]!,
        status: 'invited',
        role,
        ...tablePerms,
        createdAt: now,
        invitedAt: now,
        invitedBy: params.inviterEmail,
        lastLoginAt: null,
        userId: null,
      });
    } else {
      if (person.status === 'disabled') {
        throw new Error('Account disabled');
      }
      person = this.store.updatePerson(person.id, {
        ...tablePerms,
        canLogin: true,
        status: 'invited',
        invitedAt: person.invitedAt ?? new Date().toISOString(),
        invitedBy: params.inviterEmail,
      })!;
    }
    return person;
  }

  assertPeopleAdmin(userId: string): PersonRecord {
    const person = this.getPersonForUser(userId);
    if (!isPeopleAdmin(person)) {
      throw new Error('Admin access required');
    }
    return person!;
  }

  getAuthProfile(userId: string) {
    const user = this.store.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const person = this.getPersonForUser(userId);
    return {
      userId: user.id,
      email: user.email,
      displayName: person?.displayName ?? user.displayName,
      ...(person ? personToPermissions(person) : {
        canLogin: true,
        canOwnTables: !config.inviteOnlyMode,
        canPlay: !config.inviteOnlyMode,
        canInvite: !config.inviteOnlyMode,
        role: 'player' as PersonRole,
        status: 'active' as const,
        isRoot: isRootEmail(user.email),
      }),
    };
  }

  private requireActivePerson(userId: string): PersonRecord {
    const person = this.getPersonForUser(userId);
    if (!person) {
      if (!config.inviteOnlyMode) {
        throw new Error('Person record required — contact an admin');
      }
      throw new Error('You are not registered. Ask an admin for an invite.');
    }
    if (person.status === 'disabled') {
      throw new Error('Account disabled');
    }
    return person;
  }

  private ensureInvitedGuestOnJoin(email: string, userId: string): PersonRecord {
    const normalized = normalizeEmail(email);
    const now = new Date().toISOString();
    return this.store.createPerson({
      id: randomUUID(),
      email: normalized,
      displayName: normalized.split('@')[0]!,
      status: 'active',
      role: 'player',
      ...permissionsForTableInvite(),
      createdAt: now,
      invitedAt: now,
      invitedBy: null,
      lastLoginAt: now,
      userId,
    });
  }
}
