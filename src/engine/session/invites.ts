import type { GameState } from '../../types';
import type { TableOwner } from '../../types/table';

export {
  getTableId,
  getTableOwnerId,
  buildJoinTablePath,
  buildJoinTableUrl,
  createTableInvite,
  buildInviteMessage,
  buildInviteMailto,
  parseJoinTableParams,
} from '../table/invites';

import { createTableInvite as createInvite } from '../table/invites';

export function setTableOwner(
  state: GameState,
  ownerName: string,
  ownerEmail: string,
): GameState {
  const owner: TableOwner = {
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
export function addTableInvite(
  state: GameState,
  name: string,
  email: string,
  note = '',
): GameState {
  return createInvite(state, name, email, note).state;
}
