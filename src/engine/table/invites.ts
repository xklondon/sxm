import type { GameState } from '../../types';
import type { TableInviteRecord } from '../../types/invites';
import { generateId } from '../utils/id';
import { formatInviteHostMessage } from '../../features/messaging/tableMessagingTypes';
import { log } from '../../utils/logger';

function randomToken(): string {
  return generateId().replace(/-/g, '').slice(0, 24);
}

export function getTableId(state: GameState): string {
  return state.session.id;
}

export function getTableOwnerId(state: GameState): string | null {
  return state.tableMeta.owner?.ownerName ?? state.tableMeta.controllerName ?? null;
}

export function buildJoinTablePath(params: {
  tableId: string;
  inviteId: string;
  token: string;
}): string {
  const q = new URLSearchParams({
    tableId: params.tableId,
    inviteId: params.inviteId,
    token: params.token,
  });
  return `/join-table?${q.toString()}`;
}

import { getTableInviteOrigin } from '../../utils/tableHost';

export function buildJoinTableUrl(_state: GameState, invite: TableInviteRecord): string {
  const origin = getTableInviteOrigin();
  return `${origin}${buildJoinTablePath({
    tableId: invite.tableId,
    inviteId: invite.inviteId,
    token: invite.token,
  })}`;
}

export function createTableInvite(
  state: GameState,
  invitedName: string,
  invitedEmail: string,
  note = '',
  canInviteOthers = false,
): { state: GameState; invite: TableInviteRecord } {
  const trimmedEmail = invitedEmail.trim();
  const trimmedName = invitedName.trim();

  const invitedBy =
    state.tableMeta.owner?.ownerName ??
    state.tableMeta.controllerName ??
    'Table host';

  const invite: TableInviteRecord = {
    inviteId: generateId(),
    tableId: getTableId(state),
    invitedEmail: trimmedEmail || '',
    invitedName: trimmedName || trimmedEmail || 'Guest',
    invitedBy,
    inviteStatus: 'pending',
    canInviteOthers,
    createdAt: new Date().toISOString(),
    token: randomToken(),
    note: note.trim() || undefined,
  };

  log.info('Table invite created', { inviteId: invite.inviteId, email: trimmedEmail });

  const next: GameState = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      invites: [...state.tableMeta.invites, invite],
    },
  };

  return { state: next, invite };
}

export function buildInviteMessage(state: GameState, invite: TableInviteRecord): string {
  const wager = state.tableMeta.agreement?.stakeDescription ?? 'a friendly game';
  const owner = invite.invitedBy;
  const link = buildJoinTableUrl(state, invite);
  const hostMessage = invite.note ? formatInviteHostMessage(invite.note) : '';
  const note = hostMessage ? `\n\n${hostMessage}` : '';
  return [
    `You're invited to my SXMCards table (${wager}).`,
    `Hosted by ${owner}.`,
    '',
    `Join link: ${link}`,
    '',
    'Open the link on your device when you arrive — local friends table, not real-money gambling.',
    note,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildInviteMailto(state: GameState, invite: TableInviteRecord): string {
  if (!invite.invitedEmail) {
    throw new Error('No email on invite');
  }
  const subject = encodeURIComponent('Join my SXMCards table');
  const body = encodeURIComponent(buildInviteMessage(state, invite));
  return `mailto:${encodeURIComponent(invite.invitedEmail)}?subject=${subject}&body=${body}`;
}

export function parseJoinTableParams(search: string): {
  tableId: string;
  inviteId: string;
  token: string;
} | null {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const tableId = params.get('tableId');
  const inviteId = params.get('inviteId');
  const token = params.get('token');
  if (!tableId || !inviteId || !token) {
    return null;
  }
  return { tableId, inviteId, token };
}
