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
import { InviteFlowError } from './inviteErrors.js';
import { sanitizeEmail } from '../email/smtp.js';
import {
  auditPeopleAndUsers,
  mergePersonFields,
  pickCanonicalPerson,
  type PeopleAuditReport,
} from './duplicateAudit.js';
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
    const user = await this.store.getUserById(userId);
    if (!user) {
      return null;
    }
    const normalizedUserEmail = normalizeEmail(user.email);
    const byEmail = await this.store.getPersonByEmail(normalizedUserEmail);
    const byUser = await this.store.getPersonByUserId(userId);

    if (byUser && normalizeEmail(byUser.email) === normalizedUserEmail) {
      return byUser;
    }

    if (byEmail) {
      if (byEmail.userId !== userId) {
        logAuthProvision('getPersonForUser', 'repair-user-link', normalizedUserEmail, {
          resolvedUserId: userId,
          personId: byEmail.id,
          previousUserId: byEmail.userId,
        });
        const repaired = await this.store.updatePerson(byEmail.id, { userId });
        return repaired ?? { ...byEmail, userId };
      }
      return byEmail;
    }

    if (byUser && normalizeEmail(byUser.email) !== normalizedUserEmail) {
      logAuthProvision('getPersonForUser', 'stale-user-link-skipped', normalizedUserEmail, {
        resolvedUserId: userId,
        stalePersonId: byUser.id,
        stalePersonEmail: byUser.email,
      });
      return null;
    }

    return byUser;
  }

  async auditPeopleDirectory(): Promise<PeopleAuditReport> {
    const [people, users] = await Promise.all([this.store.listPeople(), this.store.listUsers()]);
    return auditPeopleAndUsers(people, users);
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

  async removePerson(
    personId: string,
    actorEmail: string,
    options: { hard?: boolean; revokeInvites?: boolean } = {},
  ): Promise<{ mode: 'disabled' | 'deleted'; person?: PersonRecord }> {
    const person = await this.store.getPersonById(personId);
    if (!person) {
      throw new Error('Person not found');
    }
    if (isRootPerson(person)) {
      throw new Error('Root user cannot be removed');
    }
    if (person.role === 'admin' && normalizeEmail(person.email) === normalizeEmail(actorEmail)) {
      throw new Error('You cannot remove your own admin account');
    }

    if (!options.hard) {
      const disabled = await this.updatePerson(
        personId,
        { status: 'disabled', canLogin: false },
        actorEmail,
      );
      return { mode: 'disabled', person: disabled };
    }

    if (options.revokeInvites !== false) {
      await this.store.revokePendingInvitesForEmail(person.email);
    }
    const deleted = await this.store.deletePerson(personId);
    if (!deleted) {
      throw new Error('Delete failed');
    }
    await this.store.appendAuditLog({
      id: randomUUID(),
      at: new Date().toISOString(),
      actorEmail,
      action: 'people.delete',
      targetPersonId: personId,
      detail: `Removed person ${person.email}`,
    });
    return { mode: 'deleted' };
  }

  async repairPersonByEmail(email: string, actorEmail: string): Promise<{
    canonicalPerson: PersonRecord;
    mergedCount: number;
    revokedInvites: number;
    membersUpdated: number;
  }> {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new Error('Email required');
    }
    if (isRootEmail(normalized)) {
      throw new Error('Root user cannot be merged via repair');
    }

    let user = await this.store.getUserByEmail(normalized);
    if (!user) {
      user = await this.store.createUser(normalized, normalized.split('@')[0]!);
    }

    const allPeople = await this.store.listPeople();
    const duplicates = allPeople.filter((person) => normalizeEmail(person.email) === normalized);
    if (duplicates.length === 0) {
      throw new Error('No person records found for that email');
    }

    const emailMapped = await this.store.getPersonByEmail(normalized);
    const canonical =
      emailMapped && duplicates.some((person) => person.id === emailMapped.id)
        ? emailMapped
        : pickCanonicalPerson(duplicates, user.id);
    const mergePatches = mergePersonFields(canonical, duplicates);
    let canonicalPerson =
      (await this.store.updatePerson(canonical.id, {
        ...mergePatches,
        email: normalized,
        userId: user.id,
      })) ?? canonical;

    let mergedCount = 0;
    let membersUpdated = 0;
    for (const duplicate of duplicates) {
      if (duplicate.id === canonicalPerson.id) {
        continue;
      }
      if (isRootPerson(duplicate)) {
        continue;
      }
      membersUpdated += await this.store.replaceMemberPersonId(duplicate.id, canonicalPerson.id);
      await this.store.deletePerson(duplicate.id);
      mergedCount += 1;
    }

    const revokedInvites = await this.store.revokePendingInvitesForEmail(normalized);

    await this.store.appendAuditLog({
      id: randomUUID(),
      at: new Date().toISOString(),
      actorEmail,
      action: 'people.repair-email',
      targetPersonId: canonicalPerson.id,
      detail: JSON.stringify({ email: normalized, mergedCount, membersUpdated, revokedInvites }),
    });

    return { canonicalPerson, mergedCount, revokedInvites, membersUpdated };
  }

  async findPeopleRecordsForEmail(email: string): Promise<PersonRecord[]> {
    const normalized = normalizeEmail(email);
    return (await this.store.listPeople()).filter(
      (person) => normalizeEmail(person.email) === normalized,
    );
  }

  async assertInviteTargetEmailClear(email: string, route = 'tables.invite'): Promise<void> {
    const normalized = normalizeEmail(email);
    const people = await this.findPeopleRecordsForEmail(normalized);
    if (people.length > 1) {
      logAuthProvision(route, 'duplicate-person-email', normalized, {
        personCount: String(people.length),
      });
      throw new InviteFlowError(
        'INVITE_DUPLICATE_ACCOUNTS',
        'Duplicate account records found. Admin repair required.',
      );
    }
    const users = (await this.store.listUsers()).filter(
      (user) => normalizeEmail(user.email) === normalized,
    );
    if (users.length > 1) {
      throw new InviteFlowError(
        'INVITE_DUPLICATE_ACCOUNTS',
        'Duplicate account records found. Admin repair required.',
      );
    }
  }

  private assertPersonJoinable(person: PersonRecord, route: string): void {
    if (person.status === 'disabled' || !person.canLogin) {
      logAuthProvision(route, 'person-disabled', person.email, { personId: person.id });
      throw new InviteFlowError(
        'INVITE_PERSON_DISABLED',
        'This person is disabled. Admin must re-enable them.',
      );
    }
  }

  async resolveInviteePerson(
    userId: string,
    inviteEmail: string,
    route = 'tables.invite-join',
  ): Promise<{ user: UserRecord; person: PersonRecord }> {
    const normalizedInviteEmail = normalizeEmail(inviteEmail);
    await this.assertInviteTargetEmailClear(normalizedInviteEmail, route);
    const user = await this.resolveSessionUser(userId, normalizedInviteEmail, route);
    if (normalizeEmail(user.email) !== normalizedInviteEmail) {
      throw new InviteFlowError(
        'INVITE_EMAIL_MISMATCH',
        `This invite is for another email. Please sign in as ${sanitizeEmail(normalizedInviteEmail)}.`,
      );
    }
    let person = await this.getPersonForUser(user.id);
    if (!person) {
      person = await this.ensurePersonOnLogin(normalizedInviteEmail, user.id);
    }
    this.assertPersonJoinable(person, route);
    return { user, person };
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
    const inviteEmail = invite ? normalizeEmail(invite.invitedEmail) : null;

    if (inviteEmail) {
      await this.assertInviteTargetEmailClear(inviteEmail, route);
      if (normalizeEmail(user.email) !== inviteEmail) {
        throw new InviteFlowError(
          'INVITE_EMAIL_MISMATCH',
          `This invite is for another email. Please sign in as ${sanitizeEmail(inviteEmail)}.`,
        );
      }
    }

    let person = await this.getPersonForUser(user.id);

    if (person) {
      this.assertPersonJoinable(person, route);
    }

    if (person && (person.canPlay || isRootPerson(person))) {
      return person;
    }

    if (invite && inviteEmail === normalizeEmail(user.email)) {
      if (!person) {
        logAuthProvision(route, 'ensure-invite-guest', sessionEmail, { resolvedUserId: user.id });
        const created = await this.ensureInvitedGuestOnJoin(user.email, user.id);
        this.assertPersonJoinable(created, route);
        return created;
      }
      return person;
    }

    throw new InviteFlowError(
      'INVITE_JOIN_DENIED',
      'You do not have permission to join this table',
    );
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
      if (person.status === 'disabled' || !person.canLogin) {
        throw new InviteFlowError(
          'INVITE_PERSON_DISABLED',
          'This person is disabled. Admin must re-enable them.',
        );
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
