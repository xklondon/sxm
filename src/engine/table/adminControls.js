import { DEFAULT_TABLE_ADMIN_SETTINGS } from '../../types/admin';
import { isTableOwner } from '../session/tokens';
export function getTableAdminSettings(state) {
    return state.tableAdminSettings ?? DEFAULT_TABLE_ADMIN_SETTINGS;
}
export function updateTableAdminSettings(state, patch) {
    return {
        ...state,
        tableAdminSettings: {
            ...getTableAdminSettings(state),
            ...patch,
        },
    };
}
export function canUserAssignChips(state, personName) {
    const admin = getTableAdminSettings(state);
    if (admin.ownerOnlyCanAssignChips) {
        return isTableOwner(state, personName);
    }
    return true;
}
export function canUserChangeProtocol(state, personName) {
    if (state.tableMeta.protocolLocked) {
        return false;
    }
    const admin = getTableAdminSettings(state);
    if (admin.ownerOnlyCanChangeProtocol) {
        return isTableOwner(state, personName);
    }
    return true;
}
export function canUserChangeDesign(state, personName) {
    const admin = getTableAdminSettings(state);
    if (admin.ownerOnlyCanChangeDesign) {
        return isTableOwner(state, personName);
    }
    return true;
}
export function canUserInvite(state, personName) {
    if (isTableOwner(state, personName)) {
        return true;
    }
    return getTableAdminSettings(state).allowInvitedPlayersToInvite;
}
export function canUserStartTable(state, personName) {
    if (isTableOwner(state, personName)) {
        return true;
    }
    return getTableAdminSettings(state).allowInvitedPlayersToStartTables;
}
export function canUserResetTable(state, personName) {
    return isTableOwner(state, personName);
}
