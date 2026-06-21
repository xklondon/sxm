import { normalizeEmail } from './permissions.js';
import type { PersonRecord, UserRecord } from '../store/types.js';

export type PersonAuditWarningType =
  | 'duplicate_person_email'
  | 'duplicate_user_email'
  | 'stale_user_link'
  | 'missing_user'
  | 'email_user_mismatch'
  | 'multiple_persons_per_user';

export interface PersonAuditWarning {
  type: PersonAuditWarningType;
  severity: 'warning' | 'error';
  normalizedEmail: string;
  message: string;
  personIds: string[];
  userIds: string[];
}

export interface PeopleAuditReport {
  warnings: PersonAuditWarning[];
  duplicatePersonEmails: string[];
  duplicateUserEmails: string[];
}

function groupPeopleByEmail(people: PersonRecord[]): Map<string, PersonRecord[]> {
  const byEmail = new Map<string, PersonRecord[]>();
  for (const person of people) {
    const key = normalizeEmail(person.email);
    const list = byEmail.get(key) ?? [];
    list.push(person);
    byEmail.set(key, list);
  }
  return byEmail;
}

function groupUsersByEmail(users: UserRecord[]): Map<string, UserRecord[]> {
  const byEmail = new Map<string, UserRecord[]>();
  for (const user of users) {
    const key = normalizeEmail(user.email);
    const list = byEmail.get(key) ?? [];
    list.push(user);
    byEmail.set(key, list);
  }
  return byEmail;
}

/** Admin-only duplicate / link audit — no mutations. */
export function auditPeopleAndUsers(
  people: PersonRecord[],
  users: UserRecord[],
): PeopleAuditReport {
  const warnings: PersonAuditWarning[] = [];
  const duplicatePersonEmails: string[] = [];
  const duplicateUserEmails: string[] = [];
  const usersById = new Map(users.map((user) => [user.id, user]));

  for (const [email, group] of groupPeopleByEmail(people)) {
    if (group.length > 1) {
      duplicatePersonEmails.push(email);
      warnings.push({
        type: 'duplicate_person_email',
        severity: 'error',
        normalizedEmail: email,
        message: `${group.length} Person records share email ${email}`,
        personIds: group.map((p) => p.id),
        userIds: group.flatMap((p) => (p.userId ? [p.userId] : [])),
      });
    }
  }

  for (const [email, group] of groupUsersByEmail(users)) {
    if (group.length > 1) {
      duplicateUserEmails.push(email);
      warnings.push({
        type: 'duplicate_user_email',
        severity: 'error',
        normalizedEmail: email,
        message: `${group.length} User records share email ${email}`,
        personIds: [],
        userIds: group.map((u) => u.id),
      });
    }
  }

  const byUserId = new Map<string, PersonRecord[]>();
  for (const person of people) {
    if (!person.userId) {
      continue;
    }
    const list = byUserId.get(person.userId) ?? [];
    list.push(person);
    byUserId.set(person.userId, list);
  }

  for (const [userId, group] of byUserId) {
    if (group.length > 1) {
      const email = normalizeEmail(group[0]!.email);
      warnings.push({
        type: 'multiple_persons_per_user',
        severity: 'error',
        normalizedEmail: email,
        message: `${group.length} Person records link to User ${userId}`,
        personIds: group.map((p) => p.id),
        userIds: [userId],
      });
    }
  }

  for (const person of people) {
    const normalizedEmail = normalizeEmail(person.email);
    if (!person.userId) {
      continue;
    }
    const linkedUser = usersById.get(person.userId);
    if (!linkedUser) {
      warnings.push({
        type: 'missing_user',
        severity: 'error',
        normalizedEmail,
        message: `Person ${person.email} links to missing User ${person.userId}`,
        personIds: [person.id],
        userIds: [person.userId],
      });
      continue;
    }
    if (normalizeEmail(linkedUser.email) !== normalizedEmail) {
      warnings.push({
        type: 'email_user_mismatch',
        severity: 'error',
        normalizedEmail,
        message: `Person ${person.email} links to User with email ${linkedUser.email}`,
        personIds: [person.id],
        userIds: [linkedUser.id],
      });
    }
  }

  return { warnings, duplicatePersonEmails, duplicateUserEmails };
}

export function pickCanonicalPerson(
  people: PersonRecord[],
  preferredUserId?: string | null,
): PersonRecord {
  const sorted = [...people].sort((a, b) => {
    const score = (person: PersonRecord) => {
      let value = 0;
      if (preferredUserId && person.userId === preferredUserId) {
        value += 1000;
      }
      if (person.userId) {
        value += 100;
      }
      if (person.status === 'active') {
        value += 30;
      } else if (person.status === 'invited') {
        value += 20;
      }
      if (person.lastLoginAt) {
        value += 10;
      }
      return value;
    };
    const diff = score(b) - score(a);
    if (diff !== 0) {
      return diff;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
  return sorted[0]!;
}

export function mergePersonFields(
  canonical: PersonRecord,
  duplicates: PersonRecord[],
): Partial<PersonRecord> {
  const all = [canonical, ...duplicates.filter((p) => p.id !== canonical.id)];
  const withName = all.find((p) => p.displayName.trim() && p.displayName !== p.email.split('@')[0]);
  const patches: Partial<PersonRecord> = {};
  if (withName && withName.displayName !== canonical.displayName) {
    patches.displayName = withName.displayName;
  }
  const bestStatus = all.find((p) => p.status === 'active') ?? all.find((p) => p.status === 'invited');
  if (bestStatus && bestStatus.status !== canonical.status) {
    patches.status = bestStatus.status;
  }
  const latestLogin = all
    .map((p) => p.lastLoginAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  if (latestLogin && latestLogin !== canonical.lastLoginAt) {
    patches.lastLoginAt = latestLogin;
  }
  return patches;
}
