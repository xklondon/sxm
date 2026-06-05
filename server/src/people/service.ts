import { randomUUID } from 'node:crypto';
import type { PersonRecord, PersonRole, Store, TableInviteRecord, UserRecord } from '../store/types.js';
import { config } from '../config.js';
import {
  isPeopleAdmin,
  isRootEmail,
  isRootPerson,
  normalizeEmail,
  permissionsForRole,
  permissionsForTableInvite,
  personToPermissions,
} from './permissions.js';
import { PeopleAuthError } from './errors.js';
import { logAuthProvision } from './provisioningLog.js';

export class PeopleService {
  constructor(private readonly store: Store) {}

  /** Resolve session userId after store reset — prefer id, then email, then create. */
  async resolveSessionUser(
    userId: string,
    sessionEmail?: string,
    route = 'internal',
  ): Promise<UserRecord> {
    const byId = await this.store.getUserById(userId);
    if (byId) {
      logAuthProvision(route, 'resolve-by-id', sessionEmail, {
        userId: byId.id,
        personFound: Boolean(await this.getPersonForUser(byId.id)),
      });
      return byId;
    }
    if (!sessionEmail) {
      throw new PeopleAuthError('SESSION_INVALID', 'Session expired — sign in again');
    }
    const normalized = normalizeEmail(sessionEmail);
    const byEmail = await this.store.getUserByEmail(normalized);
    if (byEmail) {
      logAuthProvision(route, 'resolve-by-email', sessionEmail, {
        sessionUserId: userId,
        resolvedUserId: byEmail.id,
        personFound: Boolean(await this.getPersonForUser(byEmail.id)),
      });
      return byEmail;
    }
    const created = await this.store.createUser(normalized, normalized.split('@')[0]!);
    logAuthProvision(route, 'create-user', sessionEmail, {
      sessionUserId: userId,
      resolvedUserId: created.id,
    });
    return created;
  }

  async listPeople(): Promise<PersonRecord[]> {
    const people = await this.store.listPeople();
    return people.sort((a, b) => a.email.localeCompare(b.email));
  }

  async getPersonByEmail(email: string): Promise<PersonRecord | null> {
    return this.store.getPersonByEmail(email);
  }

  async getPersonForUser(userId: string): Promise<PersonRecord | null> {
    const byUser = await this.store.getPersonByUserId(userId);
    if (byUser) {
      return byUser;
    }
    const user = await this.store.getUserById(userId);
    if (!user) {
      return null;
    }
    return this.store.getPersonByEmail(user.email);
  }

  async canRequestMagicLink(email: string): Promise<boolean> {
    const normalized = normalizeEmail(email);
    if (isRootEmail(normalized)) {
      return true;
    }
    const person = await this.store.getPersonByEmail(normalized);
    if (!person) {
      return !config.inviteOnlyMode;
    }
    if (person.status === 'disabled') {
      return false;
    }
    return person.canLogin && (person.status === 'active' || person.status === 'invited');
  }

  async ensurePersonOnLogin(email: string, userId: string): Promise<PersonRecord> {
    const normalized = normalizeEmail(email);
    let person = await this.store.getPersonByEmail(normalized);
    const now = new Date().toISOString();

    if (isRootEmail(normalized)) {
      if (!person) {
        person = await this.store.createPerson({
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
        person = (await this.store.updatePerson(person.id, {
          role: 'root',
          status: 'active',
          ...permissionsForRole('root'),
          lastLoginAt: now,
          userId,
        }))!;
      }
      return person;
    }

    if (!person) {
      if (config.inviteOnlyMode) {
        throw new Error('Person record missing after authorized login');
      }
      person = await this.store.createPerson({
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
    return (await this.store.updatePerson(person.id, updates))!;
  }

  async addPerson(params: {
    email: string;
    displayName?: string;
    role?: PersonRole;
    invitedByEmail: string;
  }): Promise<PersonRecord> {
    const normalized = normalizeEmail(params.email);
    if (isRootEmail(normalized)) {
      throw new Error('Cannot add root user via people API');
    }
    const existing = await this.store.getPersonByEmail(normalized);
    if (existing) {
      throw new Error('Person already exists');
    }
    const role = params.role ?? 'player';
    const now = new Date().toISOString();
    const person = await this.store.createPerson({
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
    await this.store.appendAuditLog({
      id: randomUUID(),
      at: now,
      actorEmail: params.invitedByEmail,
      action: 'people.create',
      targetPersonId: person.id,
      detail: `Added ${normalized} as ${role}`,
    });
    return person;
  }

  async updatePerson(
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
  ): Promise<PersonRecord> {
    const person = await this.store.getPersonById(personId);
    if (!person) {
      throw new Error('Person not found');
    }
    if (isRootPerson(person)) {
      if (
        (patches.role !== undefined && patches.role !== 'root') ||
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
      return (await this.store.updatePerson(personId, allowed)) ?? person;
    }

    const next: Partial<PersonRecord> = { ...patches };
    if (patches.role !== undefined) {
      Object.assign(next, permissionsForRole(patches.role));
    }
    const updated = await this.store.updatePerson(personId, next);
    if (!updated) {
      throw new Error('Update failed');
    }
    await this.store.appendAuditLog({
      id: randomUUID(),
      at: new Date().toISOString(),
      actorEmail,
      action: 'people.update',
      targetPersonId: personId,
      detail: JSON.stringify(patches),
    });
    return updated;
  }

  async assertCanOwnTables(
    userId: string,
    sessionEmail?: string,
    route = 'tables.create',
  ): Promise<PersonRecord> {
    const person = await this.requireActivePerson(userId, sessionEmail, route);
    if (!person.canOwnTables && !isRootPerson(person)) {
      throw new Error('You do not have permission to create tables');
    }
    return person;
  }

  async assertCanInvite(
    userId: string,
    sessionEmail?: string,
    route = 'tables.invite',
  ): Promise<PersonRecord> {
    const person = await this.requireActivePerson(userId, sessionEmail, route);
    if (!person.canInvite && !isRootPerson(person)) {
      throw new Error('You do not have permission to invite others');
    }
    return person;
  }

  async assertCanJoinTable(
    userId: string,
    invite: TableInviteRecord | null,
    sessionEmail?: string,
    route = 'tables.join',
  ): Promise<PersonRecord> {
    const user = await this.resolveSessionUser(userId, sessionEmail, route);
    const person = await this.getPersonForUser(user.id);
    if (person && (person.canPlay || isRootPerson(person))) {
      return person;
    }
    if (invite && normalizeEmail(invite.invitedEmail) === user.email) {
      if (!person) {
        logAuthProvision(route, 'ensure-invite-guest', sessionEmail, { resolvedUserId: user.id });
        return this.ensureInvitedGuestOnJoin(user.email, user.id);
      }
      return person;
    }
    throw new Error('You do not have permission to join this table');
  }

  async ensureInvitedPersonForTable(params: {
    email: string;
    displayName: string;
    inviterEmail: string;
    role?: PersonRole;
  }): Promise<PersonRecord> {
    const normalized = normalizeEmail(params.email);
    const tablePerms = permissionsForTableInvite();
    let person = await this.store.getPersonByEmail(normalized);
    if (!person) {
      const role = params.role ?? 'player';
      const now = new Date().toISOString();
      person = await this.store.createPerson({
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
      person = (await this.store.updatePerson(person.id, {
        ...tablePerms,
        canLogin: true,
        status: 'invited',
        invitedAt: person.invitedAt ?? new Date().toISOString(),
        invitedBy: params.inviterEmail,
      }))!;
    }
    return person;
  }

  async assertPeopleAdmin(
    userId: string,
    sessionEmail?: string,
    route = 'people.admin',
  ): Promise<PersonRecord> {
    const user = await this.resolveSessionUser(userId, sessionEmail, route);
    if (isRootEmail(user.email)) {
      logAuthProvision(route, 'ensure-root', sessionEmail, { resolvedUserId: user.id });
      return this.ensurePersonOnLogin(user.email, user.id);
    }
    const person = await this.getPersonForUser(user.id);
    if (!isPeopleAdmin(person, user.email)) {
      throw new Error('Admin access required');
    }
    return person!;
  }

  async getAuthProfile(userId: string, emailFromSession?: string) {
    const user = await this.resolveSessionUser(userId, emailFromSession, 'GET /api/auth/me');
    let person = await this.getPersonForUser(user.id);
    if (!person && isRootEmail(user.email)) {
      logAuthProvision('GET /api/auth/me', 'ensure-root', emailFromSession, {
        resolvedUserId: user.id,
      });
      person = await this.ensurePersonOnLogin(user.email, user.id);
    } else if (!person && emailFromSession && !config.inviteOnlyMode) {
      logAuthProvision('GET /api/auth/me', 'ensure-person-login', emailFromSession, {
        resolvedUserId: user.id,
      });
      person = await this.ensurePersonOnLogin(emailFromSession, user.id);
    }
    logAuthProvision('GET /api/auth/me', 'get-auth-profile', emailFromSession, {
      resolvedUserId: user.id,
      personFound: Boolean(person),
      isRoot: isRootEmail(user.email),
    });
    return {
      userId: user.id,
      email: user.email,
      displayName: person?.displayName ?? user.displayName,
      ...(person
        ? personToPermissions(person)
        : {
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

  private async requireActivePerson(
    userId: string,
    sessionEmail?: string,
    route = 'people.require-active',
  ): Promise<PersonRecord> {
    const user = await this.resolveSessionUser(userId, sessionEmail, route);
    if (isRootEmail(user.email)) {
      logAuthProvision(route, 'ensure-root', sessionEmail, { resolvedUserId: user.id });
      return this.ensurePersonOnLogin(user.email, user.id);
    }
    const person = await this.getPersonForUser(user.id);
    if (!person) {
      throw new PeopleAuthError(
        'NOT_REGISTERED',
        'Your account is not registered on this platform. Ask an admin for an invite.',
      );
    }
    if (person.status === 'disabled') {
      throw new Error('Account disabled');
    }
    return person;
  }

  private async ensureInvitedGuestOnJoin(email: string, userId: string): Promise<PersonRecord> {
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
