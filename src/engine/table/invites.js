import { generateId } from '../utils/id';
import { log } from '../../utils/logger';
function randomToken() {
    return generateId().replace(/-/g, '').slice(0, 24);
}
export function getTableId(state) {
    return state.session.id;
}
export function getTableOwnerId(state) {
    return state.tableMeta.owner?.ownerName ?? state.tableMeta.controllerName ?? null;
}
export function buildJoinTablePath(params) {
    const q = new URLSearchParams({
        tableId: params.tableId,
        inviteId: params.inviteId,
        token: params.token,
    });
    return `/join-table?${q.toString()}`;
}
import { getTableInviteOrigin } from '../../utils/tableHost';
export function buildJoinTableUrl(_state, invite) {
    const origin = getTableInviteOrigin();
    return `${origin}${buildJoinTablePath({
        tableId: invite.tableId,
        inviteId: invite.inviteId,
        token: invite.token,
    })}`;
}
export function createTableInvite(state, invitedName, invitedEmail, note = '', canInviteOthers = false) {
    const trimmedEmail = invitedEmail.trim();
    const trimmedName = invitedName.trim();
    const invitedBy = state.tableMeta.owner?.ownerName ??
        state.tableMeta.controllerName ??
        'Table host';
    const invite = {
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
    const next = {
        ...state,
        tableMeta: {
            ...state.tableMeta,
            invites: [...state.tableMeta.invites, invite],
        },
    };
    return { state: next, invite };
}
export function buildInviteMessage(state, invite) {
    const wager = state.tableMeta.agreement?.stakeDescription ?? 'a friendly game';
    const owner = invite.invitedBy;
    const link = buildJoinTableUrl(state, invite);
    const note = invite.note ? `\n\nNote: ${invite.note}` : '';
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
export function buildInviteMailto(state, invite) {
    if (!invite.invitedEmail) {
        throw new Error('No email on invite');
    }
    const subject = encodeURIComponent('Join my SXMCards table');
    const body = encodeURIComponent(buildInviteMessage(state, invite));
    return `mailto:${encodeURIComponent(invite.invitedEmail)}?subject=${subject}&body=${body}`;
}
export function parseJoinTableParams(search) {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    const tableId = params.get('tableId');
    const inviteId = params.get('inviteId');
    const token = params.get('token');
    if (!tableId || !inviteId || !token) {
        return null;
    }
    return { tableId, inviteId, token };
}
