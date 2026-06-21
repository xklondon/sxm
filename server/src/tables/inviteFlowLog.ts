import { sanitizeEmail } from '../email/smtp.js';
import type { PersonRecord, Store, TableInviteRecord, UserRecord } from '../store/types.js';

export type InviteFlowStage = 'create' | 'accept' | 'join' | 'preview' | 'fail';

export interface InviteFlowSnapshot {
  route: string;
  stage: InviteFlowStage;
  tableId?: string;
  inviteId?: string;
  inviteeEmail?: string;
  inviterUserId?: string;
  inviterEmail?: string;
  inviterPersonId?: string;
  sessionUserId?: string;
  sessionEmail?: string;
  resolvedUserId?: string;
  resolvedUserEmail?: string;
  resolvedPersonId?: string;
  resolvedPersonEmail?: string;
  resolvedPersonStatus?: string;
  resolvedPersonCanLogin?: boolean | null;
  tableOwnerPersonId?: string;
  tableOwnerUserId?: string;
  tableOwnerEmail?: string;
  memberCountBefore?: number;
  memberCountAfter?: number;
  memberUserIdsBefore?: string;
  memberUserIdsAfter?: string;
  clearedSession?: boolean;
  failureCode?: string;
  failureReason?: string;
}

function maskId(id: string | null | undefined): string | undefined {
  if (!id) {
    return undefined;
  }
  return id.length <= 8 ? id : `${id.slice(0, 8)}…`;
}

function maskEmail(email: string | null | undefined): string | undefined {
  if (!email) {
    return undefined;
  }
  return sanitizeEmail(email);
}

function memberUserIdSummary(store: Store, tableId: string | undefined): {
  count: number;
  ids: string;
} {
  if (!tableId) {
    return { count: 0, ids: '' };
  }
  const members = store.getMembers(tableId);
  return {
    count: members.length,
    ids: members.map((member) => maskId(member.userId) ?? '?').join(','),
  };
}

export async function buildInviteFlowSnapshot(params: {
  store: Store;
  people: {
    getPersonForUser(userId: string): Promise<PersonRecord | null>;
  };
  route: string;
  stage: InviteFlowStage;
  tableId?: string;
  invite?: TableInviteRecord | null;
  inviterUser?: UserRecord | null;
  inviterPerson?: PersonRecord | null;
  sessionUserId?: string;
  sessionEmail?: string;
  resolvedUser?: UserRecord | null;
  resolvedPerson?: PersonRecord | null;
  clearedSession?: boolean;
  failureCode?: string;
  failureReason?: string;
  membersAfterTableId?: string;
}): Promise<InviteFlowSnapshot> {
  const table = params.tableId ? params.store.getTable(params.tableId) : null;
  const ownerPersonId = table?.state.tableMeta.ownerPersonId ?? undefined;
  const hostUser = table ? await params.store.getUserById(table.hostUserId) : null;
  const hostPerson = hostUser ? await params.people.getPersonForUser(hostUser.id) : null;
  const membersBefore = memberUserIdSummary(params.store, params.tableId);

  let membersAfter = membersBefore;
  if (params.membersAfterTableId) {
    membersAfter = memberUserIdSummary(params.store, params.membersAfterTableId);
  }

  return {
    route: params.route,
    stage: params.stage,
    tableId: maskId(params.tableId),
    inviteId: maskId(params.invite?.id),
    inviteeEmail: maskEmail(params.invite?.invitedEmail ?? params.sessionEmail),
    inviterUserId: maskId(params.inviterUser?.id),
    inviterEmail: maskEmail(params.inviterUser?.email),
    inviterPersonId: maskId(params.inviterPerson?.id),
    sessionUserId: maskId(params.sessionUserId),
    sessionEmail: maskEmail(params.sessionEmail),
    resolvedUserId: maskId(params.resolvedUser?.id),
    resolvedUserEmail: maskEmail(params.resolvedUser?.email),
    resolvedPersonId: maskId(params.resolvedPerson?.id),
    resolvedPersonEmail: maskEmail(params.resolvedPerson?.email),
    resolvedPersonStatus: params.resolvedPerson?.status,
    resolvedPersonCanLogin: params.resolvedPerson?.canLogin ?? null,
    tableOwnerPersonId: maskId(ownerPersonId ?? hostPerson?.id),
    tableOwnerUserId: maskId(hostUser?.id),
    tableOwnerEmail: maskEmail(hostUser?.email),
    memberCountBefore: membersBefore.count,
    memberCountAfter: membersAfter.count,
    memberUserIdsBefore: membersBefore.ids || undefined,
    memberUserIdsAfter:
      membersAfter.ids !== membersBefore.ids ? membersAfter.ids || undefined : undefined,
    clearedSession: params.clearedSession,
    failureCode: params.failureCode,
    failureReason: params.failureReason,
  };
}

export function logInviteFlow(snapshot: InviteFlowSnapshot): void {
  const parts = Object.entries(snapshot)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`);
  // eslint-disable-next-line no-console
  console.log(`[SXM][invite-flow] ${parts.join(' ')}`);
}

export async function logInviteFlowEvent(
  params: Parameters<typeof buildInviteFlowSnapshot>[0],
): Promise<void> {
  logInviteFlow(await buildInviteFlowSnapshot(params));
}

export function logInviteFlowFailure(
  snapshot: InviteFlowSnapshot,
  err: unknown,
  code?: string,
): void {
  const failureCode =
    code ??
    (err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : 'ERROR');
  const failureReason = err instanceof Error ? err.message : String(err);
  logInviteFlow({
    ...snapshot,
    stage: 'fail',
    failureCode,
    failureReason,
  });
}
