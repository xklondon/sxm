export { getTableId, getTableOwnerId, buildJoinTablePath, buildJoinTableUrl, createTableInvite, buildInviteMessage, buildInviteMailto, parseJoinTableParams, } from '../table/invites';
import { createTableInvite as createInvite } from '../table/invites';
export function setTableOwner(state, ownerName, ownerEmail) {
    const owner = {
        ownerName: ownerName.trim() || state.tableMeta.controllerName,
        ownerEmail: ownerEmail.trim(),
        createdAt: new Date().toISOString(),
    };
    return {
        ...state,
        tableMeta: { ...state.tableMeta, owner },
    };
}
/** @deprecated use createTableInvite — returns state only */
export function addTableInvite(state, name, email, note = '') {
    return createInvite(state, name, email, note).state;
}
