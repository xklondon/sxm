import { config } from '../config.js';
import type { PersonRecord, PersonRole } from '../store/types.js';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isRootEmail(email: string): boolean {
  const root = config.rootUserEmail.trim().toLowerCase();
  return Boolean(root) && normalizeEmail(email) === root;
}

export function isRootPerson(person: PersonRecord): boolean {
  return person.role === 'root' || isRootEmail(person.email);
}

/** Default permissions when inviting someone to play at a table. */
export function permissionsForTableInvite(): Pick<
  PersonRecord,
  'canLogin' | 'canOwnTables' | 'canPlay' | 'canInvite'
> {
  return { canLogin: true, canOwnTables: true, canPlay: true, canInvite: true };
}

export function permissionsForRole(role: PersonRole): Pick<
  PersonRecord,
  'canLogin' | 'canOwnTables' | 'canPlay' | 'canInvite'
> {
  switch (role) {
    case 'root':
    case 'admin':
      return { canLogin: true, canOwnTables: true, canPlay: true, canInvite: true };
    case 'host':
      return { canLogin: true, canOwnTables: true, canPlay: true, canInvite: true };
    case 'player':
      return { canLogin: true, canOwnTables: false, canPlay: true, canInvite: false };
    case 'guest':
      return { canLogin: true, canOwnTables: false, canPlay: false, canInvite: false };
    default:
      return { canLogin: false, canOwnTables: false, canPlay: false, canInvite: false };
  }
}

export function isPeopleAdmin(person: PersonRecord | null, email?: string): boolean {
  if (email && isRootEmail(email)) {
    return true;
  }
  return Boolean(person && (person.role === 'root' || person.role === 'admin'));
}

export function personToPermissions(person: PersonRecord) {
  return {
    canLogin: person.canLogin,
    canOwnTables: person.canOwnTables,
    canPlay: person.canPlay,
    canInvite: person.canInvite,
    role: person.role,
    status: person.status,
    isRoot: isRootPerson(person),
  };
}
