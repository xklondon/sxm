import { randomUUID } from 'node:crypto';
import type { PersonRole, Store } from '../src/store/types.js';
import { permissionsForRole } from '../src/people/permissions.js';

export function seedPerson(
  store: Store,
  params: {
    userId?: string | null;
    email: string;
    role?: PersonRole;
    status?: 'invited' | 'active' | 'disabled';
    canLogin?: boolean;
    canOwnTables?: boolean;
    canPlay?: boolean;
    canInvite?: boolean;
  },
) {
  const email = params.email.trim().toLowerCase();
  const role = params.role ?? 'host';
  const perms = permissionsForRole(role);
  const now = new Date().toISOString();
  return store.createPerson({
    id: randomUUID(),
    email,
    displayName: email.split('@')[0]!,
    status: params.status ?? 'active',
    role,
    canLogin: params.canLogin ?? perms.canLogin,
    canOwnTables: params.canOwnTables ?? perms.canOwnTables,
    canPlay: params.canPlay ?? perms.canPlay,
    canInvite: params.canInvite ?? perms.canInvite,
    createdAt: now,
    invitedAt: null,
    invitedBy: null,
    lastLoginAt: null,
    userId: params.userId ?? null,
  });
}

export function seedHostUser(store: Store, email = 'host@example.com') {
  const user = store.createUser(email, 'Host');
  seedPerson(store, { userId: user.id, email, role: 'host' });
  return user;
}
